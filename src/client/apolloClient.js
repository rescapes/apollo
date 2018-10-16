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
 * @param {Object} stateLinkResolvers: Resolvers for the stateLink, meaning local caching
 * Example
 *  {
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
  }
 * @param {Object} fixedHeaders an object such as   {
 * headers: {
 *     authorization: authToken
 *   }
 * } used for hard coding the authorization for testing
 * @return {ApolloClient}
 */
const createApolloClient = (uri, stateLinkResolvers, fixedHeaders = {}) => {
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
    stateLinkResolvers
  );

// Create the ApolloClient using the following ApolloClientOptions
  return new ApolloClient({
    // This is just a guess at link order.
    // I know stateLink goes after errorLink and before httpLink
    // (https://www.apollographql.com/docs/link/links/state.html)
    link: ApolloLink.from([
      errorLink,
      authLink,
      stateLink,
      httpLink]),
    // Use InMemoryCache
    cache: new InMemoryCache()
  });
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
 * @param client An Apollo Client that doesn't need authentication
 * @param options
 * @return {*}
 */
export const noAuthApolloClientMutationRequestTask = (client, options) => {
  return promiseToTask(client.mutate(options));
};

/***
 * Authenticated Apollo Client mutation request
 * @param authClient The authenticated Apollo Client
 * @return {Task} A Task that makes the request when run
 */
export const authApolloClientMutationRequestTask = R.curry((authClient, options) => {
  return promiseToTask(authClient.mutate(options));
});

/***
 * Authenticated Apollo Client query request
 * @param authClient The authenticated Apollo Client
 * @param {Object} options Query options for the Apollo Client See Apollo's Client.query docs
 * The main arguments for options are QueryOptions with query and variables. Example
 * query: gql`
   query region($key: String!) {
          region(key: $key) {
              id
              key
              name
          }
    }`,
   variables: {key: "earth"}
 * @return {Task} A Task that makes the request when run
 */
export const authApolloClientQueryRequestTask = R.curry((authClient, options) => {
  return promiseToTask(authClient.query(options));
});

/**
 * Given a token returns a GraphQL client
 * @param url Graphpl URL, e.g.  'http://localhost:8000/api/graphql';
 * @param {Object} stateLinkResolvers: Resolvers for the stateLink, meaning local caching
 * @param {Object} authToken: Probably just for tests, pass the auth token in so we don't have to use
 * local storage to store are auth token
 * @return {ApolloClient}
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
 */
export const noAuthApolloClient = (url, stateLinkResolvers) => createApolloClient(url, stateLinkResolvers);

/**
 * Given a token returns a GraphQL client
 * @param url Graphpl URL, e.g.  'http://localhost:8000/api/graphql';
 * @param {Object} stateLinkResolvers: Resolvers for the stateLink, meaning local caching
 * @param authToken
 * @return {GraphQLClient}
 */
export const authApolloClient = (url, stateLinkResolvers, authToken) => createApolloClient(url, stateLinkResolvers, {
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
 * @param {Object} stateLinkResolvers: Resolvers for the stateLink, meaning local caching
 * @param {Object} userLogin Return value from loginTask() api call
 * @param {Object} userLogin.tokenAuth
 * @param {String} userLogin.tokenAuth.token The user token
 * @return {Task<Object>} Task containing and object with a authApolloClient and token
 */
export const authApolloClientTask = R.curry((url, stateLinkResolvers, userLogin) => {
  const token = reqStrPathThrowing('tokenAuth.token', userLogin);
  return of({token, authClient: authApolloClient(url, stateLinkResolvers, token)});
});

/***
 * Authenticated Client request
 * @param authClient The authenticated Apollo Client
 * @return {Task} A Task that makes the request when run
 */
export const authApolloClientRequestTask = R.curry((authClient, args) => promiseToTask(authClient.request(args)));

export default createApolloClient;