/**
 * Created by Andy Likuski on 2017.11.29
 * Copyright (c) 2017 Andy Likuski
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 */
import {ApolloClient, ApolloLink, createHttpLink, InMemoryCache} from '@apollo/client';
import {setContext} from '@apollo/link-context';
import {onError} from '@apollo/link-error';
import * as R from 'ramda';
import {fromPromised, of} from 'folktale/concurrency/task';
import {Just} from 'folktale/maybe';
import {Mutation, Query} from "react-apollo";
import {e} from 'rescape-helpers-component';
import {print} from 'graphql';
import {
  compact,
  composeWithChain,
  composeWithMapMDeep,
  mapToNamedResponseAndInputs,
  memoizedWith,
  promiseToTask,
  reqStrPathThrowing,
  retryTask,
  strPathOr
} from 'rescape-ramda';
import fetch from 'node-fetch';
import {loggers} from 'rescape-log';
import {optionsWithWinnowedProps} from '../helpers/requestHelpers';
import {persistCache} from 'apollo-cache-persist';

const log = loggers.get('rescapeDefault');

/**
 * Creates an ApolloClient.
 * @param {Object} config
 * @param {Object} config.cacheOptions
 * @param {Object} config.cacheOptions.typePolicies See createInMemoryCache
 * @param {Function} config.cacheOptions.dataIdFromObject See createInMemoryCache
 * @param {String} config.uri The uri of the graphql server
 * @param {Object} config.stateLinkResolversConfig The stateLinkResolvers for the schema or
 * An object with resolvers and defaults keys to pass both resolvers and defaults
 * Example {
 *  resolvers: { ... see stateLink.defaultStateLinkResolvers for examples
  },
  defaults: {
    networkStatus: {
      __typename: 'NetworkStatus',
      isConnected: false,
    }
  }
 }
 * @param {Object} fixedHeaders an object such as   {
 * headers: {
 *     authorization: authToken
 *   }
 * } used for hard coding the authorization for testing
 * @return {{apolloClient: ApolloClient}}
 */
export const getOrCreateApolloClientTask = memoizedWith(
  obj => R.pick(['uri', 'fixedHeaders'], obj),
  ({cacheOptions, uri, stateLinkResolvers, fixedHeaders}) => {
    const httpLink = createHttpLink({
      fetch,
      uri
    });

    const authLink = createAuthLinkContext(fixedHeaders);
    const errorLink = createErrorLink();
    const cache = createInMemoryCache(cacheOptions);
    return composeWithMapMDeep(1, [
      ({cache}) => {
        // Once createPersistedCacheTask we can create the apollo client
        return {
          apolloClient: _completeApolloClient({
            stateLinkResolvers,
            links: [
              errorLink,
              authLink,
              httpLink
            ],
            cache
          })
        };
      },
      mapToNamedResponseAndInputs('void',
        cache => {
          // Create the persisted cache and resolves to void
          return createPersistedCacheTask(cache);
        }
      )
    ])({cache});
  }
);

/**
 *  Authorization link
 * This code is adapted from https://www.apollographql.com/docs/react/recipes/authentication.html
 * @param {Object} fixedHeaders Headers that don't change
 * @return {ApolloLink}
 */
const createAuthLinkContext = (fixedHeaders) => {

  return setContext((_, {headers}) => {
    // get the authentication token from local storage if it exists
    const token = localStorage.getItem('token');
    // return the headers to the context so httpLink can read them
    return {
      headers: R.merge(
        {
          // Using JWT instead of Bearer here for Django JWT
          authorization: token ? `JWT ${token}` : ""
        },
        fixedHeaders
      )
    };
  });
};

/**
 *
 * Error handling link so errors don't get swallowed, which Apollo seems to like doing
 * @return {ApolloLink}
 */
const createErrorLink = () => {
  return onError(({graphQLErrors, networkError, operation}) => {
    if (graphQLErrors)
      graphQLErrors.map(error => {
        log.error(
          `[GraphQL error]: Exception: ${
            strPathOr('undefined', 'params.exception', error)
          } Message: ${
            R.propOr('undefined', 'message', error)
          }, Trace: ${
            JSON.stringify(strPathOr('undefined', 'params.trace', error), null, 2)}
            Operation: ${dumpOperation(operation)
          }}`
        );
      });
    if (networkError) log.error(
      `[Network error]: ${
        networkError
      }. Operation: ${
        dumpOperation(operation)
      } Stack: ${
        R.propOr('undefined', 'stack', networkError)
      }`);
  });
};

