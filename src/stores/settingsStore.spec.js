/**
 * Created by Andy Likuski on 2019.01.15
 * Copyright (c) 2019 Andy Likuski
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 */
import {defaultRunConfig, mapToNamedPathAndInputs} from 'rescape-ramda';
import {expectKeys, expectKeysAtStrPath, stateLinkResolvers, localTestAuthTask} from '../helpers/testHelpers';
import * as R from 'ramda';
import {makeSettingsMutationContainer, makeSettingssQueryContainer, settingsOutputParams} from './settingsStore';
import {createSampleSettingsTask} from './settingsStore.sample';

const someSettingsKeys = ['id', 'key', 'data.api', 'data.overpass', 'data.mapbox'];
describe('settingsStore', () => {
  test('makeSettingsMutationContainer', done => {
    R.composeK(
      mapToNamedPathAndInputs(
        'settings',
        'cacheOnlySettings',
        ({apolloClient}) => createSampleSettingsTask({apolloClient})
      ),
      () => localTestAuthTask
    )().run().listen(defaultRunConfig({
      onResolved:
        ({settings}) => {
          expectKeys(someSettingsKeys, settings);
          done();
        }
    }));
  });

  test('makeSettingssQueryContainer', done => {
    R.composeK(
      ({apolloClient}) => makeSettingssQueryContainer(
        {apolloClient},
        {outputParams: settingsOutputParams},
        null,
        // No arguments needed to query settings
        {}
      ),
      ({apolloClient}) => createSampleSettingsTask({apolloClient}),
      mapToNamedPathAndInputs('apolloClient', 'apolloClient',
        () => localTestAuthTask
      )
    )().run().listen(defaultRunConfig({
      onResolved:
        response => {
          expectKeysAtStrPath(someSettingsKeys, 'data.settingss.0', response);
          done();
        }
    }));
  });


});