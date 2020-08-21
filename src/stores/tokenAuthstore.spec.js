/**
 * Created by Andy Likuski on 2019.01.07
 * Copyright (c) 2019 Andy Likuski
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the 'Software'), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED 'AS IS', WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 */

import {defaultRunConfig, mapToNamedPathAndInputs, reqStrPathThrowing} from 'rescape-ramda';
import * as R from 'ramda';
import {
  cacheOptions, localTestConfig, localTestAuthTask
} from '../helpers/testHelpers';
import {} from '../client/stateLink';
import {
  defaultSettingsCacheIdProps,
  defaultSettingsCacheOnlyObjs,
  defaultSettingsOutputParams,
  writeDefaultSettingsToCache
} from '../helpers/defaultSettingsStore';
import {parseApiUrl} from 'rescape-helpers';
import {refreshTokenContainer, verifyTokenRequestContainer} from './tokenAuthStore';
import {getOrCreateAuthApolloClientWithTokenTask} from '../client/apolloClientAuthentication';
import {defaultStateLinkResolvers} from '../client/stateLink';

const someTokenAuthKeys = ['token'];
const api = reqStrPathThrowing('settings.data.api', localTestConfig);
const uri = parseApiUrl(api);

describe('tokenAuthStore', () => {
  test('testLoginCredentials', done => {
    const errors = [];
    R.composeK(
      mapToNamedPathAndInputs(
        'refreshToken', 'data.refreshToken.payload',
        ({apolloClient, verifyToken, token}) => refreshTokenContainer({apolloClient}, {}, {token})
      ),
      mapToNamedPathAndInputs(
        'verifyToken', 'data.verifyToken.payload',
        ({apolloClient, token}) => {
          return verifyTokenRequestContainer({apolloClient}, {}, {token});
        }
      ),
      mapToNamedPathAndInputs('apolloClient', 'apolloClient',
        ({token}) => {
          return getOrCreateAuthApolloClientWithTokenTask({
              cacheOptions,
              uri,
              stateLinkResolvers: defaultStateLinkResolvers,
              writeDefaults: writeDefaultSettingsToCache,
              settingsConfig: {
                cacheOnlyObjs: defaultSettingsCacheOnlyObjs,
                cacheIdProps: defaultSettingsCacheIdProps,
                settingsOutputParams: defaultSettingsOutputParams
              }
            },
            {tokenAuth: {token}}
          );
        }
      ),
      mapToNamedPathAndInputs('token', 'token',
        () => localTestAuthTask()
      )
    )({}).run().listen(defaultRunConfig(
      {
        onResolved:
          response => {
            expect(response.apolloClient).not.toBeNull();
            expect(response.token).not.toBeNull();
            expect(response.verifyToken).not.toBeNull();
            expect(response.refreshToken).not.toBeNull();
          }
      }, errors, done)
    );
  }, 10000);

});

