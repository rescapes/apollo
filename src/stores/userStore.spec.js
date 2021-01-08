/**
 * Created by Andy Likuski on 2019.01.07
 * Copyright (c) 2019 Andy Likuski
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the 'Software'), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED 'AS IS', WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 */

import {
  composeWithChain,
  defaultRunConfig,
  expectKeysAtPath,
  mapToNamedPathAndInputs,
  mapToNamedResponseAndInputs
} from '@rescapes/ramda';
import {
  authenticatedUserLocalContainer,
  currentUserQueryContainer,
  isAuthenticatedLocal,
  userOutputParams
} from './userStore.js';
import {
  localTestAuthTask,
  localTestConfig,
  localTestNoAuthTask,
  createTestAuthTask,
  createTestNoAuthTask
} from '../helpers/testHelpers.js';
import T from 'folktale/concurrency/task/index.js';
import {queryLocalTokenAuthContainer} from './tokenAuthStore';

const {of} = T;

describe('userStore', () => {
  test('currentUserQueryContainer', done => {
    const someUserKeys = ['id', 'email', 'username'];
    const errors = [];
    composeWithChain([
      ({apolloConfig: {apolloClient, token}}) => {
        return currentUserQueryContainer({apolloClient}, userOutputParams, {token});
      },
      mapToNamedResponseAndInputs('apolloConfig',
        () => localTestAuthTask()
      )
    ])().run().listen(defaultRunConfig({
      onResolved:
        response => {
          expectKeysAtPath(someUserKeys, 'data.currentUser', response);
          done();
        }
    }, errors, done));
  });

  test('currentUserQueryContainerNotAuthorized', done => {
    const errors = [];
    composeWithChain([
      ({apolloConfig}) => {
        // This will skip because we have no tokenAuth to pass
        return currentUserQueryContainer(apolloConfig, userOutputParams, {});
      },
      mapToNamedResponseAndInputs('apolloConfig',
        () => {
          return localTestNoAuthTask();
        }
      )
    ])().run().listen(defaultRunConfig({
      onResolved:
        response => {
          expect(response.data).toBeNull();
          done();
        }
    }, errors, done));
  });

  test('isAuthenticatedLocalContainer', done => {
    const errors = [];
    composeWithChain([
      mapToNamedResponseAndInputs('user',
        ({apolloClient}) => {
          return authenticatedUserLocalContainer({apolloClient}, {});
        }),
      mapToNamedResponseAndInputs('isAuthenticated',
        ({apolloClient}) => {
          return of(
            isAuthenticatedLocal({apolloClient})
          );
        }),
      () => createTestAuthTask(localTestConfig)
    ])().run().listen(defaultRunConfig(
      {
        onResolved:
          ({isAuthenticated, user}) => {
            expect(isAuthenticated).toBe(true);
            expect(user.data.currentUser.id).toBeGreaterThan(0);
          }
      }, errors, done)
    );
  });

  test('isAuthenticatedLocalContainerFalse', done => {
    const errors = [];
    composeWithChain([
      mapToNamedResponseAndInputs('user',
        ({apolloClient}) => {
          return authenticatedUserLocalContainer({apolloClient}, {});
        }),
      mapToNamedResponseAndInputs('isAuthenticated',
        ({apolloClient}) => {
          return of(
            isAuthenticatedLocal({apolloClient})
          );
        }),
      () => createTestNoAuthTask(localTestConfig)
    ])().run().listen(defaultRunConfig(
      {
        onResolved:
          ({isAuthenticated, user}) => {
            expect(isAuthenticated).toBe(false);
            expect(user).toEqual({data: null});
          }
      }, errors, done)
    );
  });

});

