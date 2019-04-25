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
import {makeMutationRequestContainer} from '../helpers/mutationHelpers';
import {v} from 'rescape-validate';
import {makeQueryContainer} from '../helpers/queryHelpers';
import PropTypes from 'prop-types';
import {mapboxOutputParamsFragment} from './mapStores/mapboxStore';
import {makeMutationWithClientDirectiveContainer} from '../helpers/mutationCacheHelpers';
import settings from '../helpers/privateTestSettings';
import {pickDeepPaths, omitDeepPaths} from 'rescape-ramda'

// Every complex input type needs a type specified in graphql. Our type names are
// always in the form [GrapheneFieldType]of[GrapheneModeType]RelatedReadInputType
// Following this location.data is represented as follows:
// TODO These value should be derived from the schema
export const readInputTypeMapper = {};

// Global settings.
// omitCacheOnlyFields to true to omit cache only fields from the query
export const settingsOutputParams = (omitCacheOnlyFields = false) => [
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
        // Used only in unit tests to authorize
        // This will only come from the local cache using a @client directive
        ...omitCacheOnlyFields ? {} :
        {'testAuthorization @client': [
          'username',
          'password'
        ]},
        // Overpass API configuration to play nice with the server's strict throttling
        overpass: [
          'cellSize',
          'sleepBetweenCalls'
        ],
        // Combine the mapbox fragment, which contains the viewport with our mapbox settings
        // The viewport in this case is the initial viewport
        mapbox: R.concat(
          R.view(
            R.lensPath([0, 'mapbox']),
            mapboxOutputParamsFragment
          ),
          // Only stored in the cache
          omitCacheOnlyFields ? [] : [
            'mapboxApiAccessToken @client',
          ]
        )
      }
    ]
  }
];
// Paths to prop values that we don't store in the database, but only in the cache
// The prop paths are marked with a client directive when querying (see settingsOutputParams)
// so we never try to load them from the database.
const cacheOnlyProps = ['data.testAuthorization', 'data.mapbox.mapboxApiAccessToken'];
// These values come back from makeSettingssQueryContainer and makeSettingsMutationContainer.
// Include these in makeSettingsClientMutationContainer so we know where to write to cache
const cacheIdProps = ['id', '__typename', 'data.__typename'];

/**
 * Queries settingss
 * @params {Object} apolloConfig The Apollo config. See makeQueryContainer for options
 * @params {Object} outputParams OutputParams for the query such as settingsOutputParams
 * @params {Object} component Optional component for ApolloComponent queries. Leave null for client queries
 * @params {Object} props Arguments for the Settingss query. This can be {} or null to not filter.
 * @returns {Task} A Task containing the Settingss in an object with obj.data.settingss or errors in obj.errors
 */
export const makeSettingssQueryContainer = v(R.curry((apolloConfig, {outputParams, propsStructure}, component, props) => {
    return makeQueryContainer(
      apolloConfig,
      // Intentionally spelled with a second s
      {name: 'settingss', readInputTypeMapper, outputParams, propsStructure},
      component,
      props
    );
  }),
  [
    ['apolloConfig', PropTypes.shape({apolloClient: PropTypes.shape()}).isRequired],
    ['queryStructure', PropTypes.shape({
      outputParams: PropTypes.array.isRequired,
      propsStructure: PropTypes.shape()
    })
    ],
    ['component', PropTypes.func],
    ['props', PropTypes.shape().isRequired]
  ], 'makeSettingssQueryContainer');

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
 *  @param {Function} component The Apollo component if doing a component mutation. Otherwise null
 *  @param {Object} props Object matching the shape of a settings. E.g. {id: 1, city: "Stavanger", data: {foo: 2}}
 *  @returns {Task|Just} A container. For ApolloClient mutations we get a Task back. For Apollo components
 *  we get a Just.Maybe back. In the future the latter will be a Task when Apollo and React enables async components
 */
export const makeSettingsMutationContainer = v(R.curry(
  (apolloConfig, {outputParams}, component, props) => makeMutationRequestContainer(
    apolloConfig,
    {
      name: 'settings',
      outputParams
    },
    component,
    // Remove client-side only values
    omitDeepPaths(cacheOnlyProps, props)
  )), [
  ['apolloConfig', PropTypes.shape().isRequired],
  ['mutationStructure', PropTypes.shape({
    outputParams: PropTypes.array.isRequired
  })
  ],
  ['component', PropTypes.func],
  ['props', PropTypes.shape().isRequired]
], 'makeSettingsMutationContainer');


/**
 * Updates the cached settings query with values that are never stored in the database as indicated above in cacheOnlyProps
 */
export const makeSettingsClientMutationContainer = v(R.curry(
  (apolloConfig, {outputParams}, component, props) => {
    return makeMutationWithClientDirectiveContainer(
      apolloConfig,
      {
        name: 'settings',
        outputParams
      },
      component,
      // These our the paths that we only want in the cache, not sent to the server
      pickDeepPaths(
        R.concat(cacheOnlyProps, cacheIdProps),
        props
      )
    )
  }
), [
  ['apolloConfig', PropTypes.shape().isRequired],
  ['mutationStructure', PropTypes.shape({
    outputParams: PropTypes.array.isRequired
  })
  ],
  ['component', PropTypes.func],
  ['props', PropTypes.shape().isRequired]
], 'makeSettingsClientMutationContainer');