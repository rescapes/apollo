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

import {makeQueryContainer, makeQuery} from './queryHelpers';
import {sampleInputParamTypeMapper, sampleResourceOutputParams} from './sampleData';
import {authClientOrLoginTask} from '../auth/login';
import {defaultRunConfig, reqStrPathThrowing, mapToNamedPathAndInputs} from 'rescape-ramda';
import {expectKeysAtStrPath, sampleStateLinkResolversAndDefaults, testAuthTask, testConfig} from './testHelpers';
import {parseApiUrl} from 'rescape-helpers';
import * as R from 'ramda';
import {makeMutationRequestContainer} from './mutationHelpers';
import moment from 'moment';
import {mapboxOutputParamsFragment} from '../stores/mapStores/mapboxStore';
import {makeQueryFromCacheContainer, makeQueryWithClientDirectiveContainer} from './queryCacheHelpers';

describe('queryCacheHelpers', () => {

  test('makeQuery', () => {
    expect(makeQuery('sampleResourceQuery', sampleInputParamTypeMapper, sampleResourceOutputParams)).toMatchSnapshot();
  });

  test('makeQueryContainer', done => {
    const {settings: {api}} = testConfig;
    const uri = parseApiUrl(api);
    const task = R.composeK(
      ({apolloClient, region}) => makeQueryContainer(
        {apolloClient},
        {
          name: 'regions',
          readInputTypeMapper: {},
          outputParams: ['id', 'key', 'name', {geojson: [{features: ['type']}]}]
        },
        null,
        {key: region.key}
      ),
      mapToNamedPathAndInputs('region', 'data.createRegion.region',
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
      () => authClientOrLoginTask(uri, sampleStateLinkResolversAndDefaults, reqStrPathThrowing('settings.testAuthorization', testConfig))
    )();
    task.run().listen(defaultRunConfig({
      onResolved:
        response => {
          expect(R.keys(reqStrPathThrowing('data.regions.0', response))).toEqual(['id', 'key', 'name', 'geojson', '__typename']);
          done();
        }
    }));
  }, 1000);

  test('makeQueryWithClientDirectiveContainer', done => {
    const task = R.composeK(
      // Query the client to confirm it's in the cache
      ({apolloClient, region}) => makeQueryWithClientDirectiveContainer(
        {apolloClient},
        {
          name: 'regions',
          readInputTypeMapper: {},
          outputParams: ['id', 'key', 'name', {geojson: [{features: ['type']}]}]
        },
        null,
        {key: region.key}
      ),
      // Direct cache read as a sanity check
      mapToNamedPathAndInputs(
        'regionFromCache', 'regions.0,',
        ({apolloClient, region}) => makeQueryFromCacheContainer(
          {apolloClient},
          {
            name: 'regions',
            readInputTypeMapper: {},
            outputParams: ['id', 'key', 'name', {geojson: [{features: ['type']}]}]
          },
          null,
          {key: region.key}
        )
      ),
      // Query to get it in the cache
      mapToNamedPathAndInputs(
        'regionAgain', 'data.regions.0,',
        ({apolloClient, region}) => makeQueryContainer(
          {apolloClient},
          {
            name: 'regions',
            readInputTypeMapper: {},
            outputParams: ['id', 'key', 'name', {geojson: [{features: ['type']}]}]
          },
          null,
          {key: region.key}
        )
      ),
      ({apolloClient}) => R.map(
        regionResponse => ({apolloClient, region: reqStrPathThrowing('data.createRegion.region', regionResponse)}),
        makeMutationRequestContainer(
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
      () => testAuthTask
    )();
    task.run().listen(defaultRunConfig({
      onResolved:
        response => {
          expect(
            R.keys(reqStrPathThrowing('data.regions.0', response))
          ).toEqual(
            ['id', 'key', 'name', 'geojson', '__typename']
          );
          done();
        }
    }));
  }, 1000);

  test('makeQueryContainerForSettings', done => {
    const someMapboxKeys = ['viewport'];
    const task = R.composeK(
      // Query the client to confirm it's in the cache
      ({apolloClient}) => makeQueryContainer(
        {apolloClient},
        {name: 'settings', readInputTypeMapper: {}},
        null,
        mapboxOutputParamsFragment
      ),
      () => testAuthTask
    )();
    task.run().listen(defaultRunConfig({
      onResolved:
        response => {
          expectKeysAtStrPath(someMapboxKeys, 'data.settings.mapbox', response);
          done();
        }
    }));
  }, 1000);
});