/**
 * The InMemoryCache is passed to the StateLink and the ApolloClient
 * Place custom dataIdFromObject handling here
 * @param {Object} typePolicies Used to specify how to merge the fields on update.
 * To ensure that non-normalized sub objects are merged on update, and not simply replaced as in now the default behavior,
 * we need to define a merge function for each type and field where this in an issue. For instance, if we have
 * the type 'SettingsType' that has values in settings.data that we only store in cache, then reading the settings
 * from the server will wipe out cache-only values. We solve this by passing the following:
 * typePolicies: {
      SettingsType: {
        fields: {
          data: {
            merge(existing, incoming, { mergeObjects }) {
              // https://www.apollographql.com/docs/react/v3.0-beta/caching/cache-field-behavior/
              return mergeObjects(existing, incoming);
            },
          },
        },
      }
    }
 * This will ensure that settings.data merges existing and incoming data. The mergeObjects makes sure
 * that this strategy is followed on each sub-object (I think).
 * To automate this behavior, pass typePoliciesWithMergeObjects([{
 *  type: 'Settings',
 *  fields: ['data', 'foo', 'bar'] // fields of objects that need merging
 *
 * }, ... (other types) ...
 * ]
 * )
 * @param {Function} dataIdFromObject used to id types. Example:
 * object => {
      switch (object.__typename) {
        // Store the default settings with a magic id. Settings are stored in the database but the initial
        // settings come from code so don't have an id
        case 'SettingsType':
          return R.ifElse(
            R.prop('id'),
            obj => defaultDataIdFromObject(obj),
            obj => defaultDataIdFromObject(R.merge({'id': 'default'}, obj))
          )(object);
        // Default behavior. Useful for debugging to se how the object's id is determined
        default:
          return defaultDataIdFromObject(object);
      }
    }
 * @return {InMemoryCache}
 */
const createInMemoryCache = ({typePolicies, dataIdFromObject}) => {
  const options = compact({typePolicies, dataIdFromObject});
  return new InMemoryCache(options);
};

/**
 * Creates a persisted cache
 * https://github.com/apollographql/apollo-cache-persist
 * @param cache
 * @return {*}
 */
const createPersistedCacheTask = (cache) => {
  return fromPromised(() => persistCache({
    cache,
    storage: localStorage
  }))();
};

/**
 * Use the stateLinkResolversConfig, links, and cache to complete the ApolloClient
 * @param {Object} stateLinkResolvers The stateLinkResolvers to give the client
 * @param {[Object]} links List of links to give the Apollo Client.
 * @param {Object} cache InMemoryCache instance
 * @return {Object} {apolloClient: ApolloClient}
 * @private
 */
const _completeApolloClient = ({stateLinkResolvers, links, cache}) => {
  // Create the ApolloClient using the following ApolloClientOptions
  return new ApolloClient({
    // This is just a guess at link order.
    // I know stateLink goes after errorLink and before httpLink
    // (https://www.apollographql.com/docs/link/links/state.html)
    link: ApolloLink.from(links),
    // Use InMemoryCache
    cache,
    // Needed to make the @client direct go to the cache
    resolvers: stateLinkResolvers,
    defaultOptions: {
      query: {
        errorPolicy: "all"
      }
    }
  });

};


/**
 * Dumps an operation object from the server when an error occurs
 * @param operation
 * @returns {string}
 */
const dumpOperation = operation => {
  if (!operation) {
    return '';
  }
  return (`Query:\n\n${print(operation.query)}\nArguments:\n${JSON.stringify(operation.variables, null, 2)}\n`);
};

/**
 * Wrap an Apollo Client query into a promiseToTask converter and call a query
 * @param apolloConfig An Apollo Client that doesn't need authentication
 * @param apolloConfig.apolloCient An Apollo Client that doesn't need authentication
 * @param args
 * @return {*}
 */
export const noAuthApolloClientQueryRequestTask = (apolloConfig, args) => {
  const apolloClient = reqStrPathThrowing('apolloClient', apolloConfig);
  return promiseToTask(apolloClient.query(args));
};

/**
 * Wrap an Apollo Client query into a promiseToTask converter and call a mutation
 * @param {Object} apolloConfig An Apollo Client that doesn't need authentication and mutation options
 * @param {Object} apolloConfig.apolloClient An Apollo Client that doesn't need authentication
 * @param options
 * @param options.mutation: The Apollo mutation
 * @param options.variables: The mutation variables
 * @return {*}
 */
export const noAuthApolloClientMutationRequestTask = (apolloConfig, options) => {
  const mutationOptions = R.omit(['apolloClient'], apolloConfig);
  log.debug(`noAuthApolloClientMutationRequestTask: ${print(options.mutation)} props: ${JSON.stringify(options.variables)}`);
  return fromPromised(
    () => reqStrPathThrowing('apolloClient', apolloConfig).mutate(R.merge(mutationOptions, options))
  )();
};

