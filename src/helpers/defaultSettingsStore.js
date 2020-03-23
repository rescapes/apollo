import settings from './privateTestSettings';
import {writeConfigToServerAndCache} from './settingsStore';

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
  'data.__typename'
];


/**
 * Writes or rewrites the default settings to the cache
 */
export const writeDefaultSettingsToCache = writeConfigToServerAndCache({settings});
