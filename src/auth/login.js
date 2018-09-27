/**
 * Created by Andy Likuski on 2018.04.25
 * Copyright (c) 2018 Andy Likuski
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 */

import * as R from 'ramda';
import {noAuthApolloClient, authApolloClientRequestTask, authApolloClientTask, noAuthApolloClientMutationRequestTask, authApolloClientMutationRequestTask} from '../client/apolloClient'
import {GraphQLClient} from 'graphql-request';
import {of} from 'folktale/concurrency/task';
import {reqStrPathThrowing} from 'rescape-ramda';
import gql from 'graphql-tag';
import {ApolloClient} from 'apollo-client';

const loginMutation = gql`mutation TokenAuth($username: String!, $password: String!) {
  tokenAuth(username: $username, password: $password) {
    token
  }
}`;

/**
 * loginTask returning a User and token
 * @param {Object} noAuthClient, Client an Apollo Client that doesn't need authentication
 * @param {Object} values
 * @param {String} values.username The username
 * @param {String} values.password The password
 * @return {Task} Returns an object representing a user with a token. This token must
 * be passed to authenticated calls
 */
export const loginTask = R.curry((noAuthClient, variables) => noAuthApolloClientMutationRequestTask(
  noAuthClient,
  {mutation: loginMutation, variables}
));

/**
 * Login and return an authenticated client task
 * @param {String} uri graphql uri
 * @param {Object} stateLinkResolvers: Resolvers for the stateLink, meaning local caching
 * @param {Object} values
 * @param {String} values.username The username
 * @param {String} values.password The password
 */
export const loginToAuthClientTask = R.curry((uri, stateLinkResolvers, variables) => {
  // Use unauthenticated ApolloClient for login
  const login = loginTask(noAuthApolloClient(uri, stateLinkResolvers));
  return R.composeK(
    loginResult => {
      // loginResult.data contains {tokenAuth: token}
      return authApolloClientTask(uri, stateLinkResolvers, R.prop('data', loginResult))
    },
    args => login(args)
  )(variables)
});

const verifyTokenMutation = gql`mutation VerifyToken($token: String!) {
  verifyToken(token: $token) {
    payload
  }
}`;

export const verifyToken = R.curry((authClient, variables) => authApolloClientMutationRequestTask(
  authClient,
  {mutation: verifyTokenMutation, variables}
));

const refreshTokenMutation = gql`mutation RefreshToken($token: String!) {
  verifyToken(token: $token) {
    payload
  }
}`;

export const refreshToken = R.curry((authClient, variables) => authApolloClientMutationRequestTask(
  authClient,
  {mutation: refreshTokenMutation, variables}
));

/**
 * Expects a GraphQLClient if already authenticated or login data if not
 * @param {String} url The URL to create client with if authentication is not already a GraphQLClient
 * @param {Object} stateLinkResolvers: Resolvers for the stateLink, meaning local caching
 * @param {GraphQLClient|Object} authentication. If a GraphQLClient, a client with authentication already
 * in the header, such as an auth token. If an object, then username and password
 */
export const authClientOrLoginTask = R.curry((url, stateLinkResolvers, authentication) => R.ifElse(
  auth => R.is(ApolloClient, auth),
  // Just wrap it in a task to match the other option
  authClient => of({authClient}),
  R.pipeK(
    // map login values to token
    auth => loginTask(noAuthApolloClient(url, stateLinkResolvers), auth),
    // map userLogin to authApolloClient and token
    auth => authApolloClientTask(url, stateLinkResolvers, R.prop('data', auth))
  )
)(authentication));
