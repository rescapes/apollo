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

import {makeQueryContainer} from './queryHelpers';
import {defaultRunConfig, reqStrPathThrowing, mapToNamedPathAndInputs} from '@rescapes/ramda'
import {expectKeys, localTestAuthTask} from './testHelpers';
import R from 'ramda';
import {makeMutationRequestContainer} from './mutationHelpers';
import moment from 'moment';
import {makeQueryFromCacheContainer} from './queryCacheHelpers';
import T from 'folktale/concurrency/task'
const {of} = T

describe('queryCacheHelpers', () => {

  test('testCachedQuery', done => {
    const task = R.composeK(
      // Query normally to confirm it's in the cache
      // We use fetchPolicy: 'cache-only' to force this. I assume this works but can't verify
      ({apolloClient, region}) => makeQueryContainer(
        {apolloClient, fetchPolicy: 'cache-only'},
        {
          name: 'regions',
          readInputTypeMapper: {},
          outputParams: {
            id: 1,
            key: 1,
            name: 1,
            geojson: {
              features: {
                type: 1
              }
            }
          }
        },
        {key: region.key}
      ),
      // Direct cache read as a sanity check
      mapToNamedPathAndInputs(
        'regionFromCache', 'data.regions.0,',
        ({apolloClient, region}) => of(makeQueryFromCacheContainer(
          {apolloClient},
          {
            name: 'regions',
            readInputTypeMapper: {},
            outputParams: {
              id: 1,
              key: 1,
              name: 1,
              geojson: {
                features: {
                  type: 1
                }
              }
            }
          },
          {key: region.key}
        ))
      ),
      // Query to get it in the cache
      mapToNamedPathAndInputs(
        'regionAgain', 'data.regions.0,',
        ({apolloClient, region}) => makeQueryContainer(
          {apolloClient},
          {
            name: 'regions',
            readInputTypeMapper: {},
            outputParams: {
              id: 1,
              key: 1,
              name: 1,
              geojson: {
                features: {
                  type: 1
                }
              }
            }
          },
          {key: region.key}
        )
      ),
      ({apolloClient}) => R.map(
        regionResponse => ({apolloClient, region: reqStrPathThrowing('data.createRegion.region', regionResponse)}),
        makeMutationRequestContainer(
          {apolloClient},
          {
            name: 'region',
            outputParams: {id: 1, key: 1}
          },
          {
            key: `test${moment().format('HH-mm-SS')}`,
            name: `Test${moment().format('HH-mm-SS')}`
          }
        )
      ),
      () => localTestAuthTask()
    )();
    const errors = [];
    task.run().listen(defaultRunConfig({
      onResolved:
        response => {
          expectKeys(
            ['id', 'key', 'name', 'geojson', '__typename'],
            reqStrPathThrowing('data.regions.0', response)
          );
        }
    }, errors, done));
  }, 100000);
});
