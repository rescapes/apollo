/**
 * Created by Andy Likuski on 2018.05.10
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
 * Creates graphql outputparms from the given list
 * @param {[String|Object]} outputParams List containing strings or objects with keys pointing at strings or objects
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
export const formatOutputParams = (outputParams, indentLevel = 0) => {
    const indent = R.join('', R.repeat('\t', indentLevel));
    return R.join(
      '\n',
      R.map(
        outputParam => R.cond([
          // Value is a string, just return it on one line
          [R.is(String), value => `${indent}${value}`],
          [R.is(Object), param => mapObjToValues(
            (value, key) => {
              return `${indent}${key} {\n${indent}${formatOutputParams(value, indentLevel + 1)}\n${indent}}`;
            },
            param)
          ],
          [R.T, () => {
            throw new Error(`Bad outputParam ${outputParam}`);
          }]
        ])(outputParam),
        outputParams
      )
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
  ])(value)
});

/**
 * Makes the location query based on the queryParams
 * @param {String} queryName
 * @param {Object} inputParamTypeMapper maps Object params paths to the correct input type for the query
 * e.g. { 'data': 'DataTypeRelatedReadInputType' }
 * @param {Object} outputParams
 * @param {Object} queryParams
 */
export const makeQuery = R.curry((queryName, inputParamTypeMapper, outputParams, queryParams) => {

  const resolve = resolveGraphQLType(inputParamTypeMapper);

  // These are the first line parameter definitions of the query, which list the name and type
  const params = R.join(
    ', ',
    mapObjToValues((value, key) => {
      // Map the key to the inputParamTypeMapper value for that key if given
      // This is only needed when value is an Object since it needs to map to a custom graphql inputtype
      return `$${key}: ${resolve(key, value)}!`;
    }, queryParams)
  );
  // These are the second line variables that map parameters to variables
  const variables = R.join(
    ', ',
    mapObjToValues((value, key) => {
      return `${key}: $${key}`;
    }, queryParams)
  );

  return `query(${params}) { 
${queryName}(${variables}) {
  ${formatOutputParams(outputParams)}
  }
}`;
});