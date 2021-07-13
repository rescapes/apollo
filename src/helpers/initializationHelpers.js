/**
 * Created by Andy Likuski on 2021.04.09
 * Copyright (c) 2021 Andy Likuski
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 */

import {getOrCreateApolloClientAndDefaultsTask} from '../client/apolloClientAuthentication.js';
import {omitDeep, reqStrPathThrowing, strPathOr} from '@rescapes/ramda';
import {loginToAuthClientTask} from '../auth/login.js';
import {parseApiUrl} from '@rescapes/helpers';
import {v} from '@rescapes/validate';
import PropTypes from 'prop-types';

/**

 /**
 * Task to return and non-authorized client for tests
 * @param {{settings: {overpass: {cellSize: number, sleepBetweenCalls: number}, mapbox: {viewport: {latitude: number, zoom: number, longitude: number}, mapboxAuthentication: {mapboxApiAccessToken: string}}, domain: string, testAuthorization: {password: string, username: string}, api: {path: string, protocol: string, port: string, host: string}}, writeDefaultsContainer: (Object|Task)}} config The configuration to set up the test
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
 * @param {[String]} config.settingsConfig.defaultSettingsCacheOnlyObjs See defaultSettingsStore for an example
 * @param {[String]} config.settingsConfig.defaultSettingsCacheIdProps See defaultSettingsStore for an example
 * @param {Array|Object} config.settingsConfig.defaultSettingsOutputParams The settings outputParams
 * policies specify merging strategies, and must be included for types that store cache only values
 * This can have options the class takes such as typePolicies. Defaults to cacheOptions
 * a username and password
 * Returns an object {apolloClient:An authorized client}
 */
export const initializeNoAuthTask = v(config => getOrCreateApolloClientAndDefaultsTask({
    cacheOptions: strPathOr({}, 'apollo.cacheOptions', config),
    uri: strPathOr(parseApiUrl(reqStrPathThrowing('settings.data.api', config)), 'uri', config),
    stateLinkResolvers: strPathOr({}, 'apollo.stateLinkResolvers', config),
    writeDefaultsContainer: reqStrPathThrowing('apollo.writeDefaultsCreator', config)(omitDeep(['apollo.writeDefaultsCreator'], config)),
    settingsConfig: reqStrPathThrowing('settingsConfig', config)
  }
), [
  ['config', PropTypes.shape({
    settings: PropTypes.shape({
      data: PropTypes.shape({
        api: PropTypes.shape({
          protocol: PropTypes.string,
          host: PropTypes.string,
          path: PropTypes.string,
          uri: PropTypes.string
        }).isRequired
      }).isRequired,
      testAuthorization: PropTypes.shape({})
    }).isRequired,
    apollo: PropTypes.shape({
      stateLinkResolvers: PropTypes.shape(),
      writeDefaultsCreator: PropTypes.func.isRequired
    }),
    cacheOptions: PropTypes.shape({
      typePolicies: PropTypes.shape()
    }),
    settingsConfig: PropTypes.shape({
      settingsCacheOnlyObjs: PropTypes.array,
      settingsCacheIdProps: PropTypes.array,
      settingsOutputParams: PropTypes.shape().isRequired
    }).isRequired
  }).isRequired]
], 'initializeNoAuthTask');

/**
 * Task to return and authorized client for tests
 * @param {Object} settingsConfig
 * @param {Object} settingsConfig.cacheOnlyObjs See defaultSettingsCacheOnlyObjs for an example
 * @param {Object} settingsConfig.cacheIdProps See defaultSettingsCacheIdProps for an example
 * @param {Object} settingsConfig.settingsOutputParams See defaultSettingsOutputParams for an example
 * @param {{settings: {overpass: {cellSize: number, sleepBetweenCalls: number}, mapbox: {viewport: {latitude: number, zoom: number, longitude: number}, mapboxAuthentication: {mapboxApiAccessToken: string}}, domain: string, testAuthorization: {password: string, username: string}, api: {path: string, protocol: string, port: string, host: string}}, writeDefaultsContainer: (Object|Task)}} config The configuration to set up the test
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
export const initializeAuthorizedTask = v(config => {
  return loginToAuthClientTask({
      cacheOptions: strPathOr({}, 'apollo.cacheOptions', config),
      uri: strPathOr(parseApiUrl(reqStrPathThrowing('settings.data.api', config)), 'uri', config),
      stateLinkResolvers: strPathOr({}, 'apollo.stateLinkResolvers', config),
      writeDefaultsContainer: reqStrPathThrowing('apollo.writeDefaultsCreator', config)(omitDeep(['apollo.writeDefaultsCreator'], config)),
      settingsConfig: reqStrPathThrowing('settingsConfig', config)
    },
    reqStrPathThrowing('settings.data.testAuthorization', config)
  );
}, [
  ['config', PropTypes.shape({
    settings: PropTypes.shape({
      data: PropTypes.shape({
        api: PropTypes.shape({
          protocol: PropTypes.string,
          host: PropTypes.string,
          path: PropTypes.string,
          uri: PropTypes.string
        }).isRequired
      }).isRequired,
      testAuthorization: PropTypes.shape({})
    }).isRequired,
    apollo: PropTypes.shape({
      stateLinkResolvers: PropTypes.shape(),
      writeDefaultsCreator: PropTypes.func.isRequired
    }),
    cacheOptions: PropTypes.shape({
      typePolicies: PropTypes.shape()
    }),
    settingsConfig: PropTypes.shape({
      settingsCacheOnlyObjs: PropTypes.array,
      settingsCacheIdProps: PropTypes.array,
      settingsOutputParams: PropTypes.shape().isRequired
    }).isRequired
  }).isRequired]
], 'initializeNoAuthTask');
