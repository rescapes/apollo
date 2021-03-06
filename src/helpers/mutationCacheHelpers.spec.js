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

import {expectKeys, localTestAuthTask} from './testHelpers.js';
import {
  composeWithChain,
  defaultRunConfig,
  mapToNamedPathAndInputs,
  mapToNamedResponseAndInputs,
  strPathOr
} from '@rescapes/ramda'
import * as R from 'ramda';
import {makeCacheMutation} from './mutationCacheHelpers.js';
import {
  defaultSettingsCacheIdProps,
  defaultSettingsCacheOnlyObjs,
  defaultSettingsOutputParams
} from './defaultSettingsStore.js';
import T from 'folktale/concurrency/task/index.js'
const {of} = T;
import {createSampleSettingsTask} from './defaultSettingsStore.sample.js';
import {
  createCacheOnlyPropsForSettings,
  makeSettingsCacheMutationContainer,
  settingsQueryContainer
} from './settingsStore.js';
import {settingsLocalQueryContainerDefault} from './defaultContainers';

// A blend of values from the server and the cache-only values
const someSettingsKeys = ['id', 'key', 'data.api', 'data.overpass', 'data.testAuthorization.username',
  'data.mapbox.viewport', 'data.mapbox.mapboxAuthentication'
];

describe('mutationCacheHelpers', () => {
    test('makeMutationWithClientDirectiveContainerCheckCaching', done => {
      expect.assertions(2);
      const errors = [];
      composeWithChain([
        // See if the all the settings are still in the cache
        mapToNamedPathAndInputs('settings', 'data.settings',
          ({settingsWithoutCacheValues, apolloConfig: {apolloClient}}) => {
            return settingsQueryContainer(
              {
                apolloClient,
                options: {
                  fetchPolicy: 'cache-only'
                }
              },
              {outputParams: defaultSettingsOutputParams},
              R.pick(['id'], settingsWithoutCacheValues)
            );
          }
        ),
        (apolloConfig) => createSampleSettingsTask(apolloConfig),
        () => localTestAuthTask()
      ])().run().listen(defaultRunConfig({
        onResolved:
          ({settings, settingsFromQuery}) => {
            expectKeys(someSettingsKeys, R.head(settings));
            expectKeys(someSettingsKeys, R.head(settingsFromQuery));
          }
      }, errors, done));
    }, 100000);

    test('makeMutationWithClientDirectiveContainerModifyCacheOnlyValues', done => {
      const errors = [];
      composeWithChain([
        // See if the all correct settings in the cache
        mapToNamedPathAndInputs('settingsWithKey', 'data',
          ({settingsWithoutCacheValues, apolloConfig: {apolloClient}}) => {
            return settingsLocalQueryContainerDefault(
              {
                apolloClient,
              },
              {outputParams: defaultSettingsOutputParams},
              R.pick(['key'], settingsWithoutCacheValues)
            );
          }
        ),
        // See if the all correct settings in the cache
        mapToNamedPathAndInputs('settingsWithId', 'data.settings.0',
          ({settingsWithoutCacheValues, apolloConfig: {apolloClient}}) => {
            return settingsQueryContainer(
              {
                apolloClient,
                options: {
                  fetchPolicy: 'cache-only'
                }
              },
              {outputParams: defaultSettingsOutputParams},
              R.pick(['id'], settingsWithoutCacheValues)
            );
          }
        ),
        // Just update cache-only values like we would on the browser
        mapToNamedResponseAndInputs('void',
          ({settingsFromCache, apolloConfig}) => {
            return makeSettingsCacheMutationContainer(
              apolloConfig,
              {
                // output for the read fragment
                outputParams: defaultSettingsOutputParams,
              },
              // Make a nonsense change to cache only data
              createCacheOnlyPropsForSettings(
                {
                  cacheIdProps: defaultSettingsCacheIdProps,
                  cacheOnlyObjs: defaultSettingsCacheOnlyObjs
                },
                R.compose(
                  R.over(
                    R.lensPath(['data', 'mapbox', 'mapboxAuthentication', 'mapboxApiAccessToken']),
                    token => R.concat('happy', token)
                  ),
                  R.head
                )(settingsFromCache)
              )
            );
          }
        ),
        (apolloConfig) => createSampleSettingsTask(apolloConfig),
        () => localTestAuthTask()
      ])().run().listen(defaultRunConfig({
        onResolved:
          ({settingsWithId, settingsWithKey}) => {
            expect(strPathOr(null, 'data.mapbox.mapboxAuthentication.mapboxApiAccessToken', settingsWithId)).toContain('happy');
            expect(strPathOr(null, 'data.mapbox.mapboxAuthentication.mapboxApiAccessToken', settingsWithKey)).toContain('happy');
          }
      }, errors, done));
    }, 1000000);
  }
);
