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
import {reqStrPathThrowing} from 'rescape-ramda';
import privateTestConfig from './privateTestConfig';
import PropTypes from 'prop-types';
import {v} from 'rescape-validate';

/**
 * StateLink resolvers for testing.
 * @type {{Mutation: {updateNetworkStatus: function(*, {isConnected: *}, {cache: *})}}}
 */
const sampleStateLinkResolvers = {
  Mutation: {
    updateNetworkStatus: (_, {isConnected}, {cache}) => {
      const data = {
        networkStatus: {
          __typename: 'NetworkStatus',
          isConnected
        }
      };
      cache.writeData({data});
      return null;
    }
  },
  Query: {
    // State Link resolvers. Only needed to do fancy stuff
    //networkStatus: (obj, args, context, info) =>
  }
};

/**
 * Deafult values for StateLink resolvers
 * @type {{networkStatus: {__typename: string, isConnected: boolean}}}
 */
const stateLinkDefaults = {
  networkStatus: {
    __typename: 'NetworkStatus',
    isConnected: false
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
};


export const sampleStateLinkResolversAndDefaults = {
  resolvers: sampleStateLinkResolvers, defaults: stateLinkDefaults
};

export const testConfig = getCurrentConfig(privateTestConfig);

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
 * Returns an object {apolloClient:An authorized client, unsubscribe: Function to clear local state}
 */
export const testAuthTask = loginToAuthClientTask(
  reqStrPathThrowing('settings.api.uri', testConfig),
  sampleStateLinkResolversAndDefaults,
  reqStrPathThrowing('settings.testAuthorization', testConfig)
);

/**
 * Convenient way to check if an object has a few expected keys
 * @param {[String]} keys keys of the object to check
 * @param {Object} obj The object to check
 * @return {*} Expects the object has the given keys. Throws if expect fails
 */
export const expectKeys = v(R.curry((keys, obj) => expect(
  R.compose(a => new Set(a), R.keys, R.pick(keys))(obj)
  ).toEqual(
  new Set(keys)
  )),
  [
    ['keys', PropTypes.arrayOf(PropTypes.string).isRequired],
    ['obj', PropTypes.shape().isRequired]
  ]
);

/**
 * Convenient way to check if an object has a few expected keys at the given path
 * @param {[String]} keys keys of the object to check
 * @param {String} strPath Dot separated path of keys into the object
 * @param {Object} obj The object to check
 * @return {*} Expects the object has the given keys. Throws if expect fails* @return {*}
 */
export const expectKeysAtStrPath = v(R.curry((keys, strPath, obj) => expect(
  R.compose(a => new Set(a), R.keys, R.pick(keys), reqStrPathThrowing(strPath))(obj)
).toEqual(
  new Set(keys)
)), [
  ['keys', PropTypes.arrayOf(PropTypes.string).isRequired],
  ['strPath', PropTypes.string.isRequired],
  ['obj', PropTypes.shape({}).isRequired]
]);
