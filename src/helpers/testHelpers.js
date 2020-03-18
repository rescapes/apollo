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
import {parseApiUrl} from 'rescape-helpers';
import * as R from 'ramda';
import {loginToAuthClientTask} from '../auth/login';
import {keyStringToLensPath, reqStrPathThrowing, strPathOr, overDeep} from 'rescape-ramda';
import privateTestSettings from './privateTestSettings';
import PropTypes from 'prop-types';
import {v} from 'rescape-validate';
import {defaultStateLinkResolvers, mergeLocalTestValuesIntoConfig} from '../client/stateLink';
import {writeConfigToServerAndCache} from './defaultSettingsStore';
import {typePoliciesWithMergeObjects} from './clientHelpers';

// Add typename to each obj
const addTypeNameDeep = obj => {
  return overDeep(
    (key, obj) => {
      // Key is e.g. settings, browser
      return R.merge(obj, {__typename: key});
    }, obj);
};

/**
 * The config for test. We add some cache only properties to
 */
export const localTestConfig = mergeLocalTestValuesIntoConfig(R.merge(
  addTypeNameDeep({settings: privateTestSettings}),
  {
    writeDefaults: writeConfigToServerAndCache,
    stateLinkResolvers: defaultStateLinkResolvers
  })
);


/**
 * InMemoryCache Policies for tests. This makes sure that the given type fields merge existing with incoming
 * when updating the cache
 * @type {any}
 */
export const testCacheOptions = {
  typePolicies: typePoliciesWithMergeObjects([
    {type: 'SettingsType', fields: ['data']},
    {type: 'SettingsDataType', fields: ['mapbox']},
    {type: 'RegionType', fields: ['data']}
  ])
};


/**
 * Task to return and authorized client for tests
 * @param {{settings: {overpass: {cellSize: number, sleepBetweenCalls: number}, mapbox: {viewport: {latitude: number, zoom: number, longitude: number}, mapboxAuthentication: {mapboxApiAccessToken: string}}, domain: string, testAuthorization: {password: string, username: string}, api: {path: string, protocol: string, port: string, host: string}}, writeDefaults: (Object|Task)}} testConfig The configuration to set up the test
 * @param {Object} testConfig.settings.api
 * @param {String} [testConfig.settings.api.protocol] E.g. 'http'
 * @param {String} [testConfig.settings.api.host] E.g. 'localhost'
 * @param {String} [testConfig.settings.api.port] E.g. '8008'
 * @param {String} [testConfig.settings.api.path] E.g. '/graphql/'
 * @param {String} [testConfig.settings.api.uri] Uri to use instead of the above parts
 * @param {Object} testConfig.settings.testAuthorization Special test section in the settings with
 * @param {Object} [testConfig.stateLinkResolvers] Optional opject of stateLinkResolvers to pass to the Apollo Client
 * @param {Function} testConfig.writeDefaults Required. Function to write defaults to the cache.
 * Accepts the testConfig with the writeDefaults key removed
 * @param {Object} [testConfig.testCacheOptions] An object to pass to the Apollo InMemoryCache.
 * This can have options the class takes such as typePolicies. Defaults to testCacheOptions
 * a username and password
 * Returns an object {apolloClient:An authorized client}
 */
export const testAuthTask = testConfig => loginToAuthClientTask({
    cacheOptions: testCacheOptions,
    uri: strPathOr(parseApiUrl(reqStrPathThrowing('settings.api', testConfig)), 'uri', testConfig),
    stateLinkResolvers: strPathOr({}, 'stateLinkResolvers', testConfig),
    writeDefaults: reqStrPathThrowing('writeDefaults', testConfig)(R.omit(['writeDefaults'], testConfig))
  },
  reqStrPathThrowing('settings.testAuthorization', testConfig)
);

/**
 * Task to return and authorized client for tests
 * Returns an object {apolloClient:An authorized client}
 */
export const localTestAuthTask = testAuthTask(localTestConfig);

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

