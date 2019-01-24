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
import {makeMutationTask} from '../../helpers/mutationHelpers';
import {v} from 'rescape-validate';
import {makeQueryTask} from '../../helpers/queryHelpers';
import PropTypes from 'prop-types';
import {userRegionsFragmentCreator} from './userScopeStores/userRegionStore';
import {userProjectsFragmentCreator} from './userScopeStores/userProjectStore';
import {mapKeysAndValues, capitalize} from 'rescape-ramda';
import {regionOutputParams} from '../scopeStores/regionStore';
import {projectOutputParams} from '../scopeStores/projectStore';

// Every complex input type needs a type specified in graphql. Our type names are
// always in the form [GrapheneFieldType]of[GrapheneModeType]RelatedReadInputType
// Following this location.data is represented as follows:
// TODO These value should be dervived from the schema
const userReadInputTypeMapper = {
  //'data': 'DataTypeofLocationTypeRelatedReadInputType'
};
export const userStateReadInputTypeMapper = {
  'user': 'UserTypeofUserStateTypeRelatedReadInputType'
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

/**
 * Creates a userState scope output params fragment
 * @param {Object} userScopeFragmentOutputParams Object keyed by 'userRegions', 'userProjects', etc with
 * the ouput params those should return within userState.data.[userRegions|userProject|...]
 * @return {*} The complete UserState output params
 */
const userStateScopeOutputParamsFragmentCreator = userScopeFragmentOutputParams => {
  return mapKeysAndValues(
    (v, k) => [`user${capitalize(k)}s`, {[k]: v}],
    userScopeFragmentOutputParams
  );
};

/**
 * Creates userState output params
 * @param userScopeFragmentOutputParams Object keyed by 'region', 'project', etc with
 * the output params those should return within userState.data.[userRegions|userProject|...]
 * @return {*} The complete UserState output params
 * @return {*[]}
 */
export const userStateOutputParamsCreator = userScopeFragmentOutputParams => [
  'id',
  [{
    user: ['id'],
    data: [
      userStateScopeOutputParamsFragmentCreator(userScopeFragmentOutputParams)
    ]
  }]
];

/**
 * User state output params with full scope output params. This should only be used for quering when values of the scope
 * instances are needed beyond the ids
 */
export const userStateOutputParamsFull = userStateOutputParamsCreator({
  region: regionOutputParams,
  project: projectOutputParams
});

/**
 * User state output params with id-only scope output params. Should be used for mutations and common cases when
 * only the scope ids of the user state are needed (because scope instances are already loaded, for instance)
 */
export const userStateOutputPararmsOnlyIds = userStateOutputParamsCreator({
  region: ['id'],
  project: ['id']
});


export const userStateMutateOutputParams = userStateOutputPararmsOnlyIds;

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
      {name: 'currentUser', readInputTypeMapper: userReadInputTypeMapper},
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
 * Queries userState.
 * @params {Object} apolloClient The Apollo Client
 * @params {Object} outputParams OutputParams for the query such as regionOutputParams
 * @params {Object} userStateArguments Arguments for the UserState query. This can be {} or null to not filter.
 * @returns {Task} A Task containing the Regions in an object with obj.data.regions or errors in obj.errors
 */
export const makeUserStateQueryTask = v(R.curry((apolloClient, outputParams, userStateArguments) => {
    return makeQueryTask(
      apolloClient,
      {name: 'userStates', readInputTypeMapper: userStateReadInputTypeMapper},
      // If we have to query for users separately use the limited output userStateOutputParamsCreator
      outputParams,
      userStateArguments
    );
  }),
  [
    ['apolloClient', PropTypes.shape().isRequired],
    ['outputParams', PropTypes.array.isRequired],
    ['userStateArguments', PropTypes.shape().isRequired]
  ], 'makeUserStateQueryTask');

/**
 * Mutate the user state of the given user
 * @params {Object} apolloClient The Apollo Client
 * @params {Object} outputParams OutputParams for the query such as userStateMutateOutputParams
 * @returns {Task<Result>} A Task containing the Result.Ok with a User in an object with Result.Ok({data: currentUser: {}})
 * or errors in Result.Error({errors: [...]})
 */
export const makeUserStateMutationTask = v(R.curry((apolloClient, outputParams, inputParams) => makeMutationTask(
  apolloClient,
  {name: 'userState'},
  outputParams,
  inputParams
)),
[
  ['apolloClient', PropTypes.shape().isRequired],
  ['outputParams', PropTypes.array.isRequired],
  ['inputParams', PropTypes.shape().isRequired]
], 'makeUserStateMutationTask');