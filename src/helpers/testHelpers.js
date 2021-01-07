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
import * as R from 'ramda';
import {keyStringToLensPath, omitDeep, reqStrPathThrowing, strPathOr} from '@rescapes/ramda';
import settings from './privateSettings.js';
import PropTypes from 'prop-types';
import {v} from '@rescapes/validate';
import {defaultStateLinkResolvers, mergeLocalTestValuesIntoConfig} from '../client/stateLink.js';
import {writeConfigToServerAndCacheContainer} from './settingsStore.js';
import {typePoliciesWithMergeObjects} from './clientHelpers.js';
import {typePoliciesConfig} from '../config.js';
import {
  defaultSettingsCacheIdProps,
  defaultSettingsCacheOnlyObjs,
  defaultSettingsOutputParams, defaultSettingsTypenames
} from './defaultSettingsStore.js';
import {getOrCreateNoAuthApolloClientContainer} from '../client/apolloClientAuthentication';
import {parseApiUrl} from '@rescapes/helpers';
import {loginToAuthClientTask} from '../auth/login';

/**
 * InMemoryCache Policies for tests. This makes sure that the given type fields merge existing with incoming
 * when updating the cache
 * @params {[Object]} typePoliciesConfig List of TypePolicy objects
 * @type {any}
 */
export const cacheOptions = typePoliciesConfig => {
  return {
    typePolicies: typePoliciesWithMergeObjects(
      typePoliciesConfig
    )
  };
};

/**
 * The config for test. We add some cache only properties to
 */
export const localTestConfig = mergeLocalTestValuesIntoConfig({
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
    cacheOptions: cacheOptions(typePoliciesConfig)
  }
});


/**
 * Task to return and non-authorized client for tests
 * @param {{settings: {overpass: {cellSize: number, sleepBetweenCalls: number}, mapbox: {viewport: {latitude: number, zoom: number, longitude: number}, mapboxAuthentication: {mapboxApiAccessToken: string}}, domain: string, testAuthorization: {password: string, username: string}, api: {path: string, protocol: string, port: string, host: string}}, writeDefaults: (Object|Task)}} config The configuration to set up the test
 * @param {Object} config.settings.data
 * @param {Object} config.settings.data.api
 * @param {String} [config.settings.data.api.protocol] E.g. 'http'
 * @param {String} [config.settings.data.api.host] E.g. 'localhost'
 * @param {String} [config.settings.data.api.port] E.g. '8008'
 * @param {String} [config.settings.data.api.path] E.g. '/graphql/'
 * @param {String} [config.settings.data.api.uri] Uri to use instead of the above parts
 * @param {Object} config.settings.data.testAuthorization Special test section in the settings with
 * @param {Object} [config.apollo.stateLinkResolvers] Optional opject of stateLinkResolvers to pass to the Apollo Client
 * @param {Function} config.apollo.writeDefaultsCreator Required. Function to write defaults to the cache.
 * Accepts the testConfig with the writeDefaultsCreator key removed
 * @param {Object} [config.apollo.cacheOptions] An object to pass to the Apollo InMemoryCache.
 * @param {Object} [config.apollo.cacheOptions.typePolicies] Type policies for the Apollo InMemoryCache. These
 * @param {Object} config.settingsConfig
 * @param {Array|Object} config.settingsConfig.defaultSettingsOutputParams The settings outputParams
 * @param {[String]} config.settingsConfig.defaultSettingsCacheOnlyObjs See defaultSettingsStore for an example
 * @param {[String]} config.settingsConfig.defaultSettingsCacheIdProps See defaultSettingsStore for an example
 * policies specify merging strategies, and must be included for types that store cache only values
 * This can have options the class takes such as typePolicies. Defaults to cacheOptions
 * a username and password
 * Returns an object {apolloClient:An authorized client}
 */
