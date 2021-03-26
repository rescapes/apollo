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

import {cacheOptions, localTestAuthTask, localTestConfig} from '../helpers/testHelpers.js';
import {
  composeWithChain,
  defaultRunConfig, mapToMergedResponseAndInputs,
  mapToNamedResponseAndInputs,
  reqStrPathThrowing,
  strPathOr
} from '@rescapes/ramda';
import {authClientOrLoginTask} from './login.js';
import {parseApiUrl} from '@rescapes/helpers';
import {
  defaultSettingsCacheIdProps,
  defaultSettingsCacheOnlyObjs,
  defaultSettingsOutputParams, defaultSettingsTypenames,
  writeDefaultSettingsToCacheContainer
} from '../helpers/defaultSettingsStore.js';
import {defaultStateLinkResolvers} from '../client/stateLink.js';
import {createTestAuthTask, createTestNoAuthTask} from '../helpers/testHelpers.js';
import {currentUserQueryContainer, userOutputParams} from '../stores/userStore.js';
import {typePoliciesConfig} from '../config';
import {queryLocalTokenAuthContainer} from '../stores/tokenAuthStore';

const api = reqStrPathThrowing('settings.data.api', localTestConfig);
const uri = parseApiUrl(api);

describe('login', () => {

  test('authClientOrLoginTask', done => {
    const errors = [];
    // Try it with login info
    const task = composeWithChain([
      // Try it with an auth client
      mapToNamedResponseAndInputs('apolloConfig2',
        ({apolloConfig}) => {
          return authClientOrLoginTask({
            cacheOptions: cacheOptions(typePoliciesConfig),
            uri,
            stateLinkResolvers: defaultStateLinkResolvers,
            writeDefaults: writeDefaultSettingsToCacheContainer,
            settingsConfig: {
              cacheOnlyObjs: defaultSettingsCacheOnlyObjs,
              cacheIdProps: defaultSettingsCacheIdProps,
              settingsOutputParams: defaultSettingsOutputParams,
              defaultSettingsTypenames
            }
          }, apolloConfig.apolloClient);
        }
      ),
      mapToMergedResponseAndInputs(
        () => {
          return authClientOrLoginTask({
              cacheOptions: cacheOptions(typePoliciesConfig),
              uri,
              stateLinkResolvers: defaultStateLinkResolvers,
              writeDefaults: writeDefaultSettingsToCacheContainer,
              settingsConfig: {
                cacheOnlyObjs: defaultSettingsCacheOnlyObjs,
                cacheIdProps: defaultSettingsCacheIdProps,
                settingsOutputParams: defaultSettingsOutputParams,
                defaultSettingsTypenames
              }
            },
            reqStrPathThrowing('settings.data.testAuthorization', localTestConfig)
          );
        })
    ])();
    task.run().listen(
      defaultRunConfig(
        {
          onResolved: ({apolloConfig, apolloConfig2}) => {
            expect(apolloConfig).toBeTruthy()
            expect(apolloConfig2).toBeTruthy()
            done();
          }
        }, errors, done
      )
    );
  }, 10000);

  test('createNoAuthTask', done => {
    const errors = [];
    createTestNoAuthTask(localTestConfig).run().listen(defaultRunConfig(
      {
        onResolved:
          response => {
            expect(response.apolloClient).not.toBeNull();
            done();
          }
      }, errors, done)
    );
  }, 10000);

  test('loginToAuthClientTask', done => {
    const errors = [];
    composeWithChain([
      mapToNamedResponseAndInputs('user',
        ({apolloConfig, tokenAuth}) => {
          // Make sure we
          return currentUserQueryContainer(
            apolloConfig,
            userOutputParams,
            {token: strPathOr(null, 'result.data.tokenAuth.token', tokenAuth)}
          );
        }
      ),
      mapToNamedResponseAndInputs('tokenAuth',
        ({apolloConfig}) => {
          return queryLocalTokenAuthContainer(apolloConfig, {});
        }
      ),
      mapToNamedResponseAndInputs('apolloConfig',
        () => {
          // Authorize, this puts the auth token in local storage and the apolloClient reads it
          return localTestAuthTask();
        }
      ),
      mapToNamedResponseAndInputs('noAuthUser',
        apolloConfig => {
          // This will skip because we have no auth token to pass
          return currentUserQueryContainer(
            apolloConfig,
            userOutputParams,
            {}
          );
        }
      ),
      () => {
        return createTestNoAuthTask(localTestConfig);
      }
    ])().run().listen(defaultRunConfig(
      {
        onResolved:
          response => {
            expect(response.noAuthUser.data).toBeNull();
            expect(response.user.data.currentUser).not.toBeNull();
            expect(response.apolloConfig.apolloClient).not.toBeNull();
            expect(response.apolloConfig.token).not.toBeNull();
            done();
          }
      }, errors, done)
    );
  }, 100000);

  test('noLoginToAuthClientTask', done => {
    const errors = [];
    createTestNoAuthTask(localTestConfig).run().listen(defaultRunConfig({
        onResolved:
          response => {
            expect(response.apolloClient).not.toBeNull();
            done();
          }
      }, errors, done)
    );
  }, 10000);
});
