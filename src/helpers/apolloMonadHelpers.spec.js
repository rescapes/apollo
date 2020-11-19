/**
 * Created by Andy Likuski on 2020.06.09
 * Copyright (c) 2020 Andy Likuski
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 */

import R from 'ramda';
import Result from 'folktale/result/index.js';
import {
  apolloResponseFilterOrEmpty,
  apolloResponseSingleValueOrNull,
  apolloResponseValueOrNull,
  apolloResult
} from './apolloMonadHelpers.js';
import {ap} from 'ramda/src/index';

describe('apolloMonadHelpers', () => {
  test('apolloResult', () => {
    const apolloLoadingResponse = {
      data: null,
      status: 'loading',
      loading: true,
      error: false
    };
    expect(apolloResult(apolloLoadingResponse)).toEqual(Result.Error(apolloLoadingResponse));

    const apolloDataResponse = {
      data: {queryFoos: [{id: 'f'}, {id: 'o'}, {id: 'oo'}]},
      status: 'data',
      loading: false,
      error: false
    };
    expect(apolloResult(apolloDataResponse)).toEqual(Result.Ok(apolloDataResponse));

    const apolloErrorResponse = {
      data: null,
      status: 'error',
      loading: false,
      error: true
    };
    expect(apolloResult(apolloErrorResponse)).toEqual(Result.Error(apolloErrorResponse));
  });

  test('apolloResponseValueOrNull', () => {
    const apolloDataResponse = {
      data: {foos: [{id: 'f'}, {id: 'o'}, {id: 'oo'}]},
      status: 'data',
      loading: false,
      error: false
    };
    expect(apolloResponseValueOrNull('foos', apolloDataResponse)).toEqual(
      [{id: 'f'}, {id: 'o'}, {id: 'oo'}]
    );

    const apolloLoadingResponse = {
      data: null,
      status: 'loading',
      loading: true,
      error: false
    };
    expect(apolloResponseValueOrNull('foos', apolloLoadingResponse)).toEqual(null);
  });

  test('apolloResponseSingleValueOrNull', () => {
    const apolloDataResponse = {
      data: {foos: [{id: 'f'}, {id: 'o'}, {id: 'oo'}]},
      status: 'data',
      loading: false,
      error: false
    };
    expect(apolloResponseSingleValueOrNull('foos', apolloDataResponse)).toEqual(
      {id: 'f'}
    );
  });

  test('apolloResponseFilterOrEmpty', () => {
    const apolloDataResponse = {
      data: {foos: [{id: 'f'}, {id: 'o'}, {id: 'oo'}]},
      status: 'data',
      loading: false,
      error: false
    };
    expect(apolloResponseFilterOrEmpty(
      'foos',
      foo => R.compose(R.equals(1), R.length, R.prop('id'))(foo),
      apolloDataResponse
    )).toEqual([{id: 'f'}, {id: 'o'}]);
  });
});

