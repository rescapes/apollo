import R from 'ramda';
import {overDeep} from '@rescapes/ramda'
import {v} from '@rescapes/validate';
import AC from '@apollo/client';
const {gql} = AC

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
 * When we write values explicitly to the cache we need to use resolves to respond to the request and perform the write,
 * just as we would on the server.
 *
 * To create your on stateLinkResolvers copy the examples provided here. Remember that explicit writes to the
 * cache are only needed when the data is not from the server. Requests to the server are implicitly cached and sought
 * on subsequent requests depending on the specified cache strategy.
 *
 * Note also that cache queries don't usually need resolvers.
 */
export const defaultStateLinkResolvers = {
  Mutation: {
    // Example of a simple cache property networkStatus
    updateNetworkStatus: (_, {isConnected}, {cache}) => {
      const query = gql`
          query MyUpdateNetworkStatusQuery {
              networkStatus {
                  isConnected
              }
          }
      `;
      const data = {
        networkStatus: {
          __typename: 'NetworkStatus',
          isConnected
        }
      };
      cache.writeQuery({
        query,
        data
      });
      return null;
    },

    // Example of adding a TODO. We query the cache for the existing todos then append a new one to them and write
    addTodo: (_, {text}, {cache}) => {
      const query = gql`
          query GetTodos {
              todos {
                  id
                  text
                  completed
              }
          }
      `;

      // Since we can't initialize the cache anymore, this moronically fail if there are no todos
      let data;
      const newTodo = {id: nextTodoId++, text, completed: false, __typename: 'TodoItem'};
      try {
        const previous = cache.readQuery({query});
        data = {
          todos: previous.todos.concat([newTodo])
        };
      } catch {
        data = {todos: []};
      }

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

      cache.writeFragment({fragment, id, data});
      return null;
    }
  },
  // Example of matching a client directive deeply
  ViewportDataType: {
    special: (settings, _args, {cache}) => {
      return 'special';
    }
  }
};


/**
 * Default values for StateLink resolvers for the given config
 * @param {Object} config The application config. This matches our API settings object
 * and is used to form the shape of the cache to match the settings.
 */
export const mergeLocalTestValuesIntoConfig = config => {
  return R.merge(
    config,
    {
      networkStatus: {
        __typename: 'NetworkStatus',
        isConnected: false
      },
      todos: []
    }
  );
};


