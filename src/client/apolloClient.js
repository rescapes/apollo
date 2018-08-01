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
import {getMainDefinition} from 'apollo-utilities';
import {setContext} from 'apollo-link-context';
import {ApolloClient} from 'apollo-client';
import {split, ApolloLink} from 'apollo-link';
//import {WebSocketLink} from 'apollo-link-ws';
import fetch from 'node-fetch';
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
 * @return {ApolloClient}
 */
const createApolloClient = (uri, stateLinkResolvers) => {

  const httpLink = createHttpLink({
    uri,
    credentials: 'include',
    fetch
  });

  const authLink = setContext((_, {headers}) => {
    // get the authentication token from local storage if it exists
    const token = localStorage.getItem('token');
    // return the headers to the context so httpLink can read them
    return {
      headers: {
        ...headers,
        authorization: token ? `Bearer ${token}` : ""
      }
    };
  });

  /*
  // Create a WebSocketLink to handle subscriptions from our subscription URI
  // null out for node
  const wsLink = process.browser ? new WebSocketLink({
    uri: `wss://subscriptions.graph.cool/v1/${serviceIdKey}`,
    options: {
      reconnect: true,
      connectionParams: {
        authToken: localStorage.getItem(authTokenKey)
      }
    }
  }) : null;
  */

  const errorLink = onError(({graphQLErrors, networkError}) => {
    if (graphQLErrors)
      graphQLErrors.map(error => {
        console.log(
          `[GraphQL error]: Message: ${R.propOr('undefined', 'message', error)}, Location: ${R.propOr('undefined', 'locations', error)}, Path: ${R.propOr('undefined', 'path', error)}`
        );
      });
    if (networkError) console.log(`[Network error]: ${networkError}`);
  });

  // Split queries between HTTP for Queries/Mutations and Websockets for Subscriptions.
  // TODO not using this at the moment until I have a need for subscriptions
  const link = split(
    // query is the Operation
    ({query}) => {
      const {kind, operation} = getMainDefinition(query);
      return kind === 'OperationDefinition' && operation === 'subscription';
    },
    // Use WebSocketLink
    //wsLink,
    errorLink,
    // Else use HttpLink with auth token
    authLink.concat(httpLink)
  );

  // THe InMemoryCache is passed to the StateLink and the ApolloClient
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
export const noAuthApolloClientQueryRequest = (client, args) => {
  return promiseToTask(client.query(args));
};

/**
 * Wrap an Apollo Client query into a promiseToTask converter and call a mutation
 * @param client An Apollo Client that doesn't need authentication
 * @param args
 * @return {*}
 */
export const noAuthApolloClientMutationRequest = (client, args) => {
  return promiseToTask(client.mutate(args));
};

/***
 * Authenticated Apollo Client request
 * @param authClient The authenticated Apollo Client
 * @return {Task} A Task that makes the request when run
 */
export const authApolloClientRequest = R.curry((authClient, args) => {
  return promiseToTask(authClient.query(args))
});

/**
 * Chained task version of getAuthClient
 * Given a userLogin with a tokenAuth.token create the authClient and return it and the token
 * This method is synchronous but returns a Task to be used in API chains
 * @param {String} url Graphpl URL, e.g.  'http://localhost:8000/api/graphql';
 * @param {Object} userLogin Return value from loginTask() api call
 * @param {Object} userLogin.tokenAuth
 * @param {String} userLogin.tokenAuth.token The user token
 * @return {Task<Object>} Task containing and object with a authClient and token
 */
export const authApolloClientTask = R.curry((url, userLogin) => {
  const token = reqStrPathThrowing('tokenAuth.token', userLogin);
  return of({token, authClient: getApolloAuthClient(url, token)});
});

/**
 * Given a token returns a GraphQL client
 * @param url Graphpl URL, e.g.  'http://localhost:8000/api/graphql';
 * @param authToken
 * @return {ApolloClient}
 */
export const getApolloAuthClient = (url, authToken) => createApolloClient(url, {
  headers: {
    Authorization: authToken
  }
});

export default createApolloClient;