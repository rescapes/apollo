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
import {InMemoryCache} from 'apollo-cache-inmemory';
import {setContext} from 'apollo-link-context';
import {ApolloClient} from 'apollo-client';
import {graphql} from 'react-apollo';
import {split, ApolloLink} from 'apollo-link';
import {createHttpLink} from 'apollo-link-http';
import {onError} from 'apollo-link-error';
import * as R from 'ramda';
import createStateLink from './clientState';
import {promiseToTask, reqStrPathThrowing} from 'rescape-ramda';
import {task, of} from 'folktale/concurrency/task';

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
  const errorLink = onError(({graphQLErrors, networkError}) => {
    if (graphQLErrors)
      graphQLErrors.map(error => {
        console.error(
          `[GraphQL error]: Message: ${R.propOr('undefined', 'message', error)}, Location: ${R.propOr('undefined', 'locations', error)}, Path: ${R.propOr('undefined', 'path', error)}`
        );
      });
    if (networkError) console.error(`[Network error]: ${networkError}`);
  });

  // The InMemoryCache is passed to the StateLink and the ApolloClient
  const cache = new InMemoryCache();

  // Create the state link for local caching
  const stateLink = createStateLink(
    cache,
    stateLinkResolversAndDefaults
  );


// Create the ApolloClient using the following ApolloClientOptions
  const apolloClient = new ApolloClient({
    // This is just a guess at link order.
    // I know stateLink goes after errorLink and before httpLink
    // (https://www.apollographql.com/docs/link/links/state.html)
    link: ApolloLink.from([
      errorLink,
      authLink,
      // stateLink must be before httpLink and after errorLink
      stateLink,
      httpLink]),
    // Use InMemoryCache
    cache: new InMemoryCache()
  });
  apolloClient.onResetStore(stateLink.writeDefaults);

  // Return apolloClient
  return {apolloClient};
};

/**
 * Wrap an Apollo Client query into a promiseToTask converter and call a query
 * @param client An Apollo Client that doesn't need authentication
 * @param args
 * @return {*}
 */
export const noAuthApolloClientQueryRequestTask = (client, args) => {
  return promiseToTask(client.query(args));
};

/**
 * Wrap an Apollo Client query into a promiseToTask converter and call a mutation
 * @param {Object} apolloConfig An Apollo Client that doesn't need authentication
 * @param {Object} apolloConfig.apolloClient An Apollo Client that doesn't need authentication
 * @param options
 * @return {*}
 */
export const noAuthApolloClientMutationRequestTask = (apolloConfig, options) => {
  return task(resolver => {
    return reqStrPathThrowing('apolloClient', apolloConfig).mutate(options).then(
      resolved => resolver.resolve(resolved)
    ).catch(
      error => resolver.reject(error)
    );
  });
};

/***
 * Authenticated Apollo Client mutation request
 * @param apolloClient The authenticated Apollo Client
 * @return {Task} A Task that makes the request when run
 */
export const authApolloClientMutationRequestTask = R.curry((apolloConfig, options) => {
  return promiseToTask(reqStrPathThrowing('apolloClient', apolloConfig).mutate(options));
});

/***
 * Authenticated Apollo Client query request
 * @param apolloClient The authenticated Apollo Client
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
export const authApolloClientQueryRequestTask = R.curry((apolloClient, query, variables) => {
  return promiseToTask(apolloClient.query({query, variables}));
});

/**
 * Wraps a React component in an Apollo component containing the given query with the given options.
 * This is analogous to the authApolloClientQueryRequestTask in that it is the delayed execution of a graphql
 * query. Unlike authApolloClientQueryRequestTask, the variable values needed to execute the query
 * are passed by the wrapped apolloComponent as props rather than as part of the options
 * @param {Object} apolloComponent The apolloComponent
 * @param {Object} options
 * @param {Object} options.query required query to use
 * @param {Object} options.options optional react-apollo options
 * @param {Object} options.options.variables optional.
 * @param {Object} options.options.errorPolicy optional error policy
 * @param {Object} options.prop optional mapping of props returned by the query.
 */
export const authApolloComponentMutationRequestClass = R.curry((query, options, apolloComponent) => {
  return of(graphql(query, options)(apolloComponent));
});

/**
 * Wraps a React component in an Apollo component containing the given query with the given options.
 * This is analogous to the authApolloClientQueryRequestTask in that it is the delayed execution of a graphql
 * query. Unlike authApolloClientQueryRequestTask, the variable values needed to execute the query
 * are passed by the wrapped apolloComponent as props rather than as part of the options
 * @param {Object} apolloComponent The apolloComponent
 * @param {Object} options
 * @param {Object} options.query required query to use
 * @param {Object} options.options optional react-apollo options
 * @param {Object} options.options.variables optional.
 * @param {Object} options.options.errorPolicy optional error policy
 * @param {Object} options.prop optional mapping of props returned by the query.
 */
