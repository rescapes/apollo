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
import {authClientRequest, noAuthClientRequest, authClientTask} from './client';
import {GraphQLClient} from 'graphql-request';
import {of} from 'folktale/concurrency/task';
import {reqStrPathThrowing} from 'rescape-ramda';

const loginMutation = `mutation TokenAuth($username: String!, $password: String!) {
  tokenAuth(username: $username, password: $password) {
    token
  }
}`;

/**
 * loginTask returning a User and token
 * @param {Object} values
 * @param {String} values.username The username
 * @param {String} values.password The password
 * @return {Task} Returns an object representing a user with a token. This token must
 * be passed to authenticated calls
 */
export const loginTask = values => noAuthClientRequest(
  loginMutation,
  values
);

const verifyTokenMutation = `mutation VerifyToken($token: String!) {
  verifyToken(token: $token) {
    payload
  }
}`;

export const verifyToken = R.curry((authClient, values) => authClientRequest(authClient)(
  verifyTokenMutation,
  values
));

const refreshTokenMutation = `mutation RefreshToken($token: String!) {
  verifyToken(token: $token) {
    payload
  }
}`;

export const refreshToken = R.curry((authClient, values) => authClientRequest(authClient)(
  refreshTokenMutation,
  values
));

/**
 * Expects a GraphQLClient if already authenticated or login data if not
 * @param {GraphQLClient|Object} authentication. If a GraphQLClient, a client with authentication already
 * in the header, such as an auth token. If an object, then username and password
 */
export const authClientOrLoginTask = authentication => R.ifElse(
  R.is(GraphQLClient),
  // Just wrap it in a task to match the other option
  authClient => of({authClient, token: reqStrPathThrowing('options.headers.headers.Authorization', authClient)}),
  R.pipeK(
    // map login values to token
    loginTask,
    // map userLogin to authClient and token
    authClientTask
  )
)(authentication);
