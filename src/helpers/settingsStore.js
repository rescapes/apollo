import {createCacheOnlyProps, makeCacheMutation, mergeCacheable} from './mutationCacheHelpers.js';
import {makeQueryContainer} from './queryHelpers.js';
import {addMutateKeyToMutationResponse} from './containerHelpers.js';
import {makeMutationRequestContainer} from './mutationHelpers';
import {mapToNamedResponseAndInputs, omitDeepPaths, reqStrPathThrowing, strPathOr} from '@rescapes/ramda';
import {omitClientFields} from './requestHelpers.js';
import {v} from '@rescapes/validate';
import * as R from 'ramda';
import PropTypes from 'prop-types';
import T from 'folktale/concurrency/task/index.js';
import {isAuthenticatedLocal} from '../stores/userStore.js';
import {makeCacheMutationContainer} from './mutationCacheHelpers';
import {composeWithComponentMaybeOrTaskChain, nameComponent} from './componentHelpersMonadic';

const {of} = T;

export const settingsTypePolicy = {type: 'SettingsType', fields: ['data']};
export const settingsDataTypePolicy = {type: 'SettingsDataType', fields: ['mapbox']};

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

/**
 * Uses the given configuration to extract the props that only belong in the cache
 * @param cacheOnlyObjs
 * @param cacheIdProps
 * @param props
 * @return {Object} Modified props
 */
export const createCacheOnlyPropsForSettings = ({cacheOnlyObjs, cacheIdProps}, props) => {
  return createCacheOnlyProps({name: 'settings', cacheIdProps, cacheOnlyObjs}, props);
};

/**
 * Queries settings
 * @params {Object} apolloConfig The Apollo config. See makeQueryContainer for options
 * @params {Array|Object} outputParams OutputParams for the query such as defaultSettingsOutputParams
 * @params {Object} props Arguments for the Settings query. This can be {} or null to not filter.
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
          update: (store, {data, ...rest}) => {
            const _response = {result: {data}, ...rest}
            // Add mutate to response.data so we dont' have to guess if it's a create or update
            const settings = reqStrPathThrowing(
              'result.data.mutate.settings',
              addMutateKeyToMutationResponse({silent: true}, _response)
            );
            makeSettingsCacheMutation(apolloConfig, {outputParams}, props, settings);
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

export const makeSettingsCacheMutation = (apolloConfig, {outputParams}, props, settings) => {

  // Add the cache only values to the persisted settings
  const propsWithCacheOnlyItems = mergeCacheable({}, settings, props);

  // Mutate the cache to save settings to the database that are not stored on the server
  makeCacheMutation(
    apolloConfig,
    {
      name: 'settings',
      // Use key instead of id in the case of the unauthenticated user needs to cache default settings
      idField: props => R.propOr(R.prop('key', props), 'id', props),
      // output for the read fragment
      outputParams
    },
    propsWithCacheOnlyItems
  );
};

export const makeSettingsCacheMutationContainer = (apolloConfig, {outputParams}, props, settings) => {

  // Add the cache only values to the persisted settings
  const propsWithCacheOnlyItems = mergeCacheable({}, settings, props);

  // Mutate the cache to save settings to the database that are not stored on the server
  return makeCacheMutationContainer(
    apolloConfig,
    {
      name: 'settings',
      // Use key instead of id in the case of the unauthenticated user needs to cache default settings
      idField: props => R.propOr(R.prop('key', props), 'id', props),
      // output for the read fragment
      outputParams
    },
    propsWithCacheOnlyItems
  );
};

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
      // Update/Create the default settings to the database. This puts them in the cache
      mapToNamedResponseAndInputs('settingsWithoutCacheValues',
        settingsFromServer => {
          const settings = strPathOr({}, 'data.settings.0', settingsFromServer);
          return nameComponent('settingsMutation', R.ifElse(
            () => {
              // If we are authenticated and the server settings don't match the config, update
              // TODO This should only be done by admins
              return isAuthenticatedLocal(apolloConfig) && R.not(
                R.equals(
                  settings,
                  omitDeepPaths(cacheOnlyObjs, props)
                )
              );
            },
            () => {
              return makeSettingsMutationContainer(
                apolloConfig,
                {cacheOnlyObjs, cacheIdProps, outputParams: settingsOutputParams},
                R.merge(props, R.pick(['id'], settings))
              );
            },
            () => {
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

      // Fetch the props if they exist on the server
      mapToNamedResponseAndInputs('settingsFromServer',
        (props) => {
          return nameComponent('settingsQuery', makeSettingsQueryContainer(
            R.merge(apolloConfig, {
              options: {
                skip: !localStorage.getItem('token'),
                fetchPolicy: 'network-only'
              }
            }),
            {outputParams: omitClientFields(settingsOutputParams)},
            R.pick(['key'], props)
          ));
        }
      )
    ])(props)
  };
};
