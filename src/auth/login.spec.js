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
import {testAuthTask, testConfig} from '../helpers/testHelpers';
import {authApolloClientTask, noAuthApolloClient} from '../client/apolloClient';
import {reqStrPathThrowing} from 'rescape-ramda';
import {refreshTokenContainer, verifyTokenRequestContainer, authClientOrLoginTask, loginToAuthClientTask} from './login';
import {defaultRunConfig, mapToNamedPathAndInputs} from 'rescape-ramda';
import {parseApiUrl} from 'rescape-helpers';
import {sampleStateLinkResolversAndDefaults} from '../helpers/testHelpers';

const {settings: {api}} = testConfig;
const uri = parseApiUrl(api);

describe('login', () => {
  test('testLoginCredentials', done => {

    R.composeK(
      mapToNamedPathAndInputs(
        'refreshToken', 'data.refreshToken.payload',
        ({apolloClient, verifyToken, token}) => refreshTokenContainer({apolloClient}, null, {token})
      ),
      mapToNamedPathAndInputs(
        'verifyToken', 'data.verifyToken.payload',
        ({apolloClient, token}) => verifyTokenRequestContainer({apolloClient}, null, {token})
      ),
      ({token}) => authApolloClientTask(
        uri,
        sampleStateLinkResolversAndDefaults,
        {tokenAuth: {token}}
      ),
      () => testAuthTask
    )().run().listen(defaultRunConfig(
      {
        onResolved:
          response => {
            expect(response.apolloClient).not.toBeNull();
            expect(response.token).not.toBeNull();
            expect(response.verifyToken).not.toBeNull();
            expect(response.refreshToken).not.toBeNull();
            done();
          }
      })
    );
  });

  test('authClientOrLoginTask', done => {
    // Try it with login info
    const task = authClientOrLoginTask(uri, sampleStateLinkResolversAndDefaults, reqStrPathThrowing('settings.testAuthorization', testConfig));
    task.run().listen(defaultRunConfig(
      {
        onResolved: ({token, apolloClient}) => {
          // Try it with an auth client
          authClientOrLoginTask(uri, sampleStateLinkResolversAndDefaults, apolloClient).run().listen(defaultRunConfig(
            {
              onResolved: ({token, apolloClient: apolloClient2}) => {
                expect(apolloClient).toEqual(apolloClient2);
                done();
              }
            })
          );
        }
      }
    ));
  });

  test('loginToAuthClientTask', done => {

    loginToAuthClientTask(uri, sampleStateLinkResolversAndDefaults, reqStrPathThrowing('settings.testAuthorization', testConfig)).run().listen(defaultRunConfig(
      {
        onResolved:
          response => {
            expect(response.apolloClient).not.toBeNull();
            expect(response.token).not.toBeNull();
            done();
          }
      })
    );
  });
});
