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
import {localTestAuthTask, expectKeys} from './testHelpers';
import {defaultRunConfig, mapToNamedPathAndInputs} from 'rescape-ramda';
import * as R from 'ramda';
import {makeMutationWithClientDirectiveContainer} from './mutationCacheHelpers';
import {createSampleSettingsTask} from './samples/sampleSettingsStore';

// A blend of values from the server and the cache-only values
const someSettingsKeys = ['id', 'key', 'data.api', 'data.overpass', 'data.testAuthorization.username'];

describe('mutationCacheHelpers', () => {
    test('makeMutationWithClientDirectiveContainer', done => {
      expect.assertions(1);
      const errors = [];
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
          }
      }, errors, done));
    }, 100000);
  }
);
