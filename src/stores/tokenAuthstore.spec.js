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

import {
  composeWithChain,
  defaultRunConfig,
  mapToNamedPathAndInputs,
  mapToNamedResponseAndInputs,
  reqStrPathThrowing, strPathOr
} from '@rescapes/ramda';
import {cacheOptions, localTestAuthTask, localTestConfig} from '../helpers/testHelpers.js';
import {defaultStateLinkResolvers} from '../client/stateLink.js';
import {
  defaultSettingsCacheIdProps,
  defaultSettingsCacheOnlyObjs,
  defaultSettingsOutputParams,
  writeDefaultSettingsToCacheContainer
} from '../helpers/defaultSettingsStore.js';
import {parseApiUrl} from '@rescapes/helpers';
import {
  deleteRefreshTokenCookieMutationRequestContainer,
  deleteTokenCookieMutationRequestContainer,
  queryLocalTokenAuthContainer,
  refreshTokenMutationRequestContainer,
  verifyTokenMutationRequestContainer
} from './tokenAuthStore.js';
import {makeSettingsQueryContainer} from '../helpers/settingsStore.js';
import {typePoliciesConfig} from '../config';
import {getOrSetDefaultsContainer} from '../client/apolloClientAuthentication';

const api = reqStrPathThrowing('settings.data.api', localTestConfig);
const uri = parseApiUrl(api);

describe('tokenAuthStore', () => {
  test('testLoginCredentials', done => {
    const errors = [];
    composeWithChain([
      /*
      TODO Server is complaining about this method, which we don't currenlty use
      mapToNamedPathAndInputs(
        'deleteRefreshTokenCookie', 'data.deleteRefreshTokenCookie.deleted',
        ({apolloConfig: {apolloClient}, verifyToken}) => deleteRefreshTokenCookieMutationRequestContainer({apolloClient}, {}, {})
      ),
       */
      mapToNamedPathAndInputs(
        'deleteTokenCookie', 'data.deleteTokenCookie.deleted',
        ({apolloConfig: {apolloClient}, tokenAuth, verifyToken}) => {
          return deleteTokenCookieMutationRequestContainer({apolloClient}, {}, {});
        }
      ),
      mapToNamedPathAndInputs(
        'refreshToken', 'data.refreshToken.payload',
        ({apolloConfig: {apolloClient}, tokenAuth,  verifyToken}) => {
          return refreshTokenMutationRequestContainer({apolloClient}, {}, {token: strPathOr(null, 'data.token', tokenAuth)});
        }
      ),
      mapToNamedPathAndInputs(
        'verifyToken', 'data.verifyToken.payload',
        ({apolloConfig: {apolloClient}, tokenAuth}) => {
          return verifyTokenMutationRequestContainer({apolloClient}, {}, {token: strPathOr(null, 'data.token', tokenAuth)});
        }
      ),
      mapToNamedResponseAndInputs('tokenAuth',
        // This was cached by the login
        ({apolloConfig}) => {
          return queryLocalTokenAuthContainer(apolloConfig, {});
        }
      ),
      mapToNamedPathAndInputs('settings', 'data.settings.0',
        ({apolloConfig}) => {
          return makeSettingsQueryContainer(
            apolloConfig,
            {outputParams: defaultSettingsOutputParams}, {
              key: 'default'
            }
          );
        }
      ),
      mapToNamedResponseAndInputs('user',
        ({apolloConfig: {apolloClient, token}}) => {
          return getOrSetDefaultsContainer({
              apolloConfig: {apolloClient},
              cacheData: apolloClient.cache.data.data,
              cacheOptions: cacheOptions(typePoliciesConfig),
              uri,
              stateLinkResolvers: defaultStateLinkResolvers,
              writeDefaults: writeDefaultSettingsToCacheContainer,
              settingsConfig: {
                cacheOnlyObjs: defaultSettingsCacheOnlyObjs,
                cacheIdProps: defaultSettingsCacheIdProps,
                settingsOutputParams: defaultSettingsOutputParams
              }
            },
            {}
          );
        }
      ),
      mapToNamedResponseAndInputs('apolloConfig',
        () => localTestAuthTask()
      )
    ])({}).run().listen(defaultRunConfig(
      {
        onResolved:
          response => {
            expect(response.apolloConfig).not.toBeNull();
            expect(response.tokenAuth).not.toBeNull();
            expect(response.verifyToken).not.toBeNull();
            expect(response.refreshToken).not.toBeNull();
            expect(response.deleteTokenCookie).not.toBeNull();
            //  expect(response.deleteRefreshTokenCookie).not.toBeNull();
          }
      }, errors, done)
    );
  }, 10000000);

});

