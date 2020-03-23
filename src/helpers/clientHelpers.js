/**
 * Created by Andy Likuski on 2020.03.17
 * Copyright (c) 2020 Andy Likuski
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 */
import * as R from 'ramda';
import {omitDeep, reqStrPathThrowing, strPathOr} from 'rescape-ramda';
import {parseApiUrl} from 'rescape-helpers';
import {loginToAuthClientTask} from '../auth/login';
import {defaultSettingsCacheIdProps, defaultSettingsCacheOnlyObjs, defaultSettingsOutputParams} from './defaultSettingsStore';

/**
 * Create a typePolicies object that merges specified fields. This is needed so that non-normalized types
 * that are sub objects of normalized types property merge existing data with incoming. In our case this
 * is so that cache-only survives when data is loaded from the server. I produces typePolicies such as:
 * {
      SettingsType: {
        fields: {
          data: {
            merge(existing, incoming, { mergeObjects }) {
              // https://www.apollographql.com/docs/react/v3.0-beta/caching/cache-field-behavior/
              return mergeObjects(existing, incoming);
            },
          },
        },
      }
    }
 This is passed to InMemoryCache's typePolicies argument
 * @param {[Object]} typesWithFields list of objects with a type and field
 * @param {String} typesWithFields[].type The type, such as 'SettingsType'. Make sure this name matches
 * the __typename returned by the server,.
 * @param {[String]} typesWithFields[].fields List of fields to apply the merge function to
 */
export const typePoliciesWithMergeObjects = typesWithFields => {
  // Each type
  return R.mergeAll(
    R.map(
      ({type, fields}) => {
        return {
          [type]: {
            // Each field
            fields: R.mergeAll(
              R.map(
                field => {
                  return {
                    [field]: {
                      merge(existing, incoming, {mergeObjects}) {
                        // https://www.apollographql.com/docs/react/v3.0-beta/caching/cache-field-behavior/
                        return mergeObjects(
                          // Remove incoming keys from existing and clone it to unfreeze it.
                          // since it comes from the cache and will be written to the cache
                          // This assumes a merge strategy that takes the keys of incoming and doesn't do
                          // more fine-grained merging
                          R.compose(
                            unfrozen => R.merge(existing, unfrozen),
                            R.clone,
                            R.omit(R.keys(incoming))
                          )(existing),
                          incoming
                        );
                      }
                    }
                  };
                }, fields
              )
            )
          }
        };
      },
      typesWithFields
    )
  );
};


/**
 * Task to return and authorized client for tests
 * @param {{settings: {overpass: {cellSize: number, sleepBetweenCalls: number}, mapbox: {viewport: {latitude: number, zoom: number, longitude: number}, mapboxAuthentication: {mapboxApiAccessToken: string}}, domain: string, testAuthorization: {password: string, username: string}, api: {path: string, protocol: string, port: string, host: string}}, writeDefaults: (Object|Task)}} config The configuration to set up the test
 * @param {Object} config.settings.api
 * @param {String} [config.settings.api.protocol] E.g. 'http'
 * @param {String} [config.settings.api.host] E.g. 'localhost'
 * @param {String} [config.settings.api.port] E.g. '8008'
 * @param {String} [config.settings.api.path] E.g. '/graphql/'
 * @param {String} [config.settings.api.uri] Uri to use instead of the above parts
 * @param {Object} config.settings.testAuthorization Special test section in the settings with
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
export const createAuthTask = config => loginToAuthClientTask({
    cacheOptions: strPathOr({}, 'apollo.cacheOptions', config),
    uri: strPathOr(parseApiUrl(reqStrPathThrowing('settings.api', config)), 'uri', config),
    stateLinkResolvers: strPathOr({}, 'apollo.stateLinkResolvers', config),
    writeDefaults: reqStrPathThrowing('apollo.writeDefaultsCreator', config)(omitDeep(['apollo.writeDefaultsCreator'], config)),
    settingsConfig: {cacheOnlyObjs: defaultSettingsCacheOnlyObjs, cacheIdProps: defaultSettingsCacheIdProps, settingsOutputParams: defaultSettingsOutputParams}
  },
  reqStrPathThrowing('settings.testAuthorization', config)
);