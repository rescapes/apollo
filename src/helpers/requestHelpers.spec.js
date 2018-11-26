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

import {resolveGraphQLType, formatOutputParams, formatInputParams} from './requestHelpers';

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
    }
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
}, 1000);
