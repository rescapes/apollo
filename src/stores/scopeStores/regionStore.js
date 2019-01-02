/**
 * Created by Andy Likuski on 2018.12.31
 * Copyright (c) 2018 Andy Likuski
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 */

import {graphql} from 'react-apollo';
import * as R from 'ramda';
import {replaceValuesWithCountAtDepthAndStringify, reqStrPathThrowing} from 'rescape-ramda'
import {debug} from '../../helpers/logHelpers';
import {makeQuery} from '../../helpers/queryHelpers';
import {makeMutation} from '../../helpers/mutationHelpers';
import {authApolloClientQueryRequestTask, authApolloClientMutationRequestTask} from '../../client/apolloClient';

// Every complex input type needs a type specified in graphql. Our type names are
// always in the form [GrapheneFieldType]of[GrapheneModeType]RelatedReadInputType
// Following this location.data is represented as follows:
// TODO These value should be dervived from the schema
const readInputTypeMapper = {
  //'data': 'DataTypeofLocationTypeRelatedReadInputType'
};

/**
 * Makes a Region query
 * @param {Object} authClient An authorized Apollo Client
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
 *  @param {Task} An apollo query task
 */
export const makeRegionQueryTask = R.curry((apolloClient, outputParams, queryParams) => {
  const query = makeQuery('regions', readInputTypeMapper, outputParams, queryParams);
  return R.map(
    queryResponse => {
      debug(`queryRegionsTask responded: ${replaceValuesWithCountAtDepthAndStringify(2, queryResponse)}`);
      return ({
        queryParams,
        regions: reqStrPathThrowing('data.regions', queryResponse)
      });
    },
    authApolloClientQueryRequestTask(
      apolloClient,
      {
        query,
        variables: queryParams
      }
    )
  );
});

/**
 * Makes a Region mutation
 * @param {Object} authClient An authorized Apollo Client
 * @param [String|Object] outputParams output parameters for the query in this style json format:
 *  ['id',
 *   {
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
 *  @param {Object} inputParams Object matching the shape of a region. E.g.
 *  {id: 1, city: "Stavanger", data: {foo: 2}}
 *  Creates need all required fields and updates need at minimum the id
 *  @param {Task} An apollo mutation task
 */
export const makeRegionMutation = R.curry((apolloClient, outputParams, inputParams) => {
  const mutation = makeMutation('updateRegion', {locationData: inputParams}, {location: outputParams});
  if (R.any(R.isNil, R.values(inputParams))) {
    throw new Error(`inputParams have null values ${inputParams}`);
  }

  return R.map(
    mutationResponse => {
      debug(`mutateRegionTask responded: ${replaceValuesWithCountAtDepthAndStringify(2, mutationResponse)}`);
      return ({
        inputParams,
        regions: reqStrPathThrowing('data.regions', mutationResponse)
      });
    },
    authApolloClientMutationRequestTask(
      apolloClient,
      {
        mutation
      }
    )
  );
});
