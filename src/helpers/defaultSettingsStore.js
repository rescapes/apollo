import settings from './privateSettings.js';
import {makeSettingsCacheMutationContainer} from './settingsStore.js';
import {compact, omitDeep, reqStrPathThrowing, strPathOr} from '@rescapes/ramda';
import {composeWithComponentMaybeOrTaskChain, getRenderPropFunction, nameComponent} from './componentHelpersMonadic.js';
import {settingsQueryContainerDefault} from './defaultContainers.js';
import * as R from 'ramda';
import {loggers} from '@rescapes/log';
import {inspect} from 'util';
import T from 'folktale/concurrency/task/index.js';
import {queryLocalTokenAuthContainer} from '../stores/tokenAuthStore.js';
import {containerForApolloType, mapTaskOrComponentToNamedResponseAndInputs} from './containerHelpers.js';
import {e} from '@rescapes/helpers-component';

const {of} = T;
const log = loggers.get('rescapeDefault');

/**
 * Created by Andy Likuski on 2018.12.31
 * Copyright (c) 2018 Andy Likuski
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 */

export const defaultSettingsTypenames =
  {
    __typename: 'SettingsType',
    data: {
      __typename: 'SettingsDataType',
      api: {
        _typename: 'SettingsApiDataType'
      },
      overpass: {
        _typename: 'SettingsOverpassDataType'
      },
      mapbox: {
        _typename: 'MapboxApiDataType'
      }
    }
  };

// Global settings.
// omitCacheOnlyFields to true to omit cache only fields from the query
export const defaultSettingsOutputParams = {
  id: 1,
  key: 1,
  data: {
    domain: 1,
    api: {
      protocol: 1,
      host: 1,
      port: 1,
      path: 1
    },
    'testAuthorization @client': {
      username: 1,
      password: 1
    },
    // Overpass API configuration to play nice with the server's strict throttling
    overpass: {
      cellSize: 1,
      sleepBetweenCalls: 1
    },
    mapbox:
      {
        'mapboxAuthentication @client': {
          mapboxApiAccessToken: 1
        },
        viewport: {
          zoom: 1,
          latitude: 1,
          longitude: 1
        }
      }
  }
};

// Paths to prop values that we don't store in the database, but only in the cache
// The prop paths are marked with a client directive when querying (see defaultSettingsOutputParams)
// so we never try to load them from the database.
export const defaultSettingsCacheOnlyObjs = ['data.testAuthorization', 'data.mapbox.mapboxAuthentication'];
// These values come back from the server and get merged into cacheOnlyProps for identification
export const defaultSettingsCacheIdProps = [
  'key',
  'id',
  '__typename',
  'data.__typename',
  'data.mapbox.__typename'
];

export const settingsTypeIdPathLookup = {
  // Identify routes as unique by key
  ['data.routing.routes']: ['key']
};

export const settingsTypePolicy = {
  type: 'SettingsType',
  keyFields: ['key'],
  fields: ['data'],
  idPathLookup: settingsTypeIdPathLookup,
  cacheOnlyFieldLookup: {
    data: {testAuthorization: true, mapbox: true}
  }
};

export const settingsDataTypePolicy = {
  type: 'SettingsDataType',
  fields: ['mapbox'],
  cacheOnlyFieldLookup: {
    mapbox: {mapboxAuthentication: true}
  }
};


/**
 * Writes or rewrites the default settings to the cache if needed.
 * Non-server values in the config are ignored and must be added manually.
 * If the apollo client isn't authenticated we write straight to cache
 * @param {Object} config
 * @param {Object} config.settings The settings to write. It must match Settings object of the Apollo schema,
 * although cache-only values can be included
 * @param {Object} config.defaultSettingsTypenames Typenames of the settings in the form
 * {
 *   __typename: string,
 *   data: {
 *     __typename: string
 *     foo: {...}
 *   }
 * }
 * Only need to write settings to the cache for an unauthed user when no settings are on the server (rare)
 */
