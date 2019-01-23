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

import {makeClientQueryTask, makeQuery, makeQueryForComponentTask, makeQueryTask} from './queryHelpers';
import {sampleInputParamTypeMapper, sampleResourceOutputParams} from './sampleData';
import {authClientOrLoginTask} from '../auth/login';
import {defaultRunConfig, reqStrPathThrowing} from 'rescape-ramda';
import {expectKeysAtStrPath, sampleStateLinkResolversAndDefaults, testAuthTask, testConfig} from './testHelpers';
import {parseApiUrl} from 'rescape-helpers';
import * as R from 'ramda';
import {makeMutationTask} from './mutationHelpers';
import moment from 'moment';
import {mapboxOutputParamsFragment} from '../stores/mapStores/mapboxStore';

describe('queryHelpers', () => {

  test('makeQuery', () => {
    expect(makeQuery('sampleResourceQuery', sampleInputParamTypeMapper, sampleResourceOutputParams)).toMatchSnapshot();
  });

  test('makeQueryTask', done => {
    const {settings: {api}} = testConfig;
    const uri = parseApiUrl(api);
    const task = R.composeK(
      ({apolloClient, region}) => makeQueryTask(
        apolloClient,
        {name: 'region', readInputTypeMapper: {}},
        ['id', 'key', 'name', {geojson: [{features: ['type']}]}],
        {key: region.key}
      ),
      ({apolloClient}) => R.map(
        region => ({apolloClient, region}),
        makeMutationTask(
          apolloClient,
          {name: 'region'},
          ['key'],
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
          expect(R.keys(reqStrPathThrowing('data.region', response))).toEqual(['id', 'key', 'name', 'geojson', '__typename']);
          done();
        }
    }));
  }, 1000);

  test('makeClientQueryTask', done => {
    const task = R.composeK(
      // Query the client to confirm it's in the cache
      ({apolloClient, region}) => makeClientQueryTask(
        apolloClient,
        {name: 'regions', readInputTypeMapper: {}},
        ['id', 'key', 'name', {geojson: [{features: ['type']}]}],
        {key: region.key}
      ),
      // Query to get it in the cache
      ({apolloClient, region}) => R.map(
        () => ({apolloClient, region}),
        makeQueryTask(
          apolloClient,
          {name: 'regions', readInputTypeMapper: {}},
          ['id', 'key', 'name', {geojson: [{features: ['type']}]}],
          {key: region.key}
        )
      ),
      ({apolloClient}) => R.map(
        regionResponse => ({apolloClient, region: reqStrPathThrowing('data.region', regionResponse)}),
        makeMutationTask(
          apolloClient,
          {name: 'region'},
          ['key'],
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
          expect(R.keys(reqStrPathThrowing('data.regions.0', response))).toEqual(['id', 'key', 'name', 'geojson', '__typename']);
          done();
        }
    }));
  }, 1000);

  test('makeClientQueryTaskForSettings', done => {
    const someMapboxKeys = ['viewport'];
    const task = R.composeK(
      // Query the client to confirm it's in the cache
      ({apolloClient}) => makeClientQueryTask(
        apolloClient,
        {name: 'settings', readInputTypeMapper: {}},
        mapboxOutputParamsFragment,
        {}
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
