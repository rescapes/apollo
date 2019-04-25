/**
 * Created by Andy Likuski on 2019.01.07
 * Copyright (c) 2019 Andy Likuski
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 */

import {defaultRunConfig, reqStrPathThrowing, capitalize, mapToNamedPathAndInputs} from 'rescape-ramda';
import {expectKeys, expectKeysAtStrPath, stateLinkResolvers, testAuthTask, testConfig} from '../../helpers/testHelpers';
import * as R from 'ramda';
import {of} from 'folktale/concurrency/task';
import {
  makeCurrentUserQueryContainer, makeUserStateMutationContainer, makeUserStateQueryContainer, userOutputParams,
  userStateMutateOutputParams, userStateOutputParamsFull
} from './userStore';
import {makeRegionMutationContainer, regionOutputParams} from '../scopeStores/regionStore';
import {makeProjectMutationContainer, projectOutputParams} from '../scopeStores/projectStore';

describe('userStore', () => {
  test('makeUserQueryTask', done => {
    const someUserKeys = ['id', 'email', 'username'];
    R.composeK(
      ({apolloClient}) => makeCurrentUserQueryContainer({apolloClient}, userOutputParams, null),
      mapToNamedPathAndInputs('apolloClient', 'apolloClient',
        () => testAuthTask
      )
    )().run().listen(defaultRunConfig({
      onResolved:
        response => {
          expectKeysAtStrPath(someUserKeys, 'data.currentUser', response);
          done();
        }
    }));
  });

  test('makeUserStateQueryContainer', done => {
    const someUserStateKeys = ['user.id', 'data.userRegions.0.region.id'];
    R.composeK(
      ({apolloClient, userId}) => makeUserStateQueryContainer(
        {apolloClient},
        {outputParams: userStateOutputParamsFull},
        null,
        {user: {id: parseInt(userId)}}
      ),
      mapToNamedPathAndInputs('userId', 'data.currentUser.id',
        ({apolloClient}) => makeCurrentUserQueryContainer({apolloClient}, userOutputParams, null)
      ),
      mapToNamedPathAndInputs('apolloClient', 'apolloClient',
        () => testAuthTask
      )
    )().run().listen(defaultRunConfig({
      onResolved:
        response => {
          expectKeysAtStrPath(someUserStateKeys, 'data.userStates.0', response);
          done();
        }
    }));
  });

  test('makeUserStateMutationContainer', done => {
    const someUserStateKeys = ['id', 'data.userRegions.0.region.id', 'data.userProjects.0.project.id'];
    const createInputParams = ({user, region, project}) =>
      ({
        user: {id: parseInt(reqStrPathThrowing('id', user))},
        data: {
          userRegions: [
            {
              region: {
                id: parseInt(reqStrPathThrowing('id', region))
              }
            }
          ],
          userProjects: [
            {
              project: {
                id: parseInt(reqStrPathThrowing('id', project))
              }
            }
          ]
        }
      });

    const mutateUserStateWithProjectAndRegion = ({apolloClient, user, regionKey, projectKey}) => R.composeK(
      // Set the user state of the given user to the region and project
      mapToNamedPathAndInputs('userState', 'data.createUserState.userState',
        ({apolloClient, user, region, project}) => makeUserStateMutationContainer(
          {apolloClient},
          {outputParams: userStateMutateOutputParams},
          null,
          createInputParams({user, region, project})
        )
      ),
      // Create a project
      mapToNamedPathAndInputs('project', 'data.createProject.project',
        ({apolloClient, user, region, projectKey}) => makeProjectMutationContainer(
          {apolloClient},
          {outputParams: projectOutputParams},
          null,
          {
            key: projectKey,
            name: capitalize(projectKey)
          }
        )
      ),
      // Create a region
      mapToNamedPathAndInputs('region', 'data.createRegion.region',
        ({apolloClient, user, regionKey}) => makeRegionMutationContainer(
          {apolloClient},
          {outputParams: regionOutputParams},
          null,
          {
            key: regionKey,
            name: capitalize(regionKey)
          }
        )
      )
    )({apolloClient, user, regionKey, projectKey});

    R.composeK(
      // Set it again. This will wipe out the previous region and project ids
      ({apolloClient, user}) => mutateUserStateWithProjectAndRegion({
        apolloClient,
        user,
        regionKey: 'mars',
        projectKey: 'tharsisVolcanoes'
      }),
      // We user state structure should match what we expect
      ({apolloClient, user, userState}) => {
        expectKeys(someUserStateKeys, userState);
        return of({apolloClient, user});
      },
      // Set the UserState
      ({apolloClient, user}) => mutateUserStateWithProjectAndRegion({
        apolloClient,
        user,
        regionKey: 'earth',
        projectKey: 'shrangrila'
      }),
      mapToNamedPathAndInputs('user', 'data.currentUser',
        ({apolloClient}) => makeCurrentUserQueryContainer({apolloClient}, userOutputParams, null)
      ),
      mapToNamedPathAndInputs('apolloClient', 'apolloClient',
        () => testAuthTask
      )
    )().run().listen(defaultRunConfig({
      onResolved:
        ({userState}) => {
          expectKeys(someUserStateKeys, userState);
          done();
        }
    }));
  });
});