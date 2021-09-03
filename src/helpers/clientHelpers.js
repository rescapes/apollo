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
import {
  mergeDeepWithRecurseArrayItemsByAndMergeObjectByRight,
  omitDeep,
  reqStrPathThrowing,
  strPathOr
} from '@rescapes/ramda';
import {parseApiUrl} from '@rescapes/helpers';
import {
  defaultSettingsCacheIdProps,
  defaultSettingsCacheOnlyObjs,
} from './defaultSettingsStore.js';
import {firstMatchingPathLookup} from './utilityHelpers.js';
import {loggers} from '@rescapes/log';
import {writeDefaultsAndQueryCurrentUserContainer} from '../client/apolloClientAuthentication.js';

const log = loggers.get('rescapeDefault');

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
      ({type, fields, idPathLookup, cacheOnlyFieldLookup, keyFields, name, outputParams}) => {
        return {
          [type]: {
            keyFields,
            // name and outputParams are only for singletons that need to be initialized to null in the cache
            // so that observing queries can respond to the first write (namely for ObtainJSONWebToken)
            name,
            outputParams,
            // Each field
            fields: fields && R.mergeAll(
              R.map(
                field => {
                  return {
                    [field]: {
                      merge(existing, incoming, {mergeObjects}) {
                        log.debug(`Merge field for type ${type}, field ${field}`);
                        return mergeField({
                            mergeObjects,
                            idPathLookup,
                            // Get the lookup of child fields that are cache only. This can be child fields
                            // of the object or of the array item objects
                            cacheOnlyFieldLookup: R.propOr({}, field, cacheOnlyFieldLookup)
                          },
                          field,
                          existing,
                          incoming
                        );
                      }
                    }
                  };
                },
                fields
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
 * Merge objects including those with arrays
 * @param {Object} config
 * @param {Function} config.mergeObjects InMemoryCache's merge function
 * @param {Object} config.idPathLookup Id path lookup for objects wihtout ids
 * @param {Object} config.cacheOnlyFieldLookup For fields that only exist in the cache. Keyed by field name
 * and valued with true
 * @param {String} field The current field of existent and incoming
 * @param {Object} existing Existing cache item
 * @param {Object} incoming Incoming cache write item
 * @return {Object} The merged cache object
 */
const mergeField = ({mergeObjects, idPathLookup, cacheOnlyFieldLookup}, field, existing, incoming) => {
  // https://www.apollographql.com/docs/react/v3.0-beta/caching/cache-field-behavior/
  // Remove incoming keys from existing and clone it to unfreeze it.
  // since it comes from the cache and will be written to the cache
  const clone = existing => R.unless(
    R.isNil,
    R.compose(
      unfrozen => R.merge(existing, unfrozen),
      R.clone,
      R.omit(R.keys(incoming || {}))
    )
  )(existing);

  // Merge array items by given the configured id path or default to id,
  // but drop existing items that have no match in incoming
  const getUpdatedIncoming = function (existing, incoming) {
    return R.reduce(
      (accIncoming, cacheField) => R.over(
        R.lensProp(cacheField),
        value => {
          return R.when(
            R.isNil,
            value => {
              // Copy the existing value to incoming if incoming lacks it and existing has it
              return R.propOr(value, cacheField, existing);
            }
            // Or null to write null as a default
          )(value || null);
        },
        accIncoming
      ),
      incoming,
      R.keys(cacheOnlyFieldLookup)
    );
  };

  // If we are entering incoming data for the first time, we need to seed the cache only
  // values with null to prevent the Apollo inMemory cache from erring on MissingField
  if (!existing) {
    if (Array.isArray(incoming)) {
      return R.map(
        incomingItem => getUpdatedIncoming(null, incomingItem),
        incoming
      );
    } else {
      return getUpdatedIncoming(null, incoming);
    }
  }

  return mergeDeepWithRecurseArrayItemsByAndMergeObjectByRight(
    item => {
      // Use idPathLookup to identify an id for item[propKey]. idPathLookup is only needed if
      // item[field] does not have its own id.
      return firstMatchingPathLookup(idPathLookup, field, item);
    },
    (existing, incoming) => {
      // Update incoming to have existing cache fields. Default to null so there is always
      // a value in the cache. Otherwise Apollo freaks out and keeps getting missing field errors
      const updatedIncoming = getUpdatedIncoming(existing, incoming);
      // Handle objects with mergeObjects
      return mergeObjects(
        clone(existing),
        updatedIncoming
      );
    },
    existing,
    incoming
  );
};


/**
 * Creates an Apollo Client with authorization based on the presence of localStorage.getItem('token') having a
 * valid API token stored in it. This function should be used to create an ApolloClient when localStorage is
 * used, whether or not the token is present. The apollo-link-state check for token on each request
 * and sends if to the server if available.
 * @param {{settings: {overpass: {cellSize: number, sleepBetweenCalls: number}, mapbox: {viewport: {latitude: number, zoom: number, longitude: number}, mapboxAuthentication: {mapboxApiAccessToken: string}}, domain: string, testAuthorization: {password: string, username: string}, api: {path: string, protocol: string, port: string, host: string}}, writeDefaultsContainer: (Object|Task)}} config The configuration to set up the test
 * @param {Object} config.settings.data
 * @param {Object} config.settings.data.api
 * @param {String} [config.settings.data.api.protocol] E.g. 'http'
 * @param {String} [config.settings.data.api.host] E.g. 'localhost'
 * @param {String} [config.settings.data.api.port] E.g. '8008'
 * @param {String} [config.settings.data.api.path] E.g. '/graphql/'
 * @param {String} [config.settings.data.api.uri] Uri to use instead of the above parts
 * @param {Object} [config.settings.data.outputParams] Output params. Defaults to defaultSettingsOutputParams
 * @param {Object} config.settings.data.testAuthorization Special test section in the settings with
 * @param {Object} [config.apollo.stateLinkResolvers] Optional object of stateLinkResolvers to pass to the Apollo Client
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
 * @param {Object} props
 * @param {Function} [props.render] Render prop function for components only
 * @returns Returns an object {apolloClient:An authorized client}
 */
export const createLocalStorageAuthContainer = (config, {render}) => {
  return writeDefaultsAndQueryCurrentUserContainer({
    apolloConfig: reqStrPathThrowing('apolloConfig', config),
    cacheOptions: strPathOr({}, 'apollo.cacheOptions', config),
    uri: strPathOr(parseApiUrl(reqStrPathThrowing('settings.data.api', config)), 'uri', config),
    stateLinkResolvers: strPathOr({}, 'apollo.stateLinkResolvers', config),
    writeDefaultsContainer: reqStrPathThrowing('apollo.writeDefaultsCreator', config)(omitDeep(['apollo.writeDefaultsCreator'], config)),
    settingsConfig: {
      cacheOnlyObjs: defaultSettingsCacheOnlyObjs,
      cacheIdProps: defaultSettingsCacheIdProps,
      settingsOutputParams: reqStrPathThrowing('settingsConfig.settingsOutputParams', config)
    }
  }, {render});
};


