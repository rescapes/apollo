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
import {defaultRunConfig, reqStrPathThrowing, mapToNamedPathAndInputs} from 'rescape-ramda';
import {expectKeysAtStrPath, stateLinkResolvers, testAuthTask} from '../../helpers/testHelpers';
import * as R from 'ramda';
import {makeRegionMutationContainer, makeRegionsQueryContainer, regionOutputParams} from './regionStore';
import {createSampleRegionTask} from './regionStore.sample';

const someRegionKeys = ['id', 'key', 'geojson', 'data'];
describe('regionStore', () => {
  test('makeRegionMutationContainer', done => {
    R.composeK(
      ({apolloClient}) => createSampleRegionTask({apolloClient}),
      () => testAuthTask
    )().run().listen(defaultRunConfig({
      onResolved:
        response => {
          expectKeysAtStrPath(someRegionKeys, 'region', response);
          done();
        }
    }));
  });

  test('makeRegionsQueryContainer', done => {
    R.composeK(
      ({apolloClient, region}) => makeRegionsQueryContainer(
        {apolloClient},
        {outputParams: regionOutputParams, propsStructure: {key: ''}},
        null,
        {key: reqStrPathThrowing('key', region)}
      ),
      ({apolloClient}) => createSampleRegionTask({apolloClient}),
      mapToNamedPathAndInputs('apolloClient', 'apolloClient',
        () => testAuthTask
      )
    )().run().listen(defaultRunConfig({
      onResolved:
        response => {
          expectKeysAtStrPath(someRegionKeys, 'data.regions.0', response);
          done();
        }
    }));
  });
});