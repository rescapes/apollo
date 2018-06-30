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

import * as R from 'ramda';
import {authClientTask, testAuthorization} from './client';
import {reqStrPathThrowing} from 'rescape-ramda';
import {loginTask, refreshToken, verifyToken, authClientOrLoginTask} from './login';
import {defaultRunConfig} from 'rescape-ramda';

describe('loginTask', () => {
  test('testAuthorization', (done) => {

    const login = loginTask(testAuthorization);

    const verifyTokenTask = (authClient, {token}) => R.map(
      // Map the token info to the authClient and token for chaining
      verify => ({
        authClient,
        token,
        payload: reqStrPathThrowing('verifyToken.payload', verify)
      }),
      verifyToken(authClient, {token})
    );
    const refreshTokenTask = (authClient, {token}) => R.map(
      // Map the token info to the authClient and token for chaining
      verify => ({
        authClient,
        token,
        payload: reqStrPathThrowing('verifyToken.payload', verify)
      }),
      refreshToken(authClient, {token})
    );


    R.pipeK(
      R.always(login),
      userLogin => authClientTask(userLogin),
      ({authClient, token}) => verifyTokenTask(authClient, {token}),
      ({authClient, token}) => refreshTokenTask(authClient, {token})
    )().run().listen(defaultRunConfig(
      {
        onResolved:
          response => {
            expect(response.authClient).not.toBeNull();
            expect(response.token).not.toBeNull();
            expect(response.payload).not.toBeNull();
            done();
          }
      })
    );
  });

  test('authClientOrLoginTask', (done) => {
    // Try it with login info
    authClientOrLoginTask(testAuthorization).run().listen(defaultRunConfig(
      {
        onResolved: ({token, authClient}) => {
          // Try it with an auth client
          authClientOrLoginTask(authClient).run().listen(defaultRunConfig(
            {
              onResolved: ({token, authClient: authClient2}) => {
                expect(authClient).toEqual(authClient2)
                done()
              }
            })
          )
        }
      }
    ))
  });
}, 1000);