/***
 * Authenticated Apollo Client mutation request
 * @param apolloClient The authenticated Apollo Client
 * @return {Task} A Task that makes the request when run
 */
export const authApolloClientMutationRequestContainer = R.curry((apolloConfig, options, props) => {
  const apolloClient = reqStrPathThrowing('apolloClient', apolloConfig);
  const mutationOptions = R.propOr({}, ['options'], apolloConfig);
  return fromPromised(() => (
    apolloClient.mutate(
      R.merge(
        mutationOptions, {
          variables: props,
          ...R.pick(['mutation'], options)
        }
      )
    )
  ))();
});

/***
 * Authenticated Apollo Client query request
 * @param apolloConfig The apolloConfig contains the client and options for query like fetch policy
 * @param apolloConfig.apolloClient The authenticated Apollo Client
 * @param {Object} query Query options for the Apollo Client See Apollo's Client.query docs
 * The main arguments for options are QueryOptions with query and variables. Example
 * query: gql`
 query regions($key: String!) {
          regions(key: $key) {
              id
              key
              name
          }
    }`,
 # @param {Object} variable: Argument values for the query. Example {key: "earth"}
 * @return {Task} A Task that makes the request when run an returns the query results or an error
 * Results are returned in {data: ...} and errors in {errors:...}
 */
export const authApolloClientQueryContainer = R.curry((apolloConfig, query, props) => {
  const apolloClient = reqStrPathThrowing('apolloClient', apolloConfig);

  const task = fromPromised(() => {
    return apolloClient.query(
      R.merge(
        {query},
        // Winnows the props to the apolloConfig.options.variables function
        optionsWithWinnowedProps(apolloConfig, props)
      )
    );
  })();
  return task;
});

/**
 * Wraps a React component in an Apollo component containing the given query with the given options.
 * This is analogous to the authApolloClientQueryContainer in that it is the delayed execution of a graphql
 * query. Unlike authApolloClientQueryContainer, the variable values needed to execute the query
 * are passed by the wrapped apolloComponent as props rather than as part of the options
 * @param {Object} apolloComponent The apollo component. Contains options
 * @param {Object} apolloComponent.options optional Mutation component properties
 * @param {Object} apolloComponent.options.variables Variables mapping function. Props will have already
 * been passed through this so it is not used here
 * @param {Object} options.options.errorPolicy optional error policy
 * @param {Just} Returns a Maybe.Just containing the component.
 * The component is wrapped so it's compatible with monad composition. In the future this will be a Task (see below)
 */
export const authApolloComponentMutationContainer = R.curry((apolloConfig, mutation, {render, ...props}) => {
  return R.compose(
    // Wrap in a Maybe.Just so we can use kestral composition (R.composeK) on the results
    // TODO in the future we'll use Mutation with the async option and convert its promise to a Task
    // The async option will make the render method (here the child component) handle promises, working
    // with React Suspense and whatever else
    Just,
    props => {
      return e(
        Mutation,
        R.merge(
          {mutation},
          // Merge options with the variables that have already been limited
          R.merge(
            R.compose(
              options => R.omit(['variables'], options),
              apolloConfig => R.propOr({}, 'options', apolloConfig)
            )(apolloConfig),
            {variables: props}
          )
        ),
        render
      );
    }
  )(props);
});

/**
 * Wraps a React component in an Apollo component containing the given query with the given options.
 * This is analogous to the authApolloClientQueryContainer in that it is the delayed execution of a graphql
 * query. Unlike authApolloClientQueryContainer, the variable values needed to execute the query
 * are passed by the wrapped apolloComponent as props rather than as part of the options
 * @param {gql} query The gql wrapped query string
 * @param {Object} args Apollo Query or Mutation options
 * @param {Object} args.options optional react-apollo options
 * @param {Object|Function} args.options.variables optional. If a function, props are passed to it
 * @param {String} args.options.errorPolicy optional error policy
 * @param {Function} [args.props] optional react-apollo options TODO is this allowed?
 * @param {Object} apolloComponent The apolloComponent
 * @param {Object} props The props For the component or a subcomponent if this component is wrapping another
 * @param {Function}
 * The component is wrapped so it's compatible with monad composition. In the future this will be a Task (see below)
 */
