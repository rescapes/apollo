import {createCacheOnlyProps, makeCacheMutation} from './mutationCacheHelpers';
import {makeQueryContainer} from './queryHelpers';
import {_addMutateKeyToMutationResponse, makeMutationRequestContainer} from './mutationHelpers';
import {
  composeWithChain,
  mapToNamedPathAndInputs,
  mapToNamedResponseAndInputs,
  mergeDeep,
  omitDeepPaths,
  reqStrPathThrowing,
  strPathOr
} from 'rescape-ramda';
import {omitClientFields} from './requestHelpers';
import {v} from 'rescape-validate';
import * as R from 'ramda';
import PropTypes from 'prop-types';

/**
 * Created by Andy Likuski on 2020.03.20
 * Copyright (c) 2020 Andy Likuski
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

export const createCacheOnlyPropsForSettings = ({cacheOnlyObjs, cacheIdProps}, props) => {
  return createCacheOnlyProps({name: 'settings', cacheIdProps, cacheOnlyObjs}, props);
};

/**
 * Queries settings
 * @params {Object} apolloConfig The Apollo config. See makeQueryContainer for options
 * @params {Array|Object} outputParams OutputParams for the query such as defaultSettingsOutputParams
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
      outputParams: PropTypes.oneOfType([
        PropTypes.array,
        PropTypes.shape()
      ]).isRequired
    })
    ],
    ['props', PropTypes.shape().isRequired]
  ], 'makeSettingsQueryContainer');

/**
 * Makes a Settings mutation
 * @param {Object} apolloConfig Configuration of the Apollo Client when using one inst
 * @param {Object} apolloConfig.apolloClient An authorized Apollo Client
 * @param [String|Object] defaultSettingsOutputParams output parameters for the query in this style json format:
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
export const makeSettingsMutationContainer = v(R.curry((apolloConfig, {cacheOnlyObjs, cacheIdProps, outputParams}, props) => {
  return makeMutationRequestContainer(
    R.merge(
      apolloConfig,
      {
        options: {
          update: (store, response) => {
            // Add mutate to response.data so we dont' have to guess if it's a create or udpate
            const settings = reqStrPathThrowing(
              'data.mutate.settings',
              _addMutateKeyToMutationResponse({silent: true}, response)
            );
            // Mutate the cache to save settings to the database that are not stored on the server
            makeCacheMutation(
              apolloConfig,
              {
                name: 'settings',
                // output for the read fragment
                outputParams
              },
              createCacheOnlyPropsForSettings({cacheOnlyObjs, cacheIdProps}, mergeDeep(settings, props))
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
    cacheOnlyObjs: PropTypes.array.isRequired,
    cacheIdProps: PropTypes.array.isRequired,
    outputParams: PropTypes.oneOfType([
      PropTypes.array,
      PropTypes.shape()
    ]).isRequired
  }).isRequired
  ],
  ['props', PropTypes.shape().isRequired]
], 'makeSettingsMutationContainer');

/**
 * Writes or rewrites the default settings to the cache. Other values in the config are ignored
 * and must be added manually
 * @param {Object} config
 * @param {Object} config.settings The settings to write. It must match Settings object of the Apollo schema,
 * although cache-only values can be included
 */
export const writeConfigToServerAndCache = (config) => {
  return (apolloClient, {cacheOnlyObjs, cacheIdProps, settingsOutputParams}) => {
    // Only the settings are written to the server
    const settings = R.prop('settings', config);
    return composeWithChain([
      // Update/Create the default settings to the database. This puts them in the cache
      mapToNamedPathAndInputs('settingsWithoutCacheValues', 'data.mutate.settings',
        ({props, apolloConfig, settingsFromServer}) => {
          const settings = strPathOr({}, 'data.settings.0', settingsFromServer);
          return makeSettingsMutationContainer(
            apolloConfig,
            {cacheOnlyObjs, cacheIdProps, outputParams: settingsOutputParams},
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
        props: settings
      }
    );
  };
};