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

import {mapObjToValues, reqPathThrowing, capitalize} from 'rescape-ramda';
import * as R from 'ramda';
import {resolveGraphQLType, formatOutputParams, responseForComponent} from './requestHelpers';
import {authApolloClientQueryRequestTask} from '../client/apolloClient';
import {debug} from './logHelpers';
import {replaceValuesWithCountAtDepthAndStringify} from 'rescape-ramda';
import gql from 'graphql-tag';

/**
 * Makes the location query based on the queryParams
 * @param {String} queryName
 * @param {Object} inputParamTypeMapper maps Object params paths to the correct input type for the query
 * e.g. { 'data': 'DataTypeRelatedReadInputType' }
 * @param {Object} outputParams
 * @param {Object} queryArguments
 * @returns {String} The query in a string
 */
export const makeQuery = R.curry((queryName, inputParamTypeMapper, outputParams, queryArguments) => {

  const resolve = resolveGraphQLType(inputParamTypeMapper);

  // These are the first line parameter definitions of the query, which list the name and type
  const params = R.join(
    ', ',
    mapObjToValues((value, key) => {
      // Map the key to the inputParamTypeMapper value for that key if given
      // This is only needed when value is an Object since it needs to map to a custom graphql inputtype
      return `$${key}: ${resolve(key, value)}!`;
    }, queryArguments)
  );

  const parenWrapIfNotEmpty = str => R.unless(R.isEmpty, str => `(${str})`, str);

  // These are the second line arguments that map parameters to variables
  const args = R.join(
    ', ',
    mapObjToValues((value, key) => {
      return `${key}: $${key}`;
    }, queryArguments)
  );

  // Only use parens if there are actually variables/arguments
  const variableString = R.ifElse(R.length, R.always(params), R.always(''))(R.keys(queryArguments));

  // We use the queryName as the label of the query and the name that matches the schema
  return `query ${queryName} ${parenWrapIfNotEmpty(variableString)} { 
${queryName}${parenWrapIfNotEmpty(args)} {
  ${formatOutputParams(outputParams)}
  }
}`;
});

/**
 * Creates a query task for any type
 * @params {Object} client The Apollo client, authenticated for most calls
 * @params {String} name The lowercase name of the object matching the query name, e.g. 'regions' for regionsQuery
 * @params {Object} readInputTypeMapper maps object keys to complex input types from the Apollo schema. Hopefully this
 * will be automatically resolved soon. E.g. {data: 'DataTypeofLocationTypeRelatedReadInputType'}
 * @param [String|Object] outputParams output parameters for the query in this style json format:
 *  [
 *    'id',
 *    {
 *        data: [
 *         'foo',
 *         {
 *            properties: [
 *             'type',
 *            ]
 *         },
 *         'bar',
 *       ]
 *    }
 *  ]
 *
 *  In other words, start every type as a list and embed object types using {objectTypeKey: [...]}
 *  @param {Object} queryArgs Object of simple or complex parameters. Example:
 *  {city: "Stavanger", data: {foo: 2}}
 *  @param {Task} An apollo query task that resolves to and object with the results of the query. Successful results
 *  are in obj.data[name]. Errors are in obj.errors. Since the queries are stored in data[name], multiple queries
 *  of different could be merged together into the data field. This also matches what Apollo components expect.
 *  If you need the value in a Result.Ok or Result.Error to halt operations on error, use requestHelpers.responseAsResult
 */
export const makeQueryTask = R.curry((apolloClient, {name, readInputTypeMapper}, outputParams, queryArgs) => {
  const query = makeQuery(name, readInputTypeMapper, outputParams, queryArgs);
  console.debug(`Query: ${query}, Arguments: ${JSON.stringify(queryArgs)}`);
  return R.map(
    queryResponse => {
      debug(`makeQueryTask for ${name} responded: ${replaceValuesWithCountAtDepthAndStringify(2, queryResponse)}`);
      return queryResponse;
    },
    authApolloClientQueryRequestTask(
      apolloClient,
      {
        query: gql`${query}`,
        variables: queryArgs
      }
    )
  );
});