export const authApolloComponentQueryContainer = R.curry((apolloConfig, query, {render, children, ...props}) => {
  // Return the Query element wrapped in a function that expects the children prop.
  // Query's response is sent via a render prop to children
  return e(
    Query,
    R.merge(
      {query},
      // Converts apolloConfig.options.variables function to the variable function called with the props result
      optionsWithWinnowedProps(apolloConfig, props)
    ),
    // Render prop
    responseProps => (render || children)(responseProps)
  );
});


/**
 * @param {Object} apolloConfig The Apollo configuration with either an ApolloClient for server work or an
 * Apollo wrapped Component for browser work
 * @param {Object} config.apolloClient Optional Apollo client for client calls, authenticated for most calls
 * @param {Object|Function} config.args Options ued by Apollo Query and Mutation
 * @param {Object|Function} config.args.options Variables for the ApolloComponent container
 * @param {Object|Function} config.args.options.variables Variables for the ApolloComponent container
 * @param {String} config.args.options.errorPolicy Optional errorPolicy string for the ApolloComponent container
 * @param {Function} config.args.props Post processing of the results from the query or mutation. Receives
 * data and ownProps as arguments, where ownProps are the props passed into the query or mutation
 * @param {Object} props Required if the query is to accept arguments. If this is a component
 * query, values must be supplied initially to inform the structure of the arguments
 * Object of simple or complex parameters. Example of client execution variables
 * {city: "Stavanger", data: {foo: 2}}
 * Example of the same variables for a component, where only the type of the values matter
 * {city: "", data: {foo: 0}}
 */
export const authApolloQueryContainer = R.curry((config, query, props) => {
  return R.cond([
    // Apollo Client instance
    [R.has('apolloClient'),
      apolloConfig => retryTask(
        authApolloClientQueryContainer(
          apolloConfig,
          query,
          props
        ), 3)
    ],
    // Apollo Component
    [R.T,
      // Extract the options for the Apollo component query,
      // and the props function for the Apollo component
      apolloConfig => {
        return authApolloComponentQueryContainer(
          apolloConfig,
          query,
          props
        );
      }
    ],
    [R.T, () => {
      throw new Error(`apolloConfig doesn't have an Apollo client and component is null: ${JSON.stringify(config)}`);
    }]
  ])(config);
});

/**
 * Given a token returns a GraphQL client
 * @param {Object} config
 * @param {String} config.uri Graphpl URL, e.g.  'http://localhost:8000/api/graphql';
 * @param {Object} config.stateLinkResolvers: Resolvers for the stateLink, meaning local caching
 * local storage to store are auth token
 * @param {Function} config.writeDefaults expecting apolloClient that writes defaults ot the cache
 * @param {Object} config.settingsConfig
 * @param {Array|Object} config.settingsConfig.settingsOutputParams The settings outputParams
 * @param {[String]} config.settingsConfig.cacheOnlyObjs See defaultSettingsStore for an example
 * @param {[String]} config.settingsConfig.cacheIdProps See defaultSettingsStore for an example
 * @param {String} authToken: Authenticates the client
 * @return {{apolloClient: ApolloClient}}
 */
export const getOrCreateApolloAuthClientTaskAndSetDefaults = (
  {
    cacheOptions,
    uri,
    stateLinkResolvers,
    writeDefaults,
    settingsConfig
  },
  authToken
) => {
  const {cacheOnlyObjs, cacheIdProps, settingsOutputParams} = settingsConfig;
  return composeWithChain([
    ({apolloConfig, cacheOnlyObjs, cacheIdProps, settingsOutputParams, writeDefaults}) => {
      const apolloClient = reqStrPathThrowing('apolloClient', apolloConfig);
      // Set writeDefaults to reset the cache. reset: true tells the function that this isn't the initial call
      apolloClient.onResetStore(() => writeDefaults(apolloClient, {cacheOnlyObjs, cacheIdProps, settingsOutputParams}));
      const taskIfNotTask = obj => {
        return R.unless(obj => 'run' in obj, of)(obj);
      };
      // Write the initial defaults as a task if not one already, return the apolloClient
      // The initial write sets reset: false in case we need to go to the server the first time to get the values
      // or the structure of the values
      return R.map(
        () => ({apolloClient}),
        taskIfNotTask(writeDefaults(apolloClient, {cacheOnlyObjs, cacheIdProps, settingsOutputParams}))
      );
    },
    mapToNamedResponseAndInputs('apolloConfig',
      ({uri, stateLinkResolvers, authToken}) => {
        // Memoized call
        return getOrCreateApolloClientTask({
            cacheOptions,
            uri,
            stateLinkResolvers,
            fixedHeaders: {
              authorization: `JWT ${authToken}`
            }
          }
        );
      }
    )
  ])({uri, stateLinkResolvers, authToken, writeDefaults, cacheOnlyObjs, cacheIdProps, settingsOutputParams});
};