export const createTestNoAuthTask = config => getOrCreateNoAuthApolloClientContainer({
    cacheOptions: strPathOr({}, 'apollo.cacheOptions', config),
    uri: strPathOr(parseApiUrl(reqStrPathThrowing('settings.data.api', config)), 'uri', config),
    stateLinkResolvers: strPathOr({}, 'apollo.stateLinkResolvers', config),
    writeDefaults: reqStrPathThrowing('apollo.writeDefaultsCreator', config)(omitDeep(['apollo.writeDefaultsCreator'], config)),
    settingsConfig: {
      cacheOnlyObjs: defaultSettingsCacheOnlyObjs,
      cacheIdProps: defaultSettingsCacheIdProps,
      settingsOutputParams: defaultSettingsOutputParams
    }
  }
);
/**
 * Task to return and authorized client for tests
 * @param {{settings: {overpass: {cellSize: number, sleepBetweenCalls: number}, mapbox: {viewport: {latitude: number, zoom: number, longitude: number}, mapboxAuthentication: {mapboxApiAccessToken: string}}, domain: string, testAuthorization: {password: string, username: string}, api: {path: string, protocol: string, port: string, host: string}}, writeDefaults: (Object|Task)}} config The configuration to set up the test
 * @param {Object} config.settings.data
 * @param {Object} config.settings.data.api
 * @param {String} [config.settings.data.api.protocol] E.g. 'http'
 * @param {String} [config.settings.data.api.host] E.g. 'localhost'
 * @param {String} [config.settings.data.api.port] E.g. '8008'
 * @param {String} [config.settings.data.api.path] E.g. '/graphql/'
 * @param {String} [config.settings.data.api.uri] Uri to use instead of the above parts
 * @param {Object} config.settings.data.testAuthorization Special test section in the settings with
 * @param {Object} [config.apollo.stateLinkResolvers] Optional opject of stateLinkResolvers to pass to the Apollo Client
 * @param {Function} config.apollo.writeDefaultsCreator Required. Function to write defaults to the cache.
 * Accepts the testConfig with the writeDefaultsCreator key removed
 * @param {Object} [config.apollo.cacheOptions] An object to pass to the Apollo InMemoryCache.
 * @param {Object} [config.apollo.cacheOptions.typePolicies] Type policies for the Apollo InMemoryCache. These
 * @param {Object} config.settingsConfig
 * @param {Array|Object} config.settingsConfig.defaultSettingsOutputParams The settings outputParams
 * @param {[String]} config.settingsConfig.defaultSettingsCacheOnlyObjs See defaultSettingsStore for an example
 * @param {[String]} config.settingsConfig.defaultSettingsCacheIdProps See defaultSettingsStore for an example
 * policies specify merging strategies, and must be included for types that store cache only values
 * This can have options the class takes such as typePolicies. Defaults to cacheOptions
 * a username and password
 * Returns an object {apolloClient:An authorized client}
 */
export const createTestAuthTask = config => loginToAuthClientTask({
    cacheOptions: strPathOr({}, 'apollo.cacheOptions', config),
    uri: strPathOr(parseApiUrl(reqStrPathThrowing('settings.data.api', config)), 'uri', config),
    stateLinkResolvers: strPathOr({}, 'apollo.stateLinkResolvers', config),
    writeDefaults: reqStrPathThrowing('apollo.writeDefaultsCreator', config)(omitDeep(['apollo.writeDefaultsCreator'], config)),
    settingsConfig: {
      cacheOnlyObjs: defaultSettingsCacheOnlyObjs,
      cacheIdProps: defaultSettingsCacheIdProps,
      settingsOutputParams: defaultSettingsOutputParams
    }
  },
  reqStrPathThrowing('settings.data.testAuthorization', config)
);
/**
 * Task to return and authorized client for tests
 * Returns an object {apolloClient:An authorized client}
 */
export const localTestAuthTask = () => createTestAuthTask(localTestConfig);

/**
 * Task to return and authorized client for tests
 * Returns an object {apolloClient:An unauthorized client}
 */
export const localTestNoAuthTask = () => {
  // Clear the localStorage. TODO this might need to be keyed for parallel tests
  localStorage.removeItem('token');
  return createTestNoAuthTask(localTestConfig);
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

