/**
 * Created by Andy Likuski on 2019.01.21
 * Copyright (c) 2019 Andy Likuski
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 */

import {graphql} from 'graphql';
import * as R from 'ramda';
import {v} from 'rescape-validate';
import {reqStrPathThrowing, compact, capitalize, reqPathThrowing} from 'rescape-ramda';
import {of} from 'folktale/concurrency/task';
import {makeQueryTask} from '../../../helpers/queryHelpers';
import {responseAsResult} from '../../../helpers/requestHelpers';
import PropTypes from 'prop-types';

/**
 * Queries scope objects (Region, Project, etc) that are in the scope of the given user. If scopeArguments are
 * specified the returned scope objects are queried by the scopeArguments to possibly reduce those matching
 * @params {Object} apolloClient The Apollo Client
 * @params {Function} scopeQueryTask Task querying the scope class, such as makeRegionsQueryTask
 * @params {String} scopeName The name of the scope, such as 'region' or 'project'
 * @params {Function} userStateOutputParamsCreator Unary function expecting scopeOutputParams
 * and returning output parameters for each the scope class query. If don't have to query scope seperately
 * then scopeOutputParams is passed to this. Otherwise we just was ['id'] since that's all the initial query needs
 * @params {[Object]} scopeOutputParams Output parameters for each the scope class query
 * @params {Object} userStateArgumentsCreator arguments for the UserStates query. {user: {id: }} is required to limit
 * the query to one user
 * @params {Object} scopeArguments arguments for the Regions query. This can be {} or null to not filter.
 * Regions will be limited to those returned by the UserState query. These should not specify ids since
 * the UserState query selects the ids
 * @returns {Object} The resulting Scope objects in a Task in the form {data: usersScopeName: [...]}}
 * where ScopeName is the capitalized and pluralized version of scopeName (e.g. region is Regions)
 */
export const makeUserScopeObjsQueryTask = v(R.curry(
  (apolloClient,
   {scopeQueryTask, scopeName, readInputTypeMapper, userStateOutputParamsCreator, scopeOutputParams},
   {userStateArguments, scopeArguments}) => {
    // Function to tell whether scopeArguments are defined
    const hasScopeParams = () => R.compose(R.length, R.keys)(R.defaultTo({}, scopeArguments));
    const userScopeNames = `user${capitalize(scopeName)}s`;

    // Since we only store the id of the scope obj in the userState, if there are other queryParams
    // besides id we need to do a second query on the scope objs directly
    return R.composeK(
      // If we got Result.Ok and there are regionParams, query for the user's scope objs
      // Result Object -> Task Object
      result => R.chain(
        ({data}) => {
          const userScopeObjs = reqStrPathThrowing(userScopeNames, data);
          return R.map(
            userScopeObjs => ({data: {[userScopeNames]: userScopeObjs}}),
            R.ifElse(
              hasScopeParams,
              userScopeObjs => queryScopeObjsOfUserStateTask(
                apolloClient,
                {scopeQueryTask, scopeName, scopeOutputParams},
                scopeArguments,
                userScopeObjs
              ),
              of
            )(userScopeObjs)
          )
        },
        result
      ),
      // First query for UserState
      () => R.map(
        // Dig into the results and return a Result.Ok with the userScopeNames or a Result.Error if not found,
        // where scope names is 'Regions', 'Projects', etc
        // Result.Error prevents the next query from running
        response => responseAsResult(
          response,
          // We only ever get 1 userState since we are querying by user
          `userStates.0.data.${userScopeNames}`,
          userScopeNames
        ),
        makeQueryTask(
          apolloClient,
          {name: 'userStates', readInputTypeMapper},
          // If we have to query for scope objs separately then just query for their ids here
          userStateOutputParamsCreator(R.when(hasScopeParams, R.always(['id']))(scopeOutputParams)),
          R.merge(userStateArguments, {})
        )
      )
    )();
  }),
  [
    ['apolloClient', PropTypes.shape().isRequired],
    ['scopeSettings', PropTypes.shape({
      scopeQueryTask: PropTypes.func.isRequired,
      scopeName: PropTypes.string.isRequired,
      readInputTypeMapper: PropTypes.shape().isRequired,
      userStateOutputParamsCreator: PropTypes.func.isRequired,
      scopeOutputParams: PropTypes.array.isRequired
    }).isRequired],
    ['queryArguments', PropTypes.shape({
      userStateArguments: PropTypes.shape({
        user: PropTypes.shape({
          id: PropTypes.oneOfType([
            PropTypes.string,
            PropTypes.number
          ])
        })
      }).isRequired,
      scopeArguments: PropTypes.shape().isRequired
    })]
  ], 'makeUserScopeObjsQueryTask');
/**
 * Given resolved objects from the user state about the scope and further arguments to filter those scope objects,
 * query for the scope objects
 * @params {Object} apolloClient The Apollo Client
 * @params {Function} scopeQueryTask Task querying the scope class, such as makeRegionsQueryTask
 * @params {String} scopeName The name of the scope, such as 'region' or 'project'
 * @params {[Object]} scopeOutputParams Output parameters for each the scope class query
 * @params {[Object]} scopeArguments Arguments for the scope class query
 * @params {[Object]} userProjects The UserProject objects. We extract the project ids from these and combine them
 * with the projectArguments
 * @return {[Object]} Task that returns the scope objs that match the scopeArguments
 */
export const queryScopeObjsOfUserStateTask = v(R.curry((apolloClient, {scopeQueryTask, scopeName, scopeOutputParams}, scopeArguments, userScopeObjs) => {
    const scopeNamePlural = `${scopeName}s`;
    return R.map(
      // Match any returned scope objs with the corresponding userProjects
      projectsResponse => {
        const matchingScopeObjs = reqPathThrowing(['data', scopeNamePlural], projectsResponse);
        const matchingScopeObjsById = R.indexBy(R.prop('id'), matchingScopeObjs);
        return R.compose(
          compact,
          R.map(
            R.ifElse(
              // Does this user project's project match one of the project ids
              ur => R.has(ur[scopeName].id, matchingScopeObjsById),
              // If so merge the query result for that project with the user project
              ur => R.merge(ur, {[scopeName]: R.prop(ur[scopeName].id, matchingScopeObjsById)}),
              // Otherwise return null, which will remove the user scope obj from the list
              R.always(null)
            )
          )
        )(userScopeObjs);
      },
      // Find scope objs matching the ids and the given scope arguments
      scopeQueryTask(
        apolloClient,
        scopeOutputParams,
        // Map each userProject to its scope obj id
        R.merge(scopeArguments, {idIn: R.map(R.compose(s => parseInt(s), reqPathThrowing([scopeName, 'id'])), userScopeObjs)})
      )
    );
  }), [

    ['apolloClient', PropTypes.shape().isRequired],
    ['scopeSettings', PropTypes.shape({
      scopeQueryTask: PropTypes.func.isRequired,
      scopeName: PropTypes.string.isRequired,
      scopeOutputParams: PropTypes.array.isRequired
    }).isRequired],
    ['scopeArguments', PropTypes.shape().isRequired],
    ['userScopeObjs', PropTypes.array.isRequired]
  ], 'queryScopeObjsOfUserStateTask'
);
