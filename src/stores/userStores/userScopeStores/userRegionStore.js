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
import PropTypes from 'prop-types';
import {v} from 'rescape-validate';
import {makeRegionsQueryContainer, regionOutputParams} from '../../scopeStores/regionStore';
import {of} from 'folktale/concurrency/task';
import {makeUserScopeObjsQueryContainer} from './scopeHelpers';
import {userStateOutputParamsCreator, userStateReadInputTypeMapper} from '../userStore';
import {reqStrPathThrowing} from 'rescape-ramda';

/**
 * Queries regions that are in the scope of the user and the values of that region
 * @param {Object} apolloConfig Configuration of the Apollo Client when using one instead of an Apollo Component
 * @param {Object} apolloConfig.apolloClient An authorized Apollo Client
 * @param {Object} userStateArguments arguments for the UserStates query. {user: {id: }} is required to limit
 * the query to one user
 * @param {Function} [component] Optional component when doing and Apollo Component query
 * @param {Object} props The props used for the query. userState and project objects are required
 * @param {Object} props.userState Props for the UserStates query. {user: {id: }} is required to limit
 * the query to one user
 * @param {Object} props.region Props for the Regions query. This can be {} or null to not filter.
 * @returns {Object} The resulting Regions in a Task in {data: usersRegions: [...]}}
 */
export const makeUserRegionsQueryContainer = v(R.curry(
  (apolloClient, component, props) => {
    return makeUserScopeObjsQueryContainer(
      {apolloClient},
      {
        scopeQueryTask: makeRegionsQueryContainer,
        scopeName: 'region',
        readInputTypeMapper: userStateReadInputTypeMapper,
        userStateOutputParamsCreator: scopeOutputParams => userStateOutputParamsCreator({region: scopeOutputParams}),
        scopeOutputParams: regionOutputParams
      },
      component,
      {userState: reqStrPathThrowing('userState', props), scope: {region: reqStrPathThrowing('region', props)}}
    );
  }),
  [
    ['apolloClient', PropTypes.shape().isRequired],
    ['component', PropTypes.func],
    ['props', PropTypes.shape({
      userState: PropTypes.shape({
        user: PropTypes.shape({
          id: PropTypes.oneOfType([
            PropTypes.string,
            PropTypes.number
          ])
        }).isRequired
      }).isRequired,
      region: PropTypes.shape().isRequired
    })]
  ], 'makeUserRegionsQueryContainer');


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

