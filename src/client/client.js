/**
 * Created by Andy Likuski on 2018.04.23
 * Copyright (c) 2018 Andy Likuski
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 */

import {GraphQLClient} from 'graphql-request';
import * as R from 'ramda';
import {promiseToTask, reqStrPathThrowing} from 'rescape-ramda';
import { task, of } from 'folktale/concurrency/task';

// TODO move to config settings
const url = 'http://localhost:8000/sop_api/graphql';
export const testAuthorization = {username: "test", password: "testpass"};


/**
 * Creates a graphql client with the given headers
 * @param headers
 * @return {GraphQLClient}
 */
export const client = headers => new GraphQLClient(url, {headers});

/**
 * Non auth client for logging in
 */
const noAuthClient = client({});
/**
 * Wrap a loginClient into a promiseToTask converter
 * @param args
 * @return {*}
 */
export const noAuthClientRequest = (...args) => promiseToTask(noAuthClient.request(...args));

/**
 * Given a token returns a GraphQL client
 * @param authToken
 * @return {GraphQLClient}
 */
export const getAuthClient = authToken => client({
  headers: {
    Authorization: authToken
  }
});

/**
 * Chained task version of getAuthClient
 * Given a userLogin with a tokenAuth.token create the authClient and return it and the token
 * This method is synchronous but returns a Task to be used in API chains
 * @param {Object} userLogin Return value from loginTask() api call
 * @param {Object} userLogin.tokenAuth
 * @param {String} userLogin.tokenAuth.token The user token
 * @return {Task<Object>} Task containing and object with a authClient and token
 */
export const authClientTask = userLogin => {
  const token = reqStrPathThrowing('tokenAuth.token', userLogin);
  return of({token, authClient: getAuthClient(token)});
};

export const authClientRequest = authClient => (...args) => promiseToTask(authClient.request(...args));
