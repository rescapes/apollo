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
import {
  composeWithChain,
  mapToNamedPathAndInputs,
  mapToNamedResponseAndInputs,
  mergeDeep,
  omitDeepPaths,
  pickDeepPaths, reqPathThrowing, reqStrPathThrowing, strPathOr
} from 'rescape-ramda';
import {_addMutateKeyToMutationResponse, makeMutationRequestContainer} from './mutationHelpers';
import {
  createCacheOnlyProps,
  makeCacheMutation,
  makeMutationWithClientDirectiveContainer
} from './mutationCacheHelpers';
import {makeQueryContainer} from './queryHelpers';
import {omitClientFields} from './requestHelpers';
import {of} from 'folktale/concurrency/task';

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
          update: (store, response) => {
            const settings = reqStrPathThrowing('data.mutate.settings', _addMutateKeyToMutationResponse(response));
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
 * Writes or rewrites the default settings to the cache. Other values in the config are ignored
 * and must be added manually
 * @param {Object} config The settings to write. It must match Settings object of the Apollo schema,
 * although cache-only values can be included
 * @param {Object} apolloClient The Apollo Client
 * @param {Object} config
 * @param {Boolean } config.reset TODO Currenlty Unused True if this is a reset call, false if it's the initial writing of the settings to cache
 * @return {Object|Task} If we are reseting, returns and object that can be ignored. If setting initially, returns
 * a task to be run so that we can read/write from/to the server if needed
 */
export const writeConfigToServerAndCache = config => (apolloClient, {reset}) => {
  // Only the settings are written to the server
  const settings = R.prop('settings', config);
  return composeWithChain([
    // Update/Create the default settings to the database. This puts them in the cache
    mapToNamedPathAndInputs('settingsWithoutCacheValues', 'data.mutate.settings',
      ({props, apolloConfig, settingsFromServer}) => {
        const settings = strPathOr({}, 'data.settings.0', settingsFromServer);
        return makeSettingsMutationContainer(
          apolloConfig,
          {outputParams: settingsOutputParams},
          R.merge(props, R.pick(['id'], settings))
        );
      }
    ),
    // Fetch the props if they exist on the server
    mapToNamedResponseAndInputs('settingsFromServer',
      ({apolloConfig, props}) => {
        return makeSettingsQueryContainer(
          R.merge(apolloConfig, {
            options: {
              fetchPolicy: 'network-only'
            }
          }),
          {outputParams: omitClientFields(settingsOutputParams)},
          R.pick(['key'], props)
        );
      }
    )
  ])({
      apolloConfig: {apolloClient},
      config,
      props: {
        // We currently use 'default' for the only settings in the database
        key: 'default',
        data: settings
      }
    }
  );
};

/**
 * Writes or rewrites the default settings to the cache
 */
export const writeDefaultSettingsToCache = writeConfigToServerAndCache(settings);
