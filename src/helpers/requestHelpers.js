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

import {mapObjToValues, reqStrPath, pickDeepPaths} from 'rescape-ramda';
import * as R from 'ramda';
import Result from 'folktale/result';
import {convertToGraphqlStructure, convertFromGraphqlStructure} from 'rescape-helpers';
import {print} from 'graphql';
import gql from 'graphql-tag';

/**
 * TOOD Replace the input array format with objects since js objects are deterministic
 * Creates graphql output params from the given object.
 * @param {[String|List|Object]} outputParam List, Object, or Scalar containing strings or objects with keys pointing at strings or objects
 * for embedded values. Values should always be camelCased
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
 * @returns {String} The output params in graphql format
 */
export const formatOutputParams = (outputParam) => {
  // TODO can we format here?
  return _formatOutputParams(outputParam);
};

export const _formatOutputParams = (outputParam) => {
  const v = R.cond([
    // Value is a string or number, just return it on one line
    [R.either(R.is(String), R.is(Number)),
      value => [
        `${value}`
      ]
    ],
    [R.is(Array),
      list => R.flatten([
        R.map(item => {
            return `${_formatOutputParams(item)}`;
          }, list
        )
      ])
    ],
    [R.is(Object),
      obj => R.flatten(mapObjToValues(
        (value, key) => {
          return [
            `${key} {`,
            `${_formatOutputParams(value)}`,
            `}`
          ];
        },
        obj
      ))
    ],
    // Convert null to .... null
    [R.isNil, () => [
      'null'
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
 * @param {boolean} omitOuterBraces omit braces on the first level of recursion. Only needed for embedded input args,
 * not for variable args
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
export const formatInputParams = (inputParam, omitOuterBraces = false, indentLevel = 0) => {
  const indent = R.join('', R.repeat('\t', indentLevel));
  const v = R.cond([
    [R.is(Array),
      list => [
        `${indent}[`,
        R.join(',\n', R.map(item => {
            return [
              `${indent}${formatInputParams(item, omitOuterBraces, indentLevel + 1)}`
            ];
          }, list
        )),
        `${indent}]`
      ]
    ],
    [R.is(Object),
      obj => [
        // Omit bracets at outer level, since outer level is mutationName(inputVar1: {}, inputVar2, {}, etc)
        R.ifElse(R.both(R.equals(0), R.always(omitOuterBraces)), R.always(''), R.always(`${indent}{`))(indentLevel),
        R.join(',\n', mapObjToValues(
          (value, key) => {
            return [
              `${indent}${key}: ${indent}${formatInputParams(value, omitOuterBraces, indentLevel + 1)}`
            ];
          },
          obj
        )),
        R.ifElse(R.both(R.equals(0), R.always(omitOuterBraces)), R.always(''), R.always(`${indent}}`))(indentLevel)
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
 * Resolve the GraphQL Type to pass to the query params.
 * TODO. This should be replaced with reading the schema from the server and using it to derive types
 * @param {String} key The param name. Mapped with inputParamTypeMapper. If a match is found it is used
 * @param {Object} value The param value used to guess the type. This can also be a type if the value isn't known
 * ahead of creating the query, such as Number of String
 * @return {String} The resolved string
 */
export const resolveGraphQLType = R.curry((inputParamTypeMapper, key, value) => {
  const mappedType = R.prop(key, inputParamTypeMapper);
  return R.cond([
    [R.always(mappedType), R.always(mappedType)],
    [Number.isInteger, R.always('Int')],
    [R.is(Number), R.always('Float')],
    // Assume functions are indicating types, e.g. Number, String
    // Construct the type and return it's type. Thus String => 'String', Number => 'Number'
    // There is currently no way to produce other types like Float.
    [R.is(Function), type => R.type(type())],
    // If we have an array look at the first item and resolve its type recursively and wrap it in [...]
    [R.is(Array), type => `[${resolveGraphQLType(inputParamTypeMapper, key, R.head(type))}]`],
    // Map directory anything else, for instance String to 'String'
    [R.T, R.type]
  ])(value);
});


/**
 * Runs a query task that resolves to {data: {[query|mutationName]: ...}} or {errors: []}. Then
 * process that to return a Result.Ok if there is a day and a Result.Error if there is an error
 * @param {Object} queryTask Contains {data: ...} or {errors: ...}
 * @param {String|Function} stringPathOrResolver The path to the desired value within the response.data property.
 * If just response.data is desired, leave stringPath and queryName blank. If a function then it expects
 * response.data and returns a Result.Ok with the desired values or Result.Error if values aren't found where expected
 * @param {String} queryName The name of the query to use for the result data structure
 * @return {Task<Result>} Task with Result.Ok with value in {data: {[queryName]: value}} or Result.Error instance
 * If stringPath and queryName are omited, the result Result.Ok just wraps response
 */
export const mapQueryTaskToNamedResultAndInputs = (queryTask, stringPathOrResolver = null, queryName = null) => R.map(
  R.ifElse(
    R.has('errors'),
    Result.Error,
    R.ifElse(
      R.always(R.isNil(stringPathOrResolver)),
      // If stringPath is not specified just wrap response in Result.Ok
      Result.Ok,
      // Otherwise extract the desired value and put it in {data: [queryName]: ...}}
      r => (R.ifElse(
        R.always(R.is(Function, stringPathOrResolver)),
        // If stringPathOrResolver is a function call it on response.data, expect it to return a Result.Ok
        R.chain(stringPathOrResolver),
        // If it's a string call reqStrPath, expecting a Result.Ok
        R.chain(reqStrPath(stringPathOrResolver))
      )(reqStrPath('data', r))).map(
        v => ({data: {[queryName]: v}})
      ).mapError(
        // If our path is incorrect, this is probably a coding error, but put it in errors
        error => ({errors: [new Error(`Only resolved ${R.join('.', error.resolved)} of ${R.join('.', error.path)} for response ${JSON.stringify(r)}`)]})
      )
    )
  )
)(queryTask);

/**
 * Converts string ids to int. This is needed because Apollo returns strings but expects ints
 * @param {Object} obj The object with a string id
 * @returns {Object} obj The object with an int id
 */
export const objIdToInt = obj => R.over(R.lensProp('id'), parseInt, obj);


/***
 * Picks attributes out of a graphqlListStructure
 * @param {[String]} paths Dot-separated paths that point at the desired attributes. If the path ends
 * at a non-node it will capture everything at the path.
 * @param {[Object|String]} graphqlListStructure
 * @returns {[Object|String]} The pruned graphqlListStructure
 */
export const pickGraphqlPaths = (paths, graphqlListStructure) => {
  const input = convertFromGraphqlStructure(graphqlListStructure);
  const modified = pickDeepPaths(
    paths,
    input
  );
  return convertToGraphqlStructure(modified);
};

/**
 * Like pickGraphqlPaths put starts at the level of lensPath so only values at a certain key are considered for
 * picking. All other values not matching the lens are left alone and returned
 * @param {Function} lens The lens to the part of the data structure that you want to pick values out of
 * @param {[String]} paths Dot-separated paths that point at the desired attributes. If the path ends
 * at a non-node it will capture everything at the path.
 * @param {[Object|String]} graphqlListStructure
 * @returns {[Object|String]} The pruned graphqlListStructure
 */
export const pickGraphqlPathsOver = (lens, paths, graphqlListStructure) => R.compose(
  convertToGraphqlStructure,
  R.over(
    lens,
    data => {
      const minimumData = pickDeepPaths(paths, data);
      if (R.compose(R.equals(0), R.length, R.keys)(minimumData)) {
        throw new Error(`dataPaths: ${JSON.stringify(paths)} didn't match anything`);
      }
      return minimumData;
    }
  ),
  convertFromGraphqlStructure
)(graphqlListStructure);