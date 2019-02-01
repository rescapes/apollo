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

import {resolveGraphQLType, formatOutputParams} from './queryHelpers';
import {sampleInputParamTypeMapper, sampleResourceInputParams, sampleReesourceMutationOutputParams} from './sampleData';
import {makeMutation, makeMutationRequestContainer} from './mutationHelpers';
import {sampleStateLinkResolversAndDefaults, testConfig} from './testHelpers';
import {authClientOrLoginTask} from '../auth/login';
import {parseApiUrl} from 'rescape-helpers';
import {defaultRunConfig, reqStrPathThrowing} from 'rescape-ramda';
import * as R from 'ramda';
import moment from 'moment';

describe('mutationHelpers', () => {
  test('makeMutation', () => {
    const result = makeMutation('createSampleResource', sampleInputParamTypeMapper, sampleResourceInputParams, sampleReesourceMutationOutputParams);
    expect(result).toMatchSnapshot();
  });

  test('makeMutationRequestContainer', done => {
    const {settings: {api}} = testConfig;
    const uri = parseApiUrl(api);
    const task = R.composeK(
      ({apolloClient}) => makeMutationRequestContainer(
        {apolloClient},
        {
          name: 'region',
          outputParams: ['id', 'key', 'name', {geojson: [{features: ['type']}]}],
          crud: 'create'
        }
      )(
        {
          key: `test${moment().format('HH-mm-SS')}`,
          name: `Test${moment().format('HH-mm-SS')}`
        }
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
});
