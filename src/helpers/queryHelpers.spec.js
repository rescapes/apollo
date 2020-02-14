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

import {makeQuery, makeQueryContainer} from './queryHelpers';
import gql from 'graphql-tag';
import {print} from 'graphql';
import {sampleInputParamTypeMapper, sampleResourceOutputParams} from './sampleData';
import {defaultRunConfig, mapToNamedPathAndInputs} from 'rescape-ramda';
import {localTestAuthTask, testConfig} from './testHelpers';
import * as R from 'ramda';
import {makeMutationRequestContainer} from './mutationHelpers';
import moment from 'moment';

describe('queryHelpers', () => {

  test('makeQuery', () => {
    expect(
      print(
        gql`${makeQuery('sampleResourceQuery', sampleInputParamTypeMapper, sampleResourceOutputParams, {id: 0})}`
      )
    ).toMatchSnapshot();
  });

  test('makeQueryContainer', done => {
    const {settings: {api}} = testConfig;
    const task = R.composeK(
      mapToNamedPathAndInputs('region', 'data.regions.0',
        ({apolloClient, createdRegion}) => makeQueryContainer(
          {apolloClient},
          {
            name: 'regions',
            readInputTypeMapper: {},
            outputParams: ['id', 'key', 'name', {geojson: [{features: ['type']}]}]
          },
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
          {
            key: `test${moment().format('HH-mm-SS')}`,
            name: `Test${moment().format('HH-mm-SS')}`
          }
        )
      ),
      mapToNamedPathAndInputs('apolloClient', 'apolloClient',
        () => localTestAuthTask
      )
    )();
    const errors = [];
    task.run().listen(defaultRunConfig({
        onResolved:
          ({region}) => {
            expect(R.keys(region)).toEqual(['id', 'key', 'name', 'geojson', '__typename']);
            done();
          }
      }, errors, done)
    );
  }, 100000);
});
