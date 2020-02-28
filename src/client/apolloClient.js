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
import {defaultDataIdFromObject, InMemoryCache} from 'apollo-cache-inmemory';

import {setContext} from 'apollo-link-context';
import {ApolloClient} from 'apollo-client';
import {onError} from 'apollo-link-error';
import {ApolloLink} from 'apollo-link';
import {createHttpLink} from 'apollo-link-http';
import * as R from 'ramda';
import {fromPromised, of} from 'folktale/concurrency/task';
import {Just} from 'folktale/maybe';
import {Mutation, Query} from "react-apollo";
import {e} from 'rescape-helpers-component';
import {print} from 'graphql';
import {promiseToTask, reqStrPathThrowing, strPathOr, retryTask} from 'rescape-ramda';
import fetch from 'node-fetch';
import {loggers} from 'rescape-log';
import {optionsWithWinnowedProps} from '../helpers/requestHelpers';

const log = loggers.get('rescapeDefault');

/**
 * Creates an ApolloClient.
 * @param {String} uri The uri of the graphql server
 * @param {Object} stateLinkResolversAndDefaults The stateLinkResolvers for the schema or
 * An object with resolvers and defaults keys to pass both resolvers and defaults
 * Example {
 *  resolvers: {
    Mutation: {
      updateNetworkStatus: (_, { isConnected }, { cache }) => {
        const data = {
          networkStatus: {
            __typename: 'NetworkStatus',
            isConnected
          },
        };
        cache.writeData({ data });
        return null;
      },
    },
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
const createApolloClient = (uri, stateLinkResolversAndDefaults, fixedHeaders = {}) => {
  const httpLink = createHttpLink({
    fetch,
    uri
  });

  // Authorization link
  // This code is adapted from https://www.apollographql.com/docs/react/recipes/authentication.html
  const authLink = setContext((_, {headers}) => {
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


  // Error handling link so errors don't get swallowed, which Apollo seems to like doing
  const errorLink = onError(({graphQLErrors, networkError, operation}) => {
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
    if (networkError) log.error(`[Network error]: ${networkError}. Operation: ${dumpOperation(operation)} Stack: ${R.propOr('undefined', 'stack', networkError)}`);
  });

  // The InMemoryCache is passed to the StateLink and the ApolloClient
  const cache = new InMemoryCache({
    dataIdFromObject: object => {
      switch (object.__typename) {
        // Default behavior. Useful for debugging to se how the object's id is determined
        default:
          return defaultDataIdFromObject(object);
      }
    }
  });

  // Assign our local sate resolver and local state defaults
  const {resolvers, defaults} = R.ifElse(
    R.has('resolvers'),
    // Specified as obj
    R.identity,
    // Just resolvers and no defaults were specified
    resolvers => ({resolvers, defaults: {}})
  )(stateLinkResolversAndDefaults);

// Create the ApolloClient using the following ApolloClientOptions
  const apolloClient = new ApolloClient({
    // This is just a guess at link order.
    // I know stateLink goes after errorLink and before httpLink
    // (https://www.apollographql.com/docs/link/links/state.html)
    link: ApolloLink.from([
      errorLink,
      authLink,
      httpLink]),
    // Use InMemoryCache
    cache,
    // Needed to make the @client direct go to the cache
    resolvers
  });
  cache.writeData({data: defaults});

  // Resetst the store to the defaults
  const restoreStoreToDefaults = () => {
    // doesn't actually reset the store. It refetches all active queries
    //apolloClient.resetStore();
    apolloClient.cache.reset();
    apolloClient.cache.writeData({data: defaults});
    return apolloClient;
  };

  // Return apolloClient and a funciton to restore the defaults
  return {apolloClient, restoreStoreToDefaults};
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
  const mutationOptions = R.omit(['apolloClient'], apolloConfig);
  /*
  TODO map result to match a component result
  mutationResponse => {
    const variableName = options.variableName;
    const name = options.name;
    log.debug(`makeMutationTask for ${variableName} responded: ${replaceValuesWithCountAtDepthAndStringify(2, mutationResponse)}`);
    // Put the result in data[name] to match the style of queries
    return of({
      data: {
        [name]: reqPathThrowing(['data', variableName, name], mutationResponse)
      }
    });
  },
  */
  return promiseToTask(
    apolloClient.mutate(
      R.merge(
        mutationOptions, {
          variables: props,
          ...R.pick(['mutation'], options)
        }
      )
    )
  );
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

  return fromPromised(() =>
    apolloClient.query(
      R.merge(
        {query},
        // Winnows the props to the apolloConfig.options.variables function
        optionsWithWinnowedProps(apolloConfig, props)
      )
    )
  )();
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
 * @param {Just} Returns a Maybe.Just containing the component.
 * The component is wrapped so it's compatible with monad composition. In the future this will be a Task (see below)
 */
