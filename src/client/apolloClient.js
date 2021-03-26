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
import {inspect} from 'util';
import * as AC from '@apollo/client';
import * as R from 'ramda';
import T from 'folktale/concurrency/task/index.js';
import maybe from 'folktale/maybe/index.js';
import {Mutation, Query} from "react-apollo";
import {e} from '@rescapes/helpers-component';
import * as ACP from 'apollo3-cache-persist';
import {print} from 'graphql';
import moment from 'moment';
import {
  applyDeepWithKeyWithRecurseArraysAndMapObjs,
  compact,
  composeWithChain,
  defaultNode, duplicateKey,
  mapToNamedResponseAndInputs,
  memoizedTaskWith,
  promiseToTask,
  reqStrPathThrowing,
  retryTask,
  strPathOr
} from '@rescapes/ramda';
import fetch from 'node-fetch';
import {loggers} from '@rescapes/log';
import {optionsWithWinnowedProps} from '../helpers/requestHelpers.js';
import {v} from '@rescapes/validate';
import PropTypes from 'prop-types';
import MutationOnMount from '../helpers/mutationOnMount';
import {addMutateKeyToMutationResponse} from '../helpers/containerHelpers';

const {persistCache, LocalStorageWrapper} = defaultNode(ACP);

const {fromPromised, of} = T;

import {onError} from 'apollo-link-error';

const {ApolloClient, ApolloLink, createHttpLink, InMemoryCache} = defaultNode(AC);
const {Just} = maybe;

const log = loggers.get('rescapeDefault');

const logLink = new ApolloLink((operation, forward) => {
  //console.info(`${print(operation.query)}\nArguments:\n${inspect(operation.variables, false, 10)}\n\n`)
  return forward(operation).map((result) => {
    //console.info('response', inspect(result.data, false, 10));
    return result;
  });
});
/**
 * Creates an ApolloClient.
 * @param {Object} config
 * @param {Object} config.cacheOptions
 * @param {Object} config.cacheOptions.typePolicies See createInMemoryCache
 * @param {String} config.uri The uri of the graphql server
 * @param {Object} config.stateLinkResolversConfig The stateLinkResolvers for the schema or
 * @param {Object} config.cacheData Existing cache data to copy
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
 * headers: {
 *
 * }
 * Add additional headers. Authentication comes from localStorage
 * @return {{apolloClient: ApolloClient, persistor}}
 */
export const getOrCreateApolloClientTask = memoizedTaskWith(
  obj => {
    return R.merge(
      R.pick(['uri'], obj),
      // For each typePolicy, return the key of each cacheOption and the field names. Not the merge function
      R.map(
        ({fields}) => R.keys(fields),
        strPathOr({}, 'cacheOptions.typePolicies', obj)
      )
    );
  },
  ({cacheData, cacheOptions, uri, stateLinkResolvers, makeCacheMutation}) => {

    return composeWithChain([
      ({cache, cacheData, links, persistor}) => {
        const apolloClient = _completeApolloClient({
          stateLinkResolvers,
          links,
          cache,
          persistor
        });
        // Use existing cache data if defined. This is only relevant for passing an unauthorized client's
        // cache values
        // TODO restore no longer expects an argument
        // We probably have to do something manual here if we ever have cacheData from disk
        if (cacheData) {
          apolloClient.cache.restore(cacheData);
        }
        // Once createPersistedCacheTask we can create the apollo client
        return of({
          apolloClient
        });
      },
      mapToNamedResponseAndInputs('persistor',
        ({cache}) => {
          // Create the persisted cache and resolves nothing
          return createPersistedCacheTask(cache);
        }
      ),
      mapToNamedResponseAndInputs('cache',
        ({cacheOptions, makeCacheMutation}) => {
          return of(createInMemoryCache(R.merge(cacheOptions, {makeCacheMutation})));
        }
      ),
      mapToNamedResponseAndInputs('links',
        () => {
          const httpLink = createHttpLink({
            fetch,
            uri
          });

          const authLink = createAuthLink();
          // TODO I think our error link is out of data
          const errorLink = createErrorLink();
          return of([
            errorLink,
            authLink,
            // Terminal link, has to be last
            httpLink
          ]);
        }
      ),
      // This keeps any above composition from happening if memoizedTaskWith finds and existing client
      mapToNamedResponseAndInputs('void',
        () => of(null)
      )
    ])({cacheOptions, makeCacheMutation, cacheData});
  }
);

