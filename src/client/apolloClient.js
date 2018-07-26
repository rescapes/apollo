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
import {split} from 'apollo-link';
import {WebSocketLink} from 'apollo-link-ws';
import fetch from 'node-fetch';
import {createHttpLink} from 'apollo-link-http';
import {onError} from 'apollo-link-error';
import * as R from 'ramda';
import {mockApolloClientWithSamples} from 'rescape-helpers-component';

const environment = process.env.NODE_ENV;


/**
 * Creates an ApolloClient.
 * @params {String} uri The uri of the graphql server
 * @return {ApolloClient}
 */
const createClient = ({uri}) => {

  const httpLink = createHttpLink({
    uri,
    credentials: 'include'
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
      graphQLErrors.map(({message, locations, path}) =>
        console.log(
          `[GraphQL error]: Message: ${message}, Location: ${locations}, Path: ${path}`
        )
      );
    if (networkError) console.log(`[Network error]: ${networkError}`);
  });

  // Split queries between HTTP for Queries/Mutations and Websockets for Subscriptions.
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


  // Create the ApolloClient using the following ApolloClientOptions
  return new ApolloClient({
    // Ths split Link
    link: authLink.concat(httpLink),
    // Use InMemoryCache
    cache: new InMemoryCache()
  });
};

/**
 * Create an apolloClient for the given environment
 * @param {String} env Defaults to process.env.NODE_ENV;
 * @param {String} uri For non-testing the uri to the apollo server
 * @param {Object} store The redux store. Required if env is 'test'.
 * For testing we use the store as a substitute for a remote datasource
 * @param {Object} resolvedSchema The resolved Apollo schema to use when testing
 * @returns {Object} An Apollo client for the given or default environment
 */
export default ({env = environment, uri = null, store = null, resolvedSchema = null}) => R.cond([
  // Set the client to the mockApolloClient for testing
  [R.equals('test'), () => mockApolloClientWithSamples(store.getState(), resolvedSchema)],
  [R.T, () => createClient({uri})]
])(env);