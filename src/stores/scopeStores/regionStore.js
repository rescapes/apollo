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

import {graphql} from 'graphql';
import * as R from 'ramda';
import {replaceValuesWithCountAtDepthAndStringify, reqStrPathThrowing} from 'rescape-ramda';
import {debug} from '../../helpers/logHelpers';
import {reqStrPath} from 'rescape-ramda';
import {makeQuery} from '../../helpers/queryHelpers';
import {makeMutation} from '../../helpers/mutationHelpers';
import {authApolloClientQueryRequestTask, authApolloClientMutationRequestTask} from '../../client/apolloClient';
import {v} from 'rescape-validate';
import {makeQueryTask} from '../../helpers/queryHelpers';
import PropTypes from 'prop-types';

// Every complex input type needs a type specified in graphql. Our type names are
// always in the form [GrapheneFieldType]of[GrapheneModeType]RelatedReadInputType
// Following this location.data is represented as follows:
// TODO These value should be dervived from the schema
const readInputTypeMapper = {
  //'data': 'DataTypeofLocationTypeRelatedReadInputType'
};

export const regionOutputParams = [
  'id',
  'deleted',
  'key',
  'name',
  'createdAt',
  'updatedAt',
  {
    geojson: [
      'type',
      {
        features: [
          'type',
          'id',
          {
            geometry: [
              'type',
              'coordinates'
            ]
          },
          'properties'
        ]
      },
      'generator',
      'copyright'
    ],
    data: [
      {
        locations: [
          'params'
        ]
      }
    ]
  }
];

/**
 * Queries regions
 * @params {Object} apolloClient The Apollo Client
 * @params {Object} ouptputParams OutputParams for the query such as regionOutputParams
 * @params {Object} regionArguments Arguments for the Regions query. This can be {} or null to not filter.
 * @returns {Task} A Task containing the Regions in an object with obj.data.regions or errors in obj.errors
 */
export const makeRegionQueryTask = v(R.curry((apolloClient, outputParams, regionArguments) => {
    return makeQueryTask(
      apolloClient,
      {name: 'regions', readInputTypeMapper},
      // If we have to query for regions separately use the limited output userStateOutputParams
      outputParams,
      arguments
    );
  }),
  [
    ['apolloClient', PropTypes.shape().isRequired],
    ['outputParams', PropTypes.array.isRequired],
    ['regionArguments', PropTypes.shape().isRequired]
  ], 'makeRegionQueryTask');

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
