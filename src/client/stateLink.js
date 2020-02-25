import * as R from 'ramda';
import {overDeep}  from 'rescape-ramda';
import {v} from 'rescape-validate';
import gql from 'graphql-tag';

/**
 * Created by Andy Likuski on 2019.04.16
 * Copyright (c) 2019 Andy Likuski
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 */


let nextTodoId = 1;
/**
 * StateLink resolvers for testing.
 */
export const defaultStateLinkResolvers = {
  Mutation: {
    // Example of a simple cache property networkStatus
    updateNetworkStatus: (_, {isConnected}, {cache}) => {
      const data = {
        networkStatus: {
          __typename: 'NetworkStatus',
          isConnected
        }
      };
      cache.writeData({data});
      return null;
    },

    // Example of adding a TODO
    addTodo: (_, {text}, {cache}) => {
      const query = gql`
          query GetTodos {
              todos @client {
                  id
                  text
                  completed
              }
          }
      `;

      const previous = cache.readQuery({query});
      const newTodo = {id: nextTodoId++, text, completed: false, __typename: 'TodoItem'};
      const data = {
        todos: previous.todos.concat([newTodo])
      };

      // you can also do cache.writeData({ data }) here if you prefer
      cache.writeQuery({query, data});
      return newTodo;
    },

    // Example of list of cache items where we toggle one
    toggleTodo: (_, variables, {cache}) => {
      const id = `TodoItem:${variables.id}`;
      const fragment = gql`
          fragment completeTodo on TodoItem {
              completed
          }
      `;
      const todo = cache.readFragment({fragment, id});
      const data = {...todo, completed: !todo.completed};

      // you can also do cache.writeData({ data, id }) here if you prefer
      cache.writeFragment({fragment, id, data});
      return null;
    }
  },
  Query: {
    // State Link resolvers. Only needed to do fancy stuff
    //networkStatus: (obj, args, context, info) =>
  }
};


/**
 * Default values for StateLink resolvers for the given config
 * @param {Object} config The application config. This matches our API settings object
 * and is used to form the shape of the cache to match the settings.
 */
export const createStateLinkDefaults = config => overDeep(
  (key, obj) => R.merge(obj, {__typename: key}),
  R.merge(
    config,
    {
      networkStatus: {
        __typename: 'NetworkStatus',
        isConnected: false
      },
      todos: []
    }
    /*
    // Same as passing defaults above
  cache.writeData({
    data: {
      networkStatus: {
        __typename: 'NetworkStatus',
       isConnected: true,
      },
    },
  });
     */
  )
);