export const authApolloComponentQueryContainer = R.curry((apolloConfig, query, {render, ...props}) => {

  return R.compose(
    // TODO in the future we'll use Query with the async option and convert its promise to a Task
    // The async option will make the render method (here the child component) handle promises, working
    // with React Suspense and whatever else
    Just,
    props => {
      return e(
        Query,
        R.merge(
          {query},
          // Converts apolloConfig.options.variables function to the variable function called with the props result
          optionsWithWinnowedProps(apolloConfig, props)
        ),
        render
      );
    }
  )(props);
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
        return R.chain(
          value => {
            return value;
          },
          authApolloComponentQueryContainer(
            apolloConfig,
            query,
            props
          )
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
 * @param url Graphpl URL, e.g.  'http://localhost:8000/api/graphql';
 * @param {Object} stateLinkResolvers: Resolvers for the stateLink, meaning local caching
 * @param {Object} authToken: Probably just for tests, pass the auth token in so we don't have to use
 * local storage to store are auth token
 * @return {{apolloClient: ApolloClient}}
 */
export const getApolloAuthClient = (url, stateLinkResolvers, authToken) => createApolloClient(url, stateLinkResolvers,
  {
    authorization: `JWT ${authToken}`
  }
);


/**
 * Non auth client for logging in
 * @param {string} url Graphpl URL, e.g.  'http://localhost:8000/api/graphql';
 * @param {Object} stateLinkResolvers: Resolvers for the stateLink, meaning local caching
 * @return {{apolloClient: ApolloClient}}
 */
export const noAuthApolloClient = (url, stateLinkResolvers) => createApolloClient(url, stateLinkResolvers);

/**
 * Given a token returns a GraphQL client
 * @param url Graphpl URL, e.g.  'http://localhost:8000/api/graphql';
 * @param {Object} stateLinkResolverAndDefaults: Resolvers for the stateLink, meaning local caching
 * Optionally {resolvers: ..., defaults: ...} to include default values
 * @param authToken
 * @return {{apolloClient: ApolloClient, restoreStoreToDefaults}} restoreStoreToDefaults can be called to
 * reset the default values of the cache for logout
 */
export const authApolloClient = (url, stateLinkResolverAndDefaults, authToken) => createApolloClient(url, stateLinkResolverAndDefaults, {
  authorization: `JWT ${authToken}`
});

/**
 * Wrap a loginClient into a promiseToTask converter
 * @param apolloConfig An Apollo Client that doesn't need authentication
 * @param apolloConfig.client An Apollo Client that doesn't need authentication
 * @param args
 * @return {*}
 */
export const noAuthApolloClientRequestTask = (apolloConfig, ...args) => {
  const apolloClient = reqStrPathThrowing('apolloClient', apolloConfig);
  return promiseToTask(apolloClient.request(...args));
};

/**
 * Chained task version of authApolloClient
 * Given a userLogin with a tokenAuth.token create the authApolloClient and return it and the token
 * This method is synchronous but returns a Task to be used in API chains
 * @param {String} url Graphpl URL, e.g.  'http://localhost:8000/api/graphql';
 * @param {Object} stateLinkResolversAndDefaults: Resolvers for the stateLink, meaning local caching.
 * Optionally {resolvers: ..., defaults: ...} to include default values
 * @param {Object} userLogin Return value from loginTask() api call
 * @param {Object} userLogin.tokenAuth
 * @param {String} userLogin.tokenAuth.token The user token
 * @return {Task<Object>} Task resolving to an object containing and object with a apolloClient, token.
 */
export const authApolloClientTask = R.curry((url, stateLinkResolversAndDefaults, userLogin) => {
  const token = reqStrPathThrowing('tokenAuth.token', userLogin);
  return of({token, ...authApolloClient(url, stateLinkResolversAndDefaults, token)});
});

/***
 * Authenticated Client request
 * @param apolloClient The authenticated Apollo Client
 * @return {Task} A Task that makes the request when run
 */
export const authApolloClientRequestTask = R.curry((apolloClient, args) => promiseToTask(apolloClient.request(args)));

export default createApolloClient;