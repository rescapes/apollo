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
import {resolveGraphQLType, formatOutputParams} from './requestHelpers';
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
 *  @param {Object} queryParams Object of simple or complex parameters. Example:
 *  {city: "Stavanger", data: {foo: 2}}
 *  @param {Task} An apollo query task that resolves to the params being queried
 */
export const makeQueryTask = R.curry((apolloClient, {name, readInputTypeMapper}, outputParams, queryParams) => {
  const query = makeQuery(name, readInputTypeMapper, outputParams, queryParams);
  return R.map(
    queryResponse => {
      debug(`makeQueryTask for ${name} responded: ${replaceValuesWithCountAtDepthAndStringify(2, queryResponse)}`);
      return reqPathThrowing(['data', name], queryResponse)
    },
    authApolloClientQueryRequestTask(
      apolloClient,
      {
        query: gql`${query}`,
        variables: queryParams
      }
    )
  );
});
