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

import {formatOutputParams} from './queryHelpers';
import {expectKeys, localTestAuthTask} from './testHelpers';
import {
  composeWithChain,
  defaultRunConfig,
  mapToNamedPathAndInputs,
  mapToNamedResponseAndInputs,
  strPathOr
} from 'rescape-ramda';
import * as R from 'ramda';
import {makeCacheMutation} from './mutationCacheHelpers';
import {defaultSettingsOutputParams} from './defaultSettingsStore';
import {of} from 'folktale/concurrency/task';
import {createSampleSettingsTask} from './settings.sample';
import {makeSettingsQueryContainer} from './settingStore';

// A blend of values from the server and the cache-only values
const someSettingsKeys = ['id', 'key', 'data.api', 'data.overpass', 'data.testAuthorization.username', 'data.mapbox.mapboxAuthentication'];

describe('mutationCacheHelpers', () => {
    test('makeMutationWithClientDirectiveContainerCheckCaching', done => {
      expect.assertions(2);
      const errors = [];
      composeWithChain([
        // See if the all the settings are still in the cache
        mapToNamedPathAndInputs('settings', 'data.settings',
          ({settingsWithoutCacheValues, apolloConfig: {apolloClient}}) => {
            return makeSettingsQueryContainer(
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
        () => localTestAuthTask
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
        mapToNamedPathAndInputs('settings', 'data.settings',
          ({settingsWithoutCacheValues, apolloConfig: {apolloClient}}) => {
            return makeSettingsQueryContainer(
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
            makeCacheMutation(
              apolloConfig,
              {
                name: 'settings',
                // output for the read fragment
                outputParams: defaultSettingsOutputParams
              },
              // Make a nonsense change to cache only data
              createCacheOnlyPropsForSettings(
                R.compose(
                  R.over(
                    R.lensPath(['data', 'mapbox', 'mapboxAuthentication', 'mapboxApiAccessToken']),
                    token => R.concat('happy', token)
                  ),
                  R.head
                )(settingsFromCache)
              )
            );
            return of(null);
          }
        ),
        (apolloConfig) => createSampleSettingsTask(apolloConfig),
        () => localTestAuthTask
      ])().run().listen(defaultRunConfig({
        onResolved:
          ({settings}) => {
            expect(strPathOr(null, '0.data.mapbox.mapboxAuthentication.mapboxApiAccessToken', settings)).toContain('happy');
          }
      }, errors, done));
    }, 100000);
  }
);
