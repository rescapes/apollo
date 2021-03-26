import settings from './privateSettings.js';
import {makeSettingsCacheMutationContainer, makeSettingsMutationContainer} from './settingsStore.js';
import {mapToNamedPathAndInputs, mapToNamedResponseAndInputs, reqStrPathThrowing, strPathOr} from '@rescapes/ramda';
import {composeWithComponentMaybeOrTaskChain, nameComponent} from './componentHelpersMonadic';
import {authenticatedUserLocalContainer} from '../stores/userStore';
import {querySettingsContainerDefault} from './defaultContainers';
import * as R from 'ramda';

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
  'id',
  '__typename',
  'data.__typename',
  'data.mapbox.__typename'
];


/**
 * Writes or rewrites the default settings to the cache if needed.
 * Non-server values in the config are ignored and must be added manually.
 * If the apollo client isn't authenticated we write straight to cache
 * @param {Object} config
 * @param {Object} config.settings The settings to write. It must match Settings object of the Apollo schema,
 * although cache-only values can be included
 * @param {Object} config.defaultSettingsTypenames Typenmaes of the settings in the form
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
  return (apolloClient, {cacheOnlyObjs, cacheIdProps, settingsOutputParams}) => {
    const apolloConfig = {apolloClient};
    // Only the settings are written to the server
    const props = R.prop('settings', config);
    const defaultSettingsTypenames = reqStrPathThrowing('settingsConfig.defaultSettingsTypenames', config);
    return composeWithComponentMaybeOrTaskChain([
      mapToNamedResponseAndInputs('void',
        ({settingsWithoutCacheValues}) => {
          log.debug(`settingsWithoutCacheValues: ${inspect(settingsWithoutCacheValues, {depth: 10})}`);
          return null;
        }
      ),
      // Update/Create the default settings to the database. This puts them in the cache
      mapToNamedResponseAndInputs('settingsWithoutCacheValues',
        ({settingsFromServer, user}) => {
          const settings = strPathOr({}, 'data.settings.0', settingsFromServer);
          return nameComponent('settingsMutation', R.ifElse(
            () => user,
            () => {
              // Update the settings on the server with those configured in code.
              // TODO this should be removed in favor of a one time database write
              // in a server init script
              return makeSettingsMutationContainer(
                apolloConfig,
                {cacheOnlyObjs, cacheIdProps, outputParams: settingsOutputParams},
                R.merge(props, R.pick(['id'], settings))
              );
            },
            () => {
              // Not authenticated or no updates needed
              // Write the server or configured values to the cache manually
              // If we have settings from the server, they will already be in the cache,
              // but we need to write any non server settings
              // If we don't have settings from the server and we aren't authenticated, just
              // cache the configured settings
              const settingsToCache = R.length(R.keys(settings)) ? settings : R.mergeDeepRight(
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
      mapToNamedPathAndInputs('userAuthToken', 'data.currentUser',
        () => {
          return authenticatedUserLocalContainer({apolloClient}, {});
        }
      ),
      // Fetch the props if they exist on the server
      mapToNamedResponseAndInputs('settingsFromServer',
        (props) => {
          return querySettingsContainerDefault(
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