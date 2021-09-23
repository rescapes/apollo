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
import {isNode} from "browser-or-node";
import T from 'folktale/concurrency/task/index.js';
import * as AC from '@apollo/client';
import * as R from 'ramda';
import {composeWithChain, defaultNode, keyStringToLensPath, reqStrPathThrowing} from '@rescapes/ramda';
import settings from './privateSettings.js';
import PropTypes from 'prop-types';
import {v} from '@rescapes/validate';
import {defaultStateLinkResolvers} from '../client/stateLink.js';
import {
  defaultSettingsCacheIdProps,
  defaultSettingsCacheOnlyObjs,
  defaultSettingsOutputParams,
  defaultSettingsTypenames,
  writeConfigToServerAndCacheContainer
} from './defaultSettingsStore.js';
import {cacheOptions, typePoliciesConfigLocal} from '../config.js';
import {initializeAuthorizedTask, initializeNoAuthTask} from './initializationHelpers.js';

const {gql} = defaultNode(AC);
const {fromPromised, of} = T;

/**
 * The config for test. We add some cache only properties to
 * @param {Object} typeConfig See typePolicies for an example
 */
export const _localTestConfig = typeConfig => {
  return {
    // Says to create/update the settings for each test
    forceMutateSettings: true,
    settings,
    settingsConfig: {
      settingsOutputParams: defaultSettingsOutputParams,
      cacheOnlyObjs: defaultSettingsCacheOnlyObjs,
      cacheIdProps: defaultSettingsCacheIdProps,
      // These are only used to store settings for a non-auth user. Not needed if
      // we allow no auth querying of the default settings
      defaultSettingsTypenames
    },
    apollo: {
      writeDefaultsCreator: writeConfigToServerAndCacheContainer,
      stateLinkResolvers: defaultStateLinkResolvers,
      cacheOptions: cacheOptions(typeConfig)
    }
  }
};
export const localTestConfig = _localTestConfig(typePoliciesConfigLocal)
export const extendLocalTestConfig = extraTypePoliciesConfig => _localTestConfig(R.merge(typePoliciesConfigLocal, R.values(extraTypePoliciesConfig)))


export const settingsConfig = {
  cacheOnlyObjs: defaultSettingsCacheOnlyObjs,
  cacheIdProps: defaultSettingsCacheIdProps,
  settingsOutputParams: defaultSettingsOutputParams
};

/**
 * Task to return and authorized client for tests
 * Returns an object {apolloClient:An authorized client}
 */
export const localTestAuthTask = (extraTypePoliciesConfig = {}) => {
  return initializeAuthorizedTask(R.merge({settingsConfig}, extendLocalTestConfig(extraTypePoliciesConfig)));
};

/**
 * Task to return and authorized client for tests
 * Returns an object {apolloClient:An unauthorized client}
 */
export const localTestNoAuthTask = (extraTypePoliciesConfig = {}) => {
  // Clear the localStorage. TODO this might need to be keyed for parallel tests
  localStorage.removeItem('token');
  return initializeNoAuthTask(
    R.merge({settingsConfig}, extendLocalTestConfig(extraTypePoliciesConfig))
  )
};


export const localTestNoServerTask = (extraTypePoliciesConfig = {}) => {
  const config = R.merge({settingsConfig}, extendLocalTestConfig(extraTypePoliciesConfig))
  return testNoServerTask(extraTypePoliciesConfig, config)
}
/**
 * For node this starts a apollo-server as a mock so we can test caching.
 * In the browser environment this connects to the given
 * @param extraTypePoliciesConfig
 * @param config Config that points to a running node server for the browser case. For node we create a mock server
 * ourselves.
 * @returns {*}
 */
export const testNoServerTask = (extraTypePoliciesConfig = {}, config = null) => {
  // Clear the localStorage. TODO this might need to be keyed for parallel tests
  localStorage.removeItem('token');

  mockApolloClient
  // TODO  I can't use apolloServer because the browser can't deal with apollo-server because it tries to access express
  if (false && isNode) {
    /*
const typeDefs = gql`
type Query {
  hello: String
  resolved: String
}
`;
  const server = new ApolloServer({
    typeDefs,
    mocks: true,
  });
  return composeWithChain([
    ({url}) => {
      console.log(`🚀 Server ready at ${url}`)
      return initializeNoAuthTask(
        config
      )
    },
    () => {
      return fromPromised(() => server.listen({
        port: reqStrPathThrowing('settings.data.api.port', config)
      }))()
    }
  ])()
 */
  } else {
    // For the web environment use the remote server.
    // We won't actually use the client connection so we could at some point make a client that doesn't
    // connect to a server (doesn't have an http-link) but I don't know how to do that


    return of({})
  }

};


/**
 * Duplicate or rescape-helpers-test to avoid circular dependency
 * Convenient way to check if an object has a few expected keys at the given path
 * @param {[String]} keyPaths keys or dot-separated key paths of the object to check
 * @param {Object} obj The object to check
 * @return {*} Expects the object has the given keys. Throws if expect fails* @return {*}
 */
export const expectKeys = v(R.curry((keyPaths, obj) => {
  expect(
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
  );
  // Required for validated functions
  return true;
}), [
  ['keys', PropTypes.arrayOf(PropTypes.string).isRequired],
  ['obj', PropTypes.shape({}).isRequired]
]);

