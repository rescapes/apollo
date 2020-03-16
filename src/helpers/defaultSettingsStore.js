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
import {v} from 'rescape-validate';
import PropTypes from 'prop-types';
import settings from '../helpers/privateTestSettings';
import {mapToNamedPathAndInputs, mergeDeep, omitDeepPaths, pickDeepPaths} from 'rescape-ramda';
import moment from 'moment';
import {makeMutationRequestContainer} from './mutationHelpers';
import {
  createCacheOnlyProps,
  makeCacheMutation,
  makeMutationWithClientDirectiveContainer
} from './mutationCacheHelpers';
import {makeQueryContainer} from './queryHelpers';
import {omitClientFields} from './requestHelpers';

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



// Every complex input type needs a type specified in graphql. Our type names are
// always in the form [GrapheneFieldType]of[GrapheneModeType]RelatedReadInputType
// Following this location.data is represented as follows:
// TODO These value should be derived from the schema
export const readInputTypeMapper = {};

// Global settings.
// omitCacheOnlyFields to true to omit cache only fields from the query
export const settingsOutputParams = [
  'id',
  'key',
  {
    'data': [
      'domain',
      {
        api: [
          'protocol',
          'host',
          'port',
          'path'
        ],
        'testAuthorization @client': [
          'username',
          'password'
        ],
        // Overpass API configuration to play nice with the server's strict throttling
        overpass: [
          'cellSize',
          'sleepBetweenCalls'
        ],
        mapbox: [
          {
            'mapboxAuthentication @client': [
              'mapboxApiAccessToken'
            ]
          },
          {
            'viewport': [
              'zoom',
              'latitude',
              'longitude'
            ]
          }
        ]
      }
    ]
  }
];

// Paths to prop values that we don't store in the database, but only in the cache
// The prop paths are marked with a client directive when querying (see settingsOutputParams)
// so we never try to load them from the database.
const cacheOnlyObjs = ['data.testAuthorization', 'data.mapbox.mapboxAuthentication'];
// These values come back from the server and get merged into cacheOnlyProps for identification
const cacheIdProps = [
  'id',
  '__typename',
  'data.__typename'
];

export const createCacheOnlyPropsForSettings = (props) => {
  return createCacheOnlyProps({name: 'settings', cacheIdProps, cacheOnlyObjs}, props);
};

/**
 * Creates a sample settings with a mutation and does various queries to show that values cached by the mutation.update
 * remain in the cache as subsequent queries come in from the server
 * @params apolloClient
 * @return {Object} Returns the cacheOnlySettings, which are the settings stored in the cache that combine
 * what was written to the server with what is only stored in the cache. settings contains what was only
 * stored on the server
 */
export const createSampleSettingsTask = (apolloConfig) => {
  return R.composeK(
    // Now query and force it to got to the server.
    // This risks wiping out our cash only values, but it seems InMemoryCache correctly merges the query results
    mapToNamedPathAndInputs('settingsFromServer', 'data.settings',
      ({settingsWithoutCacheValues, apolloConfig: {apolloClient}}) => {
        return makeSettingsQueryContainer(
          {
            apolloClient,
            options: {
              fetchPolicy: 'network-only'
            }
          },
          {outputParams: settingsOutputParams},
          R.pick(['id'], settingsWithoutCacheValues)
        );
      }
    ),
    // Now query for the server and cache-only props. This should match data in the cache and not need the server
    // So let's force it go to the server so we are sure that the server and cache-only values work
    mapToNamedPathAndInputs('settingsFromCache', 'data.settings',
      ({settingsWithoutCacheValues, apolloConfig: {apolloClient}}) => {
        return makeSettingsQueryContainer(
          {
            apolloClient,
            options: {
              fetchPolicy: 'cache-only'
            }
          },
          {outputParams: settingsOutputParams},
          R.pick(['id'], settingsWithoutCacheValues)
        );
      }
    ),
    // Query to get the value in the cache.
    // Note that the data that mutation puts in the cache is not matched here.
    // It seems like the query itself must run once before the same data can be found in the cache
    mapToNamedPathAndInputs('settingsFromQuery', 'data.settings',
      ({settingsWithoutCacheValues, apolloConfig}) => {
        return makeSettingsQueryContainer(
          apolloConfig,
          {outputParams: omitClientFields(settingsOutputParams)},
          R.pick(['id'], settingsWithoutCacheValues)
        );
      }
    ),
    // Mutate the settings to the database
    mapToNamedPathAndInputs('settingsWithoutCacheValues', 'data.createSettings.settings',
      ({props, apolloConfig}) => {
        return makeSettingsMutationContainer(
          apolloConfig,
          {outputParams: omitClientFields(settingsOutputParams)},
          props
        );
      }
    )
  )(
    // Settings is merged into the overall application state
    {
      apolloConfig,
      props: {
        key: `test${moment().format('HH-mm-SS')}`,
        data: settings
      }
    }
  );
};


