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

import gql from 'graphql-tag';
import {graphql} from 'graphql';
import * as R from 'ramda';
import {makeQueryTask, makeQuery} from '../../../helpers/queryHelpers';
import {makeMutationTask, makeMutation} from '../../../helpers/mutationHelpers';
import PropTypes from 'prop-types';
import {v} from 'rescape-validate';
import {reqStrPath, reqStrPathThrowing, resultToTask, compact} from 'rescape-ramda';
import {makeRegionsQueryTask, regionOutputParams} from '../../scopeStores/regionStore';
import Result from 'folktale/result';
import {responseAsResult} from '../../../helpers/requestHelpers';
import {of} from 'folktale/concurrency/task';

// Variables of complex input type needs a type specified in graphql. Our type names are
// always in the form [GrapheneFieldType]of[GrapheneModeType]RelatedReadInputType
// Following this location.data is represented as follows:
// TODO These value should be derived from the schema
const readInputTypeMapper = {
  //'data': 'DataTypeofLocationTypeRelatedReadInputType'
  'user': 'UserTypeofUserStateTypeRelatedReadInputType'
};

// Default outputParams for UserState
export const userStateOutputParams = [
  'id',
  {
    data: [
      {
        userRegions: [
          {
            region: [
              'id'
            ]
          }
        ]
      }
    ]
  }
];

export const userStateWithFullRegionsOutputParams = [
  'id',
  {
    data: [
      {
        userRegions: [
          {
            region: regionOutputParams
          }
        ]
      }
    ]
  }
];

/**
 * Queries regions that are in the scope of the user and the values of that region
 * @params {Object} apolloClient The Apollo Client
 * @params {Object} userStateArguments arguments for the UserStates query. {user: {id: }} is required to limit
 * the query to one user
 * @params {Object} regionArguments arguments for the Regions query. This can be {} or null to not filter.
 * Regions will be limited to those returned by the UserState query. These should not specify ids since
 * the UserState query selects the ids
 * @returns {Object} The resulting Regions in a Task
 */
export const makeUserRegionQueryTask = v(R.curry((apolloClient, userStateArguments, regionArguments) => {
    // Function to tell whether regionArguments are defined
    const hasRegionParams = () => R.compose(R.length, R.keys)(R.defaultTo({}, regionArguments));

    // Since we only store the id of the region in the userState, if there are other queryParams
    // besides id we need to do a second query on the regions directly
    return R.composeK(
      // If we got Result.Ok and there are regionParams, query for the user's regions
      // Result Object -> Task Object
      result => R.chain(
        ({data: {userRegions}}) =>
          R.map(
            userRegions => ({data: {userRegions}}),
            R.ifElse(
              hasRegionParams,
              // TODO Extract this and generalize next time a similar case comes up
              userRegions => R.map(
                // Match any returned regions with the corresponding userRegions
                regionsResponse => {
                  const matchingRegions = reqStrPathThrowing('data.regions', regionsResponse);
                  const matchingRegionById = R.indexBy(R.prop('id'), matchingRegions);
                  return R.compose(
                    compact,
                    R.map(
                      R.ifElse(
                        ur => R.has(ur.region.id, matchingRegionById),
                        ur => R.merge(ur, {region: R.prop(ur.region.id, matchingRegionById)}),
                        R.always(null)
                      )
                    )
                  )(userRegions);
                },
                // Find regions matching the ids and the given region arguments
                makeRegionsQueryTask(
                  apolloClient,
                  regionOutputParams,
                  // Map each userRegion to its region id
                  R.merge(regionArguments, {idIn: R.map(R.compose(s => parseInt(s), reqStrPathThrowing('region.id')), userRegions)})
                )
              ),
              of
            )(userRegions)
          ),
        result
      ),
      // First query for UserState
      () => R.map(
        // Dig into the results and return a Result.Ok with the userRegions or a Result.Error if not found
        // Result.Error prevents the next query from running
        response => responseAsResult(
          response,
          // We only ever get 1 userState since we are querying by user
          'userStates.0.data.userRegions',
          'userRegions'
        ),
        makeQueryTask(
          apolloClient,
          {name: 'userStates', readInputTypeMapper},
          // If we have to query for regions separately use the limited output userStateOutputParams
          R.when(hasRegionParams, R.always(userStateOutputParams))(userStateWithFullRegionsOutputParams),
          R.merge(userStateArguments, {})
        )
      )
    )();
  }),
  [
    ['apolloClient', PropTypes.shape().isRequired],
    ['userStateArguments', PropTypes.shape({
      user: PropTypes.shape({
        id: PropTypes.oneOfType([
          PropTypes.string,
          PropTypes.number
        ])
      })
    }).isRequired],
    ['regionArguments', PropTypes.shape().isRequired]
  ], 'makeUserRegionQueryTask');

export const makeUserRegionMutation = R.curry((outputParams, inputParams) => {
  const mutation = makeMutation('updateRegion', {}, {locationData: inputParams}, {location: outputParams});
  debug(mutation);
  return gql`${mutation}`;
});

/*
  LinkState Defaults
*/

const defaults = {};

/*
  LinkState queries and mutations
*/

/*
Example queries and mutations
const userRegionLocalQuery = gql`
  query GetTodo {
    currentTodos @client
  }
`;

const clearTodoQuery = gql`
  mutation clearTodo {
    clearTodo @client
  }
`;

const addTodoQuery = gql`
  mutation addTodo($item: String) {
    addTodo(item: $item) @client
  }
`;
*/

/*
  Cache Mutation Resolvers
*/

const mutations = {
  // These are examples of mutating the cache
  /*  addTodo: (_obj, {item}, {cache}) => {
      const query = todoQuery;
      // Read the todo's from the cache
      const {currentTodos} = cache.readQuery({query});

      // Add the item to the current todos
      const updatedTodos = currentTodos.concat(item);

      // Update the cached todos
      cache.writeQuery({query, data: {currentTodos: updatedTodos}});

      return null;
    },

    clearTodo: (_obj, _args, {cache}) => {
      cache.writeQuery({query: todoQuery, data: todoDefaults});
      return null;
    }*/
};

/*
  Store
*/

/**
 * The Store object used to construct
 * Apollo Link State's Client State
 */
export const userRegionStore = {
  defaults,
  mutations
};

/*
  Helpers
*/

const todoQueryHandler = {
  props: ({ownProps, data: {currentTodos = []}}) => ({
    ...ownProps,
    currentTodos
  })
};

/*
const withTodo = R.compose(
  graphql(todoQuery, todoQueryHandler),
  graphql(addTodoQuery, {name: 'addTodoMutation'}),
  graphql(clearTodoQuery, {name: 'clearTodoMutation'})
);
*/