export const writeConfigToServerAndCacheContainer = (config) => {
  return (apolloClient, {cacheOnlyObjs, cacheIdProps, settingsOutputParams}, {render}) => {
    const apolloConfig = compact({apolloClient});
    // Only the settings are written to the server
    const props = R.merge(R.prop('settings', config), {render});
    const defaultSettingsTypenames = reqStrPathThrowing('settingsConfig.defaultSettingsTypenames', config);
    return composeWithComponentMaybeOrTaskChain([
      mapTaskOrComponentToNamedResponseAndInputs(apolloConfig, 'void',
        ({settingsFromServer, settingsWithoutCacheValues, render}) => {
          log.debug(`settingsWithoutCacheValues: ${inspect(settingsWithoutCacheValues, {depth: 10})}`);
          return containerForApolloType(
            apolloConfig,
            {
              render: getRenderPropFunction(render),
              // This isn't actually used
              response: R.prop('skip', settingsFromServer) ? settingsWithoutCacheValues : settingsFromServer
            }
          );
        }
      ),
      // Update/Create the default settings to the database. This puts them in the cache
      mapTaskOrComponentToNamedResponseAndInputs(apolloConfig, 'settingsWithoutCacheValues',
        ({settingsFromServer, authTokenResponse}) => {
          const settings = strPathOr({}, 'data.settings.0', settingsFromServer);
          const _settings = omitDeep(['__typename'], settings)
          return nameComponent('settingsMutation',
            R.ifElse(
              // If we are authenticated and the local settings have changed from the server (unlikely),
              // mutate the server settings
              () => false && R.and(strPathOr(false, 'data.token', authTokenResponse),
                R.complement(R.equals)(R.merge(R.omit(['render'], props), _settings), _settings)
              ),
              () => {
                // Update the settings on the server with those configured in code.
                // TODO this should be removed in favor of a one time database write
                // in a server init script
                // TODO commened out, causing bad data on the server
                /*
                return makeSettingsMutationContainer(
                  apolloConfig,
                  {cacheOnlyObjs, cacheIdProps, outputParams: settingsOutputParams},
                  R.merge(props, R.pick(['id'], settings))
                );
                 */
              },
              () => {
                // Not authenticated or no updates needed
                // Write the server or configured values to the cache manually
                // If we have settings from the server, they will already be in the cache,
                // but we need to write any non server settings
                // If we don't have settings from the server and we aren't authenticated, just
                // cache the configured settings
                const settingsToCache = R.length(R.keys(settings)) ? settings : R.mergeDeepWithKey(
                  (k, l, r) => {
                    if (Array.isArray(l)) {
                      // Merge the typename of defaultSettingsTypenames into each item of arrays
                      return R.map(item => R.merge(item, r), l)
                    } else {
                      // Merge the typename of defaultSettingsTypenames into the obj
                      return R.merge(l, r)
                    }
                  },
                  props,
                  // TODO this should come from the remote schema so it can be customized
                  // to the app's settings
                  defaultSettingsTypenames
                );
                return makeSettingsCacheMutationContainer(
                  apolloConfig,
                  {outputParams: settingsOutputParams},
                  props,
                  settingsToCache
                );
              }
            ))();
        }
      ),
      mapTaskOrComponentToNamedResponseAndInputs(apolloConfig, 'authTokenResponse',
        ({settingsFromServer, render}) => {
          if (!R.prop('skip', settingsFromServer) && !R.prop('data', settingsFromServer)) {
            // Wait for loading
            return nameComponent('settingsFromServer', e('div', {}, 'loading'));
          }
          return queryLocalTokenAuthContainer(apolloConfig, {render});
        }
      ),
      // Fetch the props if they exist on the server
      mapTaskOrComponentToNamedResponseAndInputs(apolloConfig, 'settingsFromServer',
        (props) => {
          return settingsQueryContainerDefault(
            apolloConfig,
            {outputParams: settingsOutputParams},
            R.merge({token: localStorage.getItem('token')}, props)
          );
        }
      )
    ])(props);
  };
};

/**
 * Writes or rewrites the default settings to the cache
 */
export const writeDefaultSettingsToCacheContainer = writeConfigToServerAndCacheContainer({
    settings,
    settingsConfig: {defaultSettingsTypenames}
  }
);