/**
 * Given a token returns the cached GraphQL client
 * @param {Object} config
 * @param {Object} config.cacheOptions
 * @param {Object} config.cacheOptions.typePolicies See createInMemoryCache
 * @param {Function} config.cacheOptions.dataIdFromObject See createInMemoryCache
 * @param {String} config.uri Graphpl URL, e.g.  'http://localhost:8000/api/graphql';
 * @param {Object} config.stateLinkResolvers: Resolvers for the stateLink, meaning local caching
 * Optionally {resolvers: ..., defaults: ...} to include default values
 * @param {String} authToken The auth token created from logging in
 * happens when the client is first created
 * @return {{apolloClient: ApolloClient, restoreStoreToDefaults}} restoreStoreToDefaults can be called to
 * reset the default values of the cache for logout
 */
export const getApolloClientTask = (
  {cacheOptions, uri, stateLinkResolvers},
  authToken
) => {
  return getOrCreateApolloClientTask({
    cacheOptions,
    uri,
    stateLinkResolvers,
    fixedHeaders: {
      authorization: `JWT ${authToken}`
    }
  });
};

/**
 * Non auth client for logging in. Returns a client that can only be used for logging in
 * @param {Object} config The config
 * @param {Object} config.cacheOptions
 * @param {string} config.uri Graphpl URL, e.g.  'http://localhost:8000/api/graphql';
 * @param {Object} config.stateLinkResolvers: Resolvers for the stateLink, meaning local caching
 * @return {{apolloClient: ApolloClient}}
 */
export const noAuthApolloClientTask = ({cacheOptions, uri, stateLinkResolvers}) => {
  return getOrCreateApolloClientTask({cacheOptions, uri, stateLinkResolvers, fixedHeaders: {}});
};

/**
 * Wrap a loginClient into a promiseToTask converter
 * @param apolloConfig An Apollo Client that doesn't need authentication
 * @param apolloConfig.client An Apollo Client that doesn't need authentication
 * @param args
 * @return {*}
 */
export const noAuthApolloClientRequestTask = (apolloConfig, ...args) => {
  const apolloClient = reqStrPathThrowing('apolloClient', apolloConfig);
  return fromPromised(() => apolloClient.request(...args))();
};

/**
 * Chained task version of getApolloClientTask
 * Given a userLogin with a tokenAuth.token create the getApolloClientTask and return it and the token
 * This method is synchronous but returns a Task to be used in API chains
 * @param {Object} config
 * @param {Object} config.cacheOptions
 * @param {String} config.uri Graphpl URL, e.g.  'http://localhost:8000/api/graphql';
 * @param {Object} config.stateLinkResolvers Resolvers for the stateLink, meaning local caching
 * @param {Function} config.writeDefaults
 * @param {Array|Object} config.outputParams Teh settings outputParams
 * @param {Object} userLogin Return value from loginMutationTask() api call
 * @param {Object} userLogin.tokenAuth
 * @param {String} userLogin.tokenAuth.token The user token
 * @param {Object} config.settingsConfig
 * @param {Array|Object} config.settingsConfig.defaultSettingsOutputParams The settings outputParams
 * @param {[String]} config.settingsConfig.defaultSettingsCacheOnlyObjs See defaultSettingsStore for an example
 * @param {[String]} config.settingsConfig.defaultSettingsCacheIdProps See defaultSettingsStore for an example
 * @return {Task<Object>} Task resolving to an object containing and object with a apolloClient, token.
 */
export const getOrCreateAuthApolloClientWithTokenTask = R.curry((
  {
    cacheOptions, uri, stateLinkResolvers, writeDefaults,
    settingsConfig
  },
  userLogin
) => {
  const {cacheOnlyObjs, cacheIdProps, settingsOutputParams} = settingsConfig;
  const token = reqStrPathThrowing('tokenAuth.token', userLogin);
  return R.map(
    obj => {
      return R.merge(
        {token},
        obj
      );
    },
    getOrCreateApolloAuthClientTaskAndSetDefaults({
      cacheOptions,
      uri,
      stateLinkResolvers,
      writeDefaults,
      settingsConfig: {cacheOnlyObjs, cacheIdProps, settingsOutputParams}
    }, token)
  );
});

/***
 * Authenticated Client request
 * @param apolloClient The authenticated Apollo Client
 * @return {Task} A Task that makes the request when run
 */
export const authApolloClientRequestTask = R.curry((apolloClient, args) => {
  return fromPromised(() => apolloClient.request(args))();
});

