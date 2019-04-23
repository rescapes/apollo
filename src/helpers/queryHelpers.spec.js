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

import {makeQueryContainer, makeQuery, makeQueryForComponentTask} from './queryHelpers';
import {sampleInputParamTypeMapper, sampleResourceOutputParams} from './sampleData';
import {authClientOrLoginTask} from '../auth/login';
import {defaultRunConfig, reqStrPathThrowing, mapToNamedPathAndInputs} from 'rescape-ramda';
import {expectKeysAtStrPath, testStateLinkResolversAndDefaults, testAuthTask, testConfig} from './testHelpers';
import {parseApiUrl} from 'rescape-helpers';
import * as R from 'ramda';
import {makeMutationRequestContainer} from './mutationHelpers';
import moment from 'moment';
import {mapboxOutputParamsFragment} from '../stores/mapStores/mapboxStore';

describe('queryHelpers', () => {

  test('makeQuery', () => {
    expect(makeQuery('sampleResourceQuery', sampleInputParamTypeMapper, sampleResourceOutputParams)).toMatchSnapshot();
  });

  test('makeQueryContainer', done => {
    const {settings: {api}} = testConfig;
    const uri = parseApiUrl(api);
    const task = R.composeK(
      mapToNamedPathAndInputs('region', 'data.regions.0',
        ({apolloClient, createdRegion}) => makeQueryContainer(
          {apolloClient},
          {
            name: 'regions',
            readInputTypeMapper: {},
            outputParams: ['id', 'key', 'name', {geojson: [{features: ['type']}]}]
          },
          null,
          {key: createdRegion.key}
        )
      ),
      mapToNamedPathAndInputs('createdRegion', 'data.createRegion.region',
        ({apolloClient}) => makeMutationRequestContainer(
          {apolloClient},
          {
            name: 'region',
            outputParams: ['key']
          },
          null,
          {
            key: `test${moment().format('HH-mm-SS')}`,
            name: `Test${moment().format('HH-mm-SS')}`
          }
        )
      ),
      mapToNamedPathAndInputs('apolloClient', 'apolloClient',
        () => testAuthTask
      )
    )();
    task.run().listen(defaultRunConfig({
      onResolved:
        ({region}) => {
          expect(R.keys(region)).toEqual(['id', 'key', 'name', 'geojson', '__typename']);
          done();
        }
    }));
  }, 1000);
});
