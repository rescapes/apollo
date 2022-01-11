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

import * as R from 'ramda';
import settings from './privateSettings.js';
import {mapToNamedPathAndInputs} from '@rescapes/ramda'
import moment from 'moment';
import {omitClientFields} from './requestHelpers.js';
import {
  defaultSettingsCacheIdProps,
  defaultSettingsCacheOnlyObjs,
  defaultSettingsOutputParams
} from './defaultSettingsStore.js';
import {makeSettingsMutationContainer, settingsQueryContainer} from './settingsStore.js';

/**
 * Created by Andy Likuski on 2019.01.22
 * Copyright (c) 2019 Andy Likuski
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 */

/**
 * Creates a sample settings with a mutation and does various queries to show that values cached by the mutation.update
 * remain in the cache as subsequent queries come in from the server
 * @params apolloClient
 * @return {Object} Returns the cacheOnlySettings, which are the settings stored in the cache that combine
 * what was written to the server with what is only stored in the cache. settings contains what was only
 * stored on the server
 */
export const createSampleSettingsTask = apolloConfig => {
  return R.composeK(
    // Now query and force it to got to the server.
    // This MUST use omitClientFields or the query will return data: null
    mapToNamedPathAndInputs('settingsFromServerOnly', 'data.settings.0',
      ({settingsWithoutCacheValues, apolloConfig: {apolloClient}}) => {
        return settingsQueryContainer(
          {
            apolloClient,
            options: {
              fetchPolicy: 'network-only'
            }
          },
          {outputParams: omitClientFields(defaultSettingsOutputParams)},
          R.pick(['id'], settingsWithoutCacheValues)
        );
      }
    ),
    // Now query for the server and cache-only props. This should match data in the cache and not need the server
    // So let's force it go to the server so we are sure that the server and cache-only values work
    mapToNamedPathAndInputs('settingsFromCache', 'data.settings.0',
      ({settingsWithoutCacheValues, apolloConfig: {apolloClient}, defaultSettingsOutputParams}) => {
        return settingsQueryContainer(
          {
            apolloClient,
            options: {
              fetchPolicy: 'cache-only'
            }
          },
          {outputParams: defaultSettingsOutputParams},
          R.pick(['id'], settingsWithoutCacheValues)
        );
      }
    ),
    // Query to get the value in the cache.
    // Note that the data that mutation put in the cache is not matched here.
    // However the result of this query correctly merges that from the server with the cache-only values
    // It seems like the query itself must run once before the same data can be found in the cache, since
    // Apollo doesn't know how many values the query might return
    mapToNamedPathAndInputs('settingsFromQuery', 'data.settings.0',
      ({settingsWithoutCacheValues, apolloConfig, defaultSettingsOutputParams}) => {
        return settingsQueryContainer(
          apolloConfig,
          {outputParams: defaultSettingsOutputParams},
          R.pick(['id'], settingsWithoutCacheValues)
        );
      }
    ),
    // Mutate the settings to the database
    mapToNamedPathAndInputs('settingsWithoutCacheValues', 'result.data.mutate.settings',
      ({props, apolloConfig, defaultSettingsOutputParams}) => {
        return makeSettingsMutationContainer(
          apolloConfig,
          {
            outputParams: defaultSettingsOutputParams,
            cacheIdProps: defaultSettingsCacheIdProps,
            cacheOnlyObjs: defaultSettingsCacheOnlyObjs
          },
          props
        );
      }
    )
  )(
    // Settings is merged into the overall application state
    {
      apolloConfig,
      defaultSettingsOutputParams,
      // Give the default settings a new to create a new settings object in the database
      // Normally we just have the default settings in the database
      props: R.merge(
        settings,
        {key: `test${moment().format('HH-mm-SS')}`}
      )
    }
  );
};

