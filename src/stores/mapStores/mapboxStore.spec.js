import {expectKeysAtStrPath, testAuthTask} from '../../helpers/testHelpers';
import {makeCurrentUserQueryTask, userOutputParams} from '../userStores/userStore';
import {makeMapboxesQueryTask} from '../mapStores/mapboxStore';
import {graphql} from 'graphql';
import * as R from 'ramda';
import {v} from 'rescape-validate';
import {waitAll} from 'folktale/concurrency/task';
import {reqStrPathThrowing, defaultRunConfig} from 'rescape-ramda';
import {mapboxOutputParamsFragment} from './mapboxStore';
import {makeUserRegionsQueryTask} from '../userStores/userScopeStores/userRegionStore';
import {makeUserProjectsQueryTask} from '../userStores/userScopeStores/userProjectStore';

/**
 * Created by Andy Likuski on 2018.12.31
 * Copyright (c) 2018 Andy Likuski
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 */
describe('mapboxStore', () => {
  test('makeMapboxStore', done => {
    const someMapboxKeys = ['viewport'];
    R.composeK(
      ({apolloClient, userId, regionId, projectId}) => makeMapboxesQueryTask(
        apolloClient,
        mapboxOutputParamsFragment,
        {
          users: {id: parseInt(userId)},
          regions: {id: parseInt(regionId)},
          projects: {id: parseInt(projectId)},
        },
      ),
      ({apolloClient, userId, regionId}) => R.map(
        response => ({apolloClient, userId, regionId, projectId: reqStrPathThrowing('data.userProjects.0.project.id', response)}),
        makeUserProjectsQueryTask(apolloClient, {user: {id: userId}}, {})
      ),
      ({apolloClient, userId}) => R.map(
        response => ({apolloClient, userId, regionId: reqStrPathThrowing('data.userRegions.0.region.id', response)}),
        makeUserRegionsQueryTask(apolloClient, {user: {id: userId}}, {})
      ),
      ({apolloClient}) => R.map(
        response => ({apolloClient, userId: reqStrPathThrowing('data.currentUser.id', response)}),
        makeCurrentUserQueryTask(apolloClient, userOutputParams)
      ),
      () => testAuthTask
    )().run().listen(defaultRunConfig({
      onResolved:
        response => {
          expectKeysAtStrPath(someMapboxKeys, 'data.mapboxs.0.region', response);
          done();
        }
    }));
  });
});