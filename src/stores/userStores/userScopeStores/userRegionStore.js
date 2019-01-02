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
import {graphql} from 'react-apollo';
import * as R from 'ramda'
import {debug} from '../../helpers/logHelpers';
import {makeQuery} from '../../helpers/queryHelpers';
import {makeMutation} from '../../helpers/mutationHelpers';

// Every complex input type needs a type specified in graphql. Our type names are
// always in the form [GrapheneFieldType]of[GrapheneModeType]RelatedReadInputType
// Following this location.data is represented as follows:
// TODO These value should be dervived from the schema
const readInputTypeMapper = {
  //'data': 'DataTypeofLocationTypeRelatedReadInputType'
};

/**
 * Queries regions that are in the scope of the user and the values of that region
 */
export const makeUserRegionQueryTask = R.curry((apolloClient, outputParams, queryParams)
  return makeUserTask
});

export const makeUserRegionMutation = R.curry((outputParams, inputParams) => {
  const mutation = makeMutation('updateRegion', {}, {locationData: inputParams}, {location: outputParams});
  debug(mutation);
  return gql`${mutation}`;
});

/*
  LinkState Defaults
*/

const defaults = {
};

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
    currentTodos,
  }),
};

const withTodo = R.compose(
  graphql(todoQuery, todoQueryHandler),
  graphql(addTodoQuery, {name: 'addTodoMutation'}),
  graphql(clearTodoQuery, {name: 'clearTodoMutation'}),
);

export {
  store,
  withTodo,
};
