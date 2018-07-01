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

import * as R from 'ramda';
import {authClientTask, testAuthorization} from '../client/client';
import {loginTask} from '../auth/login';
import {defaultRunConfig} from 'rescape-ramda';
import {resolveGraphQLType} from './queryHelpers';
import {noAuthClient} from '../client/client';
import {url} from '../sampleConfig';

describe('client', () => {
  test('authClientTask', (done) => {
    const client = noAuthClient(url);
    const login = loginTask(client, testAuthorization);
    R.pipeK(
      R.always(login),
      userLogin => authClientTask(url, userLogin)
    )().run().listen(defaultRunConfig({
        onResolved:
          response => {
            expect(response.token).not.toBeNull();
            expect(response.authClient).not.toBeNull();
            done();
          }
      })
    );
  });

  test('resolveGraphQLType', () => {
    const inputParamTypeMapper = {
      'data': 'DataTypeRelatedReadInputType'
    };
    const resolve = resolveGraphQLType(inputParamTypeMapper);
    expect(resolve('data', {})).toEqual('DataTypeRelatedReadInputType');
    expect(resolve('foo', 23)).toEqual('Int');
    expect(resolve('foo', 'goo')).toEqual('String');
  });
}, 1000);