const createAuthLink = () => new ApolloLink((operation, forward) => {
  operation.setContext(({headers}) => {
    const token = localStorage.getItem('token');
    return {
      headers: {
        // Using JWT instead of Bearer here for Django JWT
        authorization: token ? `JWT ${token}` : "",
        ...headers
      }
    };
  });
  return forward(operation);
});

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
            inspect(strPathOr('undefined', 'params.trace', error), null, 2)}
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
 * NOTE typePolicies also ensures that singletons, namely ObtainJSONWebToken, get set with an initial value of null.
 * This ensures that subsequent updates to the value will trigger observing queries to re-fire
 * @return {InMemoryCache}
 */
const createInMemoryCache = ({typePolicies, makeCacheMutation}) => {
  const options = compact({typePolicies});
  const inMemoryCache = new InMemoryCache(options);
  R.forEachObjIndexed(
    (typePolicy, typeName) => {
      // keyFields empty indicates a singleton that we need to initialize to a null query result
      if (!R.length(strPathOr([true], 'keyFields', typePolicy))) {
        const outputParams = reqStrPathThrowing('outputParams', typePolicy);
        makeCacheMutation(
          // Use the store for writing if we don't have an apolloClient
          {store: inMemoryCache},
          {
            name: reqStrPathThrowing('name', typePolicy),
            // output for the read fragment
            outputParams: outputParams,
            // Write without @client fields
            force: true,
            singleton: true
          },
          R.merge(
            {__typename: typeName},
            // Set all outputParams to null for our initial query values
            applyDeepWithKeyWithRecurseArraysAndMapObjs((l, r, key) => null, (k, v) => v, outputParams)
          )
        );
      }
    },
    typePolicies
  );
  return inMemoryCache;
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
    storage: new LocalStorageWrapper(localStorage)
  }))();
};

/**
 * Use the stateLinkResolversConfig, links, and cache to complete the ApolloClient
 * @param {Object} stateLinkResolvers The stateLinkResolvers to give the client
 * @param {[Object]} links List of links to give the Apollo Client.
 * @param {Object} cache InMemoryCache instance
 * @param {Object} persistor Thing to help clear the cache
 * @return {Object} {apolloClient: ApolloClient}
 * @private
 */
const _completeApolloClient = ({stateLinkResolvers, links, cache, persistor}) => {
  // Create the ApolloClient using the following ApolloClientOptions
  const apolloClient = new ApolloClient({
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
        errorPolicy: "all",
        partialRefetch: true
      }
    },
    connectToDevTools: true
  });

  apolloClient.__CREATED__ = moment().format('HH-mm-SS');
  return apolloClient;
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
  return (`Query:\n\n${print(operation.query)}\nArguments:\n${inspect(operation.variables, false, 10)}\n`);
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
  log.debug(`noAuthApolloClientMutationRequestTask: ${print(options.mutation)} props: ${inspect(options.variables)}`);
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
  const skip = strPathOr(false, 'options.skip', apolloConfig);
  // Simulate a skip. apolloClient.mutate doesn't seem to acknowledge it
  if (skip) {
    return of({
      mutation: () => {
        log.warn("Attempt to call a mutation function whose variables are not ready. No-op");
      },
      result: {
        loading: false,
        error: false,
        data: null
      },
      skip: true
    });
  }
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

  const skip = strPathOr(false, 'options.skip', apolloConfig);
  // Skip seems broken for apolloClient.query
  // https://github.com/apollographql/apollo-client/issues/6670#issuecomment-663927304
  // Simulate a skip. apolloClient.query doesn't seem to acknowledge it
  if (skip) {
    return of({
      loading: false,
      error: false,
      data: null,
      skip: true
    });
  }
  const task = fromPromised(() => {
    return apolloClient.query(
      R.merge(
        {
          query
        },
        // Winnows the props to the apolloConfig.options.variables function
        optionsWithWinnowedProps(apolloConfig, props)
      )
    );
  })();
  return task;
});

