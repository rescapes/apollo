/**
 * Created by Andy Likuski on 2018.07.31
 * Copyright (c) 2018 Andy Likuski
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 */
import {createSelectorResolvedSchema} from '../schema/selectorResolvers';
import {sampleConfig, createSchema, getCurrentConfig} from 'rescape-sample-data';
import * as R from 'ramda';
import {loginToAuthClientTask} from '../auth/login';
import {reqStrPathThrowing, overDeep} from 'rescape-ramda';
import privateTestConfig from './privateTestConfig';
import PropTypes from 'prop-types';
import {v} from 'rescape-validate';
import gql from 'graphql-tag';

let nextTodoId = 1;
/**
 * StateLink resolvers for testing.
 */
const sampleStateLinkResolvers = {
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
 * Default values for StateLink resolvers
 */
const testCreateStateLinkDefaults = config => overDeep(
  (key, obj) => R.merge(obj, {__typename: key}),
  R.merge(
    config,
    {
      networkStatus: {
        __typename: 'NetworkStatus',
        isConnected: false
      },
      todos: [

      ]
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

export const testConfig = getCurrentConfig(privateTestConfig);

// Apollo Link State defaults are based on the config.
// TODO I've limited the keys here to keep out regions and users. If all tests are based on a server
// we should remove users and regions from our testConfig
const testStateLinkDefaults = testCreateStateLinkDefaults(R.pick(['settings', 'browser'], testConfig));

export const sampleStateLinkResolversAndDefaults = {
  resolvers: sampleStateLinkResolvers, defaults: testStateLinkDefaults
};

/**
 * Schema using selectors for resolvers. TODO these will be changed to use apollo-link-state
 * @return {*}
 */
export const createTestSelectorResolvedSchema = () => {
  const schema = createSchema();
  return createSelectorResolvedSchema(schema, testConfig);
};

/**
 * Task to return and authorized client for tests
 * Returns an object {apolloClient:An authorized client}
 */
export const testAuthTask = loginToAuthClientTask(
  reqStrPathThrowing('settings.api.uri', testConfig),
  sampleStateLinkResolversAndDefaults,
  reqStrPathThrowing('settings.testAuthorization', testConfig)
);

/**
 * Convenient way to check if an object has a few expected keys at the given path
 * @param {[String]} keyPaths keys or dot-separated key paths of the object to check
 * @param {String} strPath Dot separated path of keys into the object
 * @param {Object} obj The object to check
 * @return {*} Expects the object has the given keys. Throws if expect fails* @return {*}
 */
export const expectKeysAtStrPath = v(R.curry((keyPaths, strPath, obj) =>
  expectKeys(keyPaths, reqStrPathThrowing(strPath)(obj))
), [
  ['keys', PropTypes.arrayOf(PropTypes.string).isRequired],
  ['strPath', PropTypes.string.isRequired],
  ['obj', PropTypes.shape({}).isRequired]
]);

// TODO get from rescape-ramda
export const keyStringToLensPath = keyString => R.map(
  R.when(R.compose(R.complement(R.equals)(NaN), parseInt), parseInt),
  R.split('.', keyString)
);

/**
 * Convenient way to check if an object has a few expected keys at the given path
 * @param {[String]} keyPaths keys or dot-separated key paths of the object to check
 * @param {Object} obj The object to check
 * @return {*} Expects the object has the given keys. Throws if expect fails* @return {*}
 */
export const expectKeys = v(R.curry((keyPaths, obj) => expect(
  R.compose(
    // Put the keyPaths that survive in a set for comparison
    a => new Set(a),
    // Filter out keyPaths that don't resolve to a non-nil value
    obj => R.filter(
      keyPath => R.complement(R.isNil)(
        R.view(R.lensPath(keyStringToLensPath(keyPath)), obj)
      ),
      keyPaths
    )
  )(obj)
).toEqual(
  new Set(keyPaths)
)), [
  ['keys', PropTypes.arrayOf(PropTypes.string).isRequired],
  ['obj', PropTypes.shape({}).isRequired]
]);
