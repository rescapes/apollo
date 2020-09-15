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

import {composeWithChain, defaultRunConfig, expectKeysAtPath, mapToNamedPathAndInputs} from 'rescape-ramda';
import {
  authenticatedUserLocal,
  isAuthenticatedLocal,
  makeCurrentUserQueryContainer,
  userOutputParams
} from './userStore';
import {localTestAuthTask, localTestConfig} from '..';
import {createNoAuthTask} from '../helpers/clientHelpers';
import {of} from 'folktale/concurrency/task';

describe('userStore', () => {
  test('makeCurrentUserQueryContainer', done => {
    const someUserKeys = ['id', 'email', 'username'];
    const errors = [];
    composeWithChain([
      ({apolloClient}) => makeCurrentUserQueryContainer({apolloClient}, userOutputParams, {}),
      mapToNamedPathAndInputs('apolloClient', 'apolloClient',
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

  test('isAuthenticatedLocalContainer', done => {
    const errors = [];
    composeWithChain([
      ({apolloClient}) => {
        return of({
          isAuthenticated: isAuthenticatedLocal({apolloClient}),
          user: authenticatedUserLocal({apolloClient}, {})
        });
      },
      () => localTestAuthTask()
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
      ({apolloClient}) => {
        return of(
          {
            isAuthenticated: isAuthenticatedLocal({apolloClient}),
            user: authenticatedUserLocal({apolloClient},{})
          }
        );
      },
      () => createNoAuthTask(localTestConfig)
    ])().run().listen(defaultRunConfig(
      {
        onResolved:
          ({isAuthenticated, user}) => {
            expect(isAuthenticated).toBe(false);
            expect(user).toBeNull();
          }
      }, errors, done)
    );
  });
});