/**
 * Reads a fragment
 */
export const apolloClientReadFragmentCache = R.curry((apolloConfig, fragment, id) => {

  log.debug(`Read Fragment: ${
    print(fragment)
  } id: ${id}`);

  // If this throws then we did something wrong
  try {
    const data = reqStrPathThrowing('apolloClient', apolloConfig).readFragment({fragment, id})
    // Put in data to match the return structure of normal queries
    log.debug(`Read Fragment Returned: ${data ? inspect(data, false, 10) : 'No response'}`)
    return {
      data
    };
  } catch (e) {
    log.error(`Could not read the fragment just written to the cache. Fragment ${print(fragment)}. Id: ${id}`);
    throw e;
  }
});


/**
 * Wraps a React component in an Apollo component containing the given query with the given options.
 * This is analogous to the authApolloClientQueryContainer in that it is the delayed execution of a graphql
 * query. Unlike authApolloClientQueryContainer, the variable values needed to execute the query
 * are passed by the wrapped apolloConfig as props rather than as part of the options
 * @param {Object} apolloConfig The apollo component. Contains options
 * @param {Object} apolloConfig.options optional Mutation component properties
 * @param {Object} apolloConfig.options.variables Variables mapping function. Props will have already
 * immediately on mount. Task calls with Apollo client always call mutate immediately
 * been passed through this so it is not used here
 * @param {Object} options.options.errorPolicy optional error policy
 * @param {Just} Returns a Maybe.Just containing the component.
 * The component is wrapped so it's compatible with monad composition. In the future this will be a Task (see below)
 */