export const authApolloComponentQueryRequestClass = R.curry((query, options, apolloComponent) => {
  return of(graphql(query, options)(apolloComponent));
});


/**
 * @param {Object} apolloConfig The Apollo configuration with either an ApolloClient for server work or an
 * Apollo wrapped Component for browser work
 * @param {Object} apolloConfig.apolloClient Optional Apollo client, authenticated for most calls
 * @param {Object} apolloConfig.apolloComponent Optional Apollo component
 * @param {Function} apolloConfig.apolloComponent.options Required for ApolloComponent container queries.
 * A unary function expecting components from the parent component or container
 * @param {Object} apolloConfig.apolloComponent.options.variables Variables for the ApolloComponent container
 * @param {Object} apolloConfig.apolloComponent.options.errorPolicy Optional errorPolicy string for the ApolloComponent
 * container
 * @param {Object} queryAndArgs Options for ApolloClient or ApolloComponent container queries
 * @param {Object} queryAndArgs.query graphql query
 * @param {Object} queryAndArgs.variables Required if the query is to accept arguments. If this is a component
 * query, values must be supplied initially to inform the structure of the arguments
 * Object of simple or complex parameters. Example of client execution variables
 * {city: "Stavanger", data: {foo: 2}}
 * Example of the same variables for a component, where only the type of the values matter
 * {city: "", data: {foo: 0}}
 */
export const authApolloQueryRequestTask = R.curry((apolloConfig, query, componentOrProps) => {
  return R.cond([
    // Apollo Client instance
    [R.has('apolloClient'),
      apolloConfig => authApolloClientQueryRequestTask(
        R.prop('apolloClient', apolloConfig),
        query,
        // props
        componentOrProps
      )
    ],
    // Apollo Component
    [() => R.is(Function, componentOrProps),
      // Extract the options for the Apollo component query,
      // and the props function for the Apollo component
      apolloConfig => authApolloComponentQueryRequestClass(
        query,
        R.pick(['options', 'props'], apolloConfig),
        // component
        componentOrProps
      )
    ],
    [R.T, () => {
      throw new Error(`apolloConfig is neither for an Apollo Client nor Apollo Component: ${JSON.stringify(apolloConfig)}`);
    }]
  ])(apolloConfig);
});

/**
 * Only for testing. Reads values loaded from the server that we know are now in the cache
 * @param apolloClient The authenticated Apollo Client
 * @param {Object} options Query options for the Apollo Client See Apollo's Client.query docs
 * The main arguments for options are QueryOptions with query and variables. Example
 * query: gql`
 query regions($key: String!) {
          regions(key: $key) {
              id
              key
              name
          }
    }`,
 variables: {key: "earth"}
 */
export const authApolloClientQueryReadRequestTask = R.curry((apolloClient, options) => {
  // readQuery isn't a promise, just a direct call I guess
  return of(apolloClient.readQuery(options));
});

export const authApolloComponentQueryReadRequestTask = R.curry((query, options, apolloComponent) => {
  return of(graphql(query, options)(apolloComponent));
});

export const authApolloClientOrComponentQueryReadRequestTask = R.curry((apolloConfig, query, componentOrProps) => {
  return R.cond([
    // Apollo Client instance
    [R.has('apolloClient'),
      apolloConfig => authApolloClientQueryReadRequestTask(
        R.prop('apolloClient', apolloConfig),
        query
      )
    ],
    [R.has('apolloComponent'),
      // Extract the apolloConfig.apolloComponent--the React container, the options for the Apollo component query,
      // the props function for the Apollo component
      apolloConfig => authApolloComponentQueryReadRequestTask(
        R.pick(['options', 'props'], apolloConfig),
        componentOrProps
      )
    ]
  ])(apolloConfig);
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
 * @return {{apolloClient: ApolloClient}}
 */
export const authApolloClient = (url, stateLinkResolverAndDefaults, authToken) => createApolloClient(url, stateLinkResolverAndDefaults, {
  authorization: `JWT ${authToken}`
});

/**
 * Wrap a loginClient into a promiseToTask converter
 * @param client An Apollo Client that doesn't need authentication
 * @param args
 * @return {*}
 */
export const noAuthApolloClientRequestTask = (client, ...args) => {
  return promiseToTask(client.request(...args));
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