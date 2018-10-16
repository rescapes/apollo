/**
 * Created by Andy Likuski on 2018.07.02
 * Copyright (c) 2018 Andy Likuski
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 */

import {mapObjToValues} from 'rescape-ramda';
import * as R from 'ramda';

/**
 * Creates graphql outputparms from the given object
 * @param {[String|List|Object]} outputParam List, Object, or Scalar containing strings or objects with keys pointing at strings or objects
 * for embedded values. Values should always be camelCased
 * @param {Number} indentLevel recursively increases
 * Example
 * [
 * 'foo',
 * 'bar',
 * {
 *   boat: [
 *     'poopDeck',
 *     {
 *      cabin:
 *         [
 *          'galley'
 *        ]
 *    }
 *  ]
 *}
 *]
 * @returns {String} The output pararms in graphql format
 */
export const formatOutputParams = (outputParam, indentLevel = 0) => {
  const indent = R.join('', R.repeat('\t', indentLevel));
  const v = R.cond([
    // Value is a string, just return it on one line
    [R.is(String),
      value => [
        `${indent}${value}`
      ]
    ],
    [R.is(Array),
      list => R.flatten([
        R.map(item => {
            return `${indent}${formatOutputParams(item, indentLevel + 1)}`;
          }, list
        )
      ])
    ],
    [R.is(Object),
      obj => R.flatten(mapObjToValues(
        (value, key) => {
          return [
            `${indent}${key} {`,
            `${indent}${formatOutputParams(value, indentLevel + 1)}`,
            `${indent}}`
          ];
        },
        obj
      ))
    ],
    // Convert null to .... null
    [R.isNil, () => [
      `${indent}null`
    ]],
    [R.T, () => {
      throw new Error(`Bad outputParam ${outputParam}`);
    }]
  ])(outputParam);

  return R.join(
    '\n',
    v
  );
};

/**
 * Creates graphql inputparams from the given object
 * @param {[String|List|Object]} inputParam List, Object, or Scalar containing strings or objects with keys pointing at strings or objects
 * for embedded values. Values should always be camelCased
 * @param {Number} indentLevel recursively increases
 * Example
 * {
 * foo: 1,
 * bar: 2,
 * {
 *   boat: [
 *     decks: [
 *      'poopDeck',
 *     ],
 *     {
 *      cabin: 'galley'
 *    }
 *  ]
 *}
 *]
 * @returns {String} The input params in graphql format
 */
export const formatInputParams = (inputParam, indentLevel = 0) => {
  const indent = R.join('', R.repeat('\t', indentLevel));
  const v = R.cond([
    [R.is(Array),
      list => [
        `${indent}[`,
        R.join(',\n', R.map(item => {
            return [
              `${indent}${formatInputParams(item, indentLevel + 1)}`
            ];
          }, list
        )),
        `${indent}]`
      ]
    ],
    [R.is(Object),
      obj => [
        // Omit bracets at outer level, since outer level is mutationName(inputVar1: {}, inputVar2, {}, etc)
        R.ifElse(R.equals(0), R.always(''), R.always(`${indent}{`))(indentLevel),
        R.join(',\n', mapObjToValues(
          (value, key) => {
            return [
              `${indent}${key}: ${indent}${formatInputParams(value, indentLevel + 1)}`
            ];
          },
          obj
        )),
        R.ifElse(R.equals(0), R.always(''), R.always(`${indent}}`))(indentLevel),
      ]
    ],
    [R.is(String),
      // Value is string, just return it on one line
      value => [
        `${indent}"${value}"`
      ]
    ],
    [R.is(Number),
      // Value is number, just return it on one line
      value => [
        `${indent}${value}`
      ]
    ],
    // Convert null to .... null
    [R.isNil, () => [
      `${indent}null`
    ]],
    [R.T, () => {
      throw new Error(`Bad outputParam ${inputParam}`);
    }]
  ])(inputParam);

  return R.join(
    '\n',
    v
  );
};

/**
 * Resolve the GraphQL Type to pass to the query params. This
 * @param {String} key The param name. Mapped with inputParamTypeMapper. If a match is found it is used
 * @param {Object} value The param value used to guess the type
 * @return {String} The resolved string
 */
export const resolveGraphQLType = R.curry((inputParamTypeMapper, key, value) => {
  const mappedType = R.prop(key, inputParamTypeMapper);
  return R.cond([
    [R.always(mappedType), R.always(mappedType)],
    [R.is(Number), R.always('Int')],
    // Map directory anything else, for instance String to 'String'
    [R.T, R.type]
  ])(value);
});

