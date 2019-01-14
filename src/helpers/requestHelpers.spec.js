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

import {resolveGraphQLType, formatOutputParams, formatInputParams, responseAsResult} from './requestHelpers';
import Result from 'folktale/result';
import * as R from 'ramda';
import {reqStrPathThrowing, reqStrPath} from 'rescape-ramda';

describe('requestHelpers', () => {

  test('formatOutputParameters', () => {
    const outputParams = [
      'id',
      'name',
      {
        'data': {
          'settings': [
            'defaultLocation',
            {
              'stages': [
                'key',
                'targets'
              ]
            }
          ]
        }
      }
    ];
    const output = formatOutputParams(outputParams);
    expect(output).toMatchSnapshot();
  });

  test('formInputParameters', () => {
    const inputParams = {
      id: 1,
      name: 'Bo',
      data: {
        settings: [
          'defaultLocation',
          {
            'stages': [
              'key',
              'targets'
            ]
          }
        ]
      }
    };
    const input = formatInputParams(inputParams);
    expect(input).toMatchSnapshot();
  });

  test('resolveGraphQLType', () => {
    const inputParamTypeMapper = {
      'data': 'DataTypeRelatedReadInputType'
    };
    const resolve = resolveGraphQLType(inputParamTypeMapper);
    expect(resolve('data', {})).toEqual('DataTypeRelatedReadInputType');
    expect(resolve('foo', 23)).toEqual('Int');
    expect(resolve('foo', 'goo')).toEqual('String');
    expect(resolve('foo', 23.1)).toEqual('Float');
    expect(resolve('foo', Number)).toEqual('Number');
  });

  test('responseAsResult', () => {
    expect(responseAsResult({data: 'superduper'})).toEqual(Result.Ok({data: 'superduper'}));
    expect(responseAsResult({data: {flowing: {nose: 'superduper'}}}, 'flowing.nose', 'nose')).toEqual(Result.Ok({data: {nose: 'superduper'}}));
    const responsePathError = responseAsResult({data: {flowing: {nose: 'superduper'}}}, 'flowing.tooth', 'nose');
    expect(R.length(reqStrPathThrowing('errors', responsePathError.merge()))).toEqual(1);
    const responseError = responseAsResult({errors: [new Error('What the heck?')]});
    expect(R.length(reqStrPathThrowing('errors', responseError.merge()))).toEqual(1);

    // If we have a custom resolver
    expect(responseAsResult(
      {data: {flowings: [{nose: {wipe: 'superduper'}}, {nose: {wipe: 'cavity'}}]}},
      // This demonstrates extracting an embedded array of noses from results
      // Note that it has to return a single Result.Ok
      R.compose(
        R.sequence(Result.Ok),
        result => result.chain(R.map(reqStrPath('nose'))),
        reqStrPath('flowings')
      ),
      'noses'
    )
  ).
    toEqual(Result.Ok({data: {noses: [{wipe: 'superduper'}, {wipe: 'cavity'}]}}));
  });
});
