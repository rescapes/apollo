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
import {makeMutation, makeMutationTask} from '../../helpers/mutationHelpers';
import {authApolloClientQueryRequestTask, authApolloClientMutationRequestTask} from '../../client/apolloClient';
import {v} from 'rescape-validate';
import {makeQueryTask} from '../../helpers/queryHelpers';
import PropTypes from 'prop-types';
import {userRegionsParamsCreator} from './userScopeStores/userRegionStore';
import {userProjectsParamsCreator} from './userScopeStores/userProjectStore';

// Every complex input type needs a type specified in graphql. Our type names are
// always in the form [GrapheneFieldType]of[GrapheneModeType]RelatedReadInputType
// Following this location.data is represented as follows:
// TODO These value should be dervived from the schema
const readInputTypeMapper = {
  //'data': 'DataTypeofLocationTypeRelatedReadInputType'
};

export const userOutputParams = [
  'id',
  'lastLogin',
  'username',
  'firstName',
  'lastName',
  'email',
  'isStaff',
  'isActive',
  'dateJoined'
];

export const userStateMutateOutputParams = [
  'id',
  {
    data: [
      {
        userRegions: userRegionsParamsCreator(['id']),
        userProjects: userProjectsParamsCreator(['id']),
      }
    ]
  }
];

/**
 * Queries users
 * @params {Object} apolloClient The Apollo Client
 * @params {Object} ouptputParams OutputParams for the query such as userOutputParams
 * @returns {Task<Result>} A Task containing the Result.Ok with a User in an object with Result.Ok({data: currentUser: {}})
 * or errors in Result.Error({errors: [...]})
 */
export const makeCurrentUserQueryTask = v(R.curry((apolloClient, outputParams) => {
    return makeQueryTask(
      apolloClient,
      {name: 'currentUser', readInputTypeMapper},
      // If we have to query for users separately use the limited output userStateOutputParamsCreator
      outputParams,
      // No arguments, the server resolves the current user based on authentication
      {}
    );
  }),
  [
    ['apolloClient', PropTypes.shape().isRequired],
    ['outputParams', PropTypes.array.isRequired]
  ], 'makeUserQueryTask');


/**
 * Mutate the user state of the given user
 * @params {Object} apolloClient The Apollo Client
 * @params {Object} outputParams OutputParams for the query such as userStateMutateOutputParams
 * @returns {Task<Result>} A Task containing the Result.Ok with a User in an object with Result.Ok({data: currentUser: {}})
 * or errors in Result.Error({errors: [...]})
 */
export const makeUserStateMutationTask = R.curry((apolloClient, outputParams, inputParams) => makeMutationTask(
  apolloClient,
  {name: 'userState'},
  outputParams,
  inputParams
));