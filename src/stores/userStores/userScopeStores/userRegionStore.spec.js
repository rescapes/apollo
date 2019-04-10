/**
 * Created by Andy Likuski on 2019.01.04
 * Copyright (c) 2019 Andy Likuski
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 */

import {makeUserRegionsQueryContainer, userStateOutputParamsCreator} from './userRegionStore';
import {defaultRunConfig, reqStrPathThrowing, mapToNamedPathAndInputs} from 'rescape-ramda';
import {expectKeysAtStrPath, stateLinkResolvers, testAuthTask, testConfig} from '../../../helpers/testHelpers';
import * as R from 'ramda';
import {makeCurrentUserQueryTask, userOutputParams} from '../userStore';

describe('userRegionStore', () => {
  test('makeUserRegionsQueryContainer', done => {
    const someRegionKeys = ['id', 'key', 'name', 'data'];
    R.composeK(
      ({apolloClient, userId}) => makeUserRegionsQueryContainer(
        {apolloClient},
        null,
        {
          userState: {user: {id: userId}},
          // The sample user is already limited to certain regions. We don't need to limit further
          region: {}
        }
      ),
      mapToNamedPathAndInputs('userId', 'data.currentUser.id',
        ({apolloClient}) => makeCurrentUserQueryTask({apolloClient}, userOutputParams, null)
      ),
      mapToNamedPathAndInputs('apolloClient', 'apolloClient',
        () => testAuthTask
      )
    )().run().listen(defaultRunConfig({
      onResolved:
        response => {
          expectKeysAtStrPath(someRegionKeys, 'data.userRegions.0.region', response);
          done();
        }
    }));
  });

  test('makeUserRegionQueryTaskWithRegionFilter', done => {
    const someRegionKeys = ['id', 'key', 'name', 'data'];
    R.composeK(
      // Filter for regions where the geojson.type is 'FeatureCollection'
      // This forces a separate query on Regions so we can filter by Region
      ({apolloClient, userId}) => makeUserRegionsQueryContainer({apolloClient}, null, {
        userState: {id: parseInt(userId)},
        region: {geojson: {type: 'FeatureCollection'}}
      }),
      ({apolloClient}) => R.map(
        response => ({apolloClient, userId: reqStrPathThrowing('data.currentUser.id', response)}),
        makeCurrentUserQueryTask({apolloClient}, userOutputParams)
      ),
      mapToNamedPathAndInputs('apolloClient', 'apolloClient',
        () => testAuthTask
      )
    )().run().listen(defaultRunConfig({
      onResolved:
        response => {
          expectKeysAtStrPath(someRegionKeys, 'data.userRegions.0.region', response);
          done();
        }
    }));
  });

  test('makeActiveUserRegionQuery', done => {
    const someRegionKeys = ['id', 'key', 'name', 'data'];
    R.composeK(
      ({apolloClient, userId}) => makeUserRegionsQueryContainer({apolloClient}, {user: {id: parseInt(userId)}}, {}),
      ({apolloClient}) => R.map(
        response => ({apolloClient, userId: reqStrPathThrowing('data.currentUser.id', response)}),
        makeCurrentUserQueryTask({apolloClient}, userOutputParams)
      ),
      mapToNamedPathAndInputs('apolloClient', 'apolloClient',
        () => testAuthTask
      )
    )().run().listen(defaultRunConfig({
      onResolved:
        response => {
          expectKeysAtStrPath(someRegionKeys, 'data.userRegions.0.region', response);
          done();
        }
    }));
  });
});