export const authApolloComponentMutationContainer = v(R.curry((apolloConfig, mutation, {render, ...props}) => {

  // If mutateOnMount is specified, wrap the Mutation in MutationOnMount to run the mutation immediately
  // once. Subsequent renders won't run it.
  // This is only relevant for component calls, since tasks run the mutation immediately
  const MutationComponent = strPathOr(false, 'mutateOnMount', apolloConfig) && !R.propOr(false, 'apolloClient', apolloConfig)
    ? MutationOnMount
    : Mutation;

  return R.compose(
    // Wrap in a Maybe.Just so we can chain the results as we would the task result of an ApolloClient mutation
    Just,
    props => {
      return e(
        MutationComponent,
        R.merge(
          {mutation},
          // Merge options with the variables that have already been limited
          R.mergeAll([
            R.compose(
              options => R.omit(['variables'], options),
              apolloConfig => R.propOr({}, 'options', apolloConfig)
            )(apolloConfig),
            {
              variables: props
            },
            // There are always optional
            R.pick(['onCompleted', 'onError'], apolloConfig)
          ])
        ),
        // Pass the tuple as an object to the render function
        // If the apolloConfig.skip is specified, it is our way of indicating the mutation does not have
        // the variables it needs to run. So we make the mutation an noop and pass the skip param
        (mutate, result) => {
          const skip = strPathOr(false, 'options.skip', apolloConfig);
          const renderedComponent = render({
            mutation: (...args) => R.ifElse(
              () => skip,
              () => {
                log.warn("Attempt to call a mutation function whose variables are not ready. No-op");
              },
              mutate => {
                log.debug(`Calling mutation ${print(mutation)} with args ${inspect(R.length(args) ? args[0] : props, false, 10)}`);
                return mutate(...args).catch(
                  error => {
                    log.debug(`Mutation threw an error. This will not be thrown but handled by the components. Here is the error: ${
                      inspect(error, false, 10)}`)
                    return {data: null, error}
                  }
                ).then(({data, error, ...rest}) => {
                  if (error)
                    return
                  const response = {result: {data}, ...rest};
                  // Just logs the successful mutation. With an apolloClient the response is returned,
                  // but for component mutations this is mapping i sthrown away by react
                  return addMutateKeyToMutationResponse({}, response);
                });
              }
            )(mutate),
            result,
            skip
          });
          if (!renderedComponent) {
            throw new Error("authApolloComponentMutationContainer: render function did not return a value.");
          }
          return renderedComponent;
        }
      );
    }
  )(props);
}), [
  ['apolloConfig', PropTypes.shape().isRequired],
  ['mutation', PropTypes.shape().isRequired],
  ['props', PropTypes.shape({}).isRequired]
], 'authApolloComponentMutationContainer');

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
  // Converts apolloConfig.options.variables function to the variable function called with the props result
  const winnowedProps = optionsWithWinnowedProps(apolloConfig, props);
  return e(
    Query,
    R.merge(
      {query},
      winnowedProps
    ),
    // Render prop
    responseProps => {
      const skip = strPathOr(false, 'options.skip', apolloConfig);
      const renderedComponent = (render || children)(
        R.merge(
          // Since the response has no good indication of a skipped query, except loading=false and data=undefined,
          // Put the skip status in.
          {skip},
          responseProps
        )
      );
      if (!renderedComponent) {
        throw new Error("authApolloComponentQueryContainer: render function did not return a value.");
      }
      if (
        !strPathOr(null, 'data', responseProps) &&
        !skip &&
        R.equals(7, strPathOr(-1, 'networkStatus', responseProps))
      ) {
        // If the query returns null data, we have a missed cache field error
        // The missed cache field errors are hidden by Apollor, but it's the only reason we get
        // a loading = false, error = false, null data response
        const error = new Error(`Null data missed cache error for Query:\n${
          print(query)
        }\nArguments:\n${inspect(winnowedProps, false, 10)}\n`);
        const cache = apolloConfig.cache;

        log.error(error);
        throw error;
      }
      return renderedComponent;
    }
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
    [() => R.has('render', props),
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
      throw new Error(`apolloConfig doesn't have an Apollo client and props has no render function for a component query: Config: ${inspect(config)} props: ${inspect(props)}`);
    }]
  ])(config);
});


/**
 * Given a token returns the cached GraphQL client
 * @param {Object} config
 * @param {Object} config.cacheData Existing cache data if any
 * @param {Object} config.cacheOptions
 * @param {Object} config.cacheOptions.typePolicies See createInMemoryCache
 * @param {String} config.uri Graphpl URL, e.g.  'http://localhost:8000/api/graphql';
 * @param {Object} config.stateLinkResolvers: Resolvers for the stateLink, meaning local caching
 * Optionally {resolvers: ..., defaults: ...} to include default values
 * @param {String} authToken The auth token created from logging in
 * happens when the client is first created
 * @return {{apolloClient: ApolloClient, restoreStoreToDefaults}} restoreStoreToDefaults can be called to
 * reset the default values of the cache for logout
 */
export const getApolloClientTask = (
  {cacheData, cacheOptions, uri, stateLinkResolvers, makeCacheMutation},
  authToken
) => {
  return getOrCreateApolloClientTask({
    // Existing cache data if any
    cacheData,
    cacheOptions,
    uri,
    stateLinkResolvers,
    fixedHeaders: {},
    makeCacheMutation
  });
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


/***
 * Authenticated Client request
 * @param apolloClient The authenticated Apollo Client
 * @return {Task} A Task that makes the request when run
 */
export const authApolloClientRequestTask = R.curry((apolloClient, args) => {
  return fromPromised(() => apolloClient.request(args))();
});