/**
 * Queries settingss
 * @params {Object} apolloConfig The Apollo config. See makeQueryContainer for options
 * @params {Object} outputParams OutputParams for the query such as settingsOutputParams
 * @params {Object} props Arguments for the Settingss query. This can be {} or null to not filter.
 * @returns {Task} A Task containing the Settingss in an object with obj.data.settings or errors in obj.errors
 */
export const makeSettingsQueryContainer = v(R.curry((apolloConfig, {outputParams}, props) => {
    return makeQueryContainer(
      apolloConfig,
      {name: 'settings', readInputTypeMapper, outputParams},
      props
    );
  }),
  [
    ['apolloConfig', PropTypes.shape({apolloClient: PropTypes.shape()}).isRequired],
    ['queryStructure', PropTypes.shape({
      outputParams: PropTypes.array.isRequired
    })
    ],
    ['props', PropTypes.shape().isRequired]
  ], 'makeSettingsQueryContainer');

/**
 * Makes a Settings mutation
 * @param {Object} apolloConfig Configuration of the Apollo Client when using one inst
 * @param {Object} apolloConfig.apolloClient An authorized Apollo Client
 * @param [String|Object] outputParams output parameters for the query in this style json format:
 *  ['id',
 *   {
 *        data: [
 *         'foo',
 *         {
 *            properties: [
 *             'type',
 *            ]
 *         },
 *         'bar',
 *       ]
 *    }
 *  ]
 *  @param {Object} props Object matching the shape of a settings. E.g. {id: 1, city: "Stavanger", data: {foo: 2}}
 *  @returns {Task|Just} A container. For ApolloClient mutations we get a Task back. For Apollo components
 *  we get a Just.Maybe back. In the future the latter will be a Task when Apollo and React enables async components
 */
export const makeSettingsMutationContainer = v(R.curry((apolloConfig, {outputParams}, props) => {
  return makeMutationRequestContainer(
    R.merge(
      apolloConfig,
      {
        options: {
          update: (store, {data: {createSettings: {settings}}}) => {
            // Mutate the cache to save settings to the database that are not stored on the server
            makeCacheMutation(
              apolloConfig,
              {
                name: 'settings',
                // output for the read fragment
                outputParams: settingsOutputParams
              },
              createCacheOnlyPropsForSettings(mergeDeep(settings, props))
            );
          }
        }
      }
    ),
    {
      name: 'settings',
      outputParams
    },
    // Remove client-side only values
    omitDeepPaths(cacheOnlyObjs, props)
  );
}), [
  ['apolloConfig', PropTypes.shape().isRequired],
  ['mutationStructure', PropTypes.shape({
    outputParams: PropTypes.array.isRequired
  })
  ],
  ['props', PropTypes.shape().isRequired]
], 'makeSettingsMutationContainer');

/**
 * Updates the cached settings query with values that are never stored in the database as indicated above in cacheOnlyProps
 */
export const makeSettingsClientMutationContainer = v(R.curry(
  (apolloConfig, {outputParams}, props) => {
    return makeMutationWithClientDirectiveContainer(
      apolloConfig,
      {
        name: 'settings',
        outputParams
      },
      // These our the paths that we only want in the cache, not sent to the server
      pickDeepPaths(
        R.concat(cacheOnlyObjs, cacheIdProps),
        props
      )
    );
  }
), [
  ['apolloConfig', PropTypes.shape().isRequired],
  ['mutationStructure', PropTypes.shape({
    outputParams: PropTypes.array.isRequired
  })
  ],
  ['props', PropTypes.shape().isRequired]
], 'makeSettingsClientMutationContainer');

/**
 * Writes the default settings to the cache
 * @param apolloClient
 * @return {*}
 */
export const writeSettingsToCache = apolloClient => {
  return makeCacheMutation(
    {apolloClient},
    {
      name: 'settings',
      // output for the read fragment
      outputParams: settingsOutputParams
    },
    settings
  );
};