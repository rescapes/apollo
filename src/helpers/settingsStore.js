import {createCacheOnlyProps, makeCacheMutation, mergeCacheable} from './mutationCacheHelpers.js';
import {composeFuncAtPathIntoApolloConfig, makeQueryContainer} from './queryHelpers.js';
import {
  addMutateKeyToMutationResponse,
  containerForApolloType,
  mapTaskOrComponentToNamedResponseAndInputs
} from './containerHelpers.js';
import {makeMutationRequestContainer} from './mutationHelpers.js';
import {omitDeepPaths, reqStrPathThrowing, strPathOr} from '@rescapes/ramda';
import {v} from '@rescapes/validate';
import * as R from 'ramda';
import PropTypes from 'prop-types';
import T from 'folktale/concurrency/task/index.js';
import {makeCacheMutationContainer} from './mutationCacheHelpers.js';
import {loggers} from '@rescapes/log';
import {
  queryFromCacheContainer,
  makeQueryFromCacheContainer,
  makeReadFragmentFromCacheContainer
} from './queryCacheHelpers.js';
import {composeWithComponentMaybeOrTaskChain, getRenderPropFunction} from './componentHelpersMonadic.js';
import {queryLocalTokenAuthContainer} from '../stores/tokenAuthStore.js';

const {of} = T;
const log = loggers.get('rescapeDefault');

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
 * @returns {Task} A Task containing the Settings in an object with obj.data.settings or errors in obj.errors
 */
export const settingsQueryContainer = v(R.curry((apolloConfig, {outputParams}, props) => {
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
  ], 'settingsQueryContainer');


export const settingsLocalQueryContainer = (apolloConfig, {outputParams}, props) => {
  return makeQueryFromCacheContainer(
    composeFuncAtPathIntoApolloConfig(
      apolloConfig,
      'options.variables',
      props => {
        // We always query settings by key, because we cache it that way and don't care about the id
        return R.pick(['key'], props);
      }
    ),
    {name: 'settings', readInputTypeMapper, outputParams},
    props
  );
};

/**
 * Container to get local settings
 *
 * @param {Object} apolloConfig
 * @param apolloConfig.apolloClient. If non-null then a task is returned. If null
 * an apollo component is returned.
 * @param {Object} options
 * @param {Object} options.outputParams Must be specified since different settings are different
 * for each application
 * @param {Object} props
 * @param {Object} props.key Required unless using id
 * @param {Object} [props.render] Required for component queries
 * @returns {Task|Object} For hits, task or component resolving to {data: settings object}
 * otherwise resolves to {data: null}
 */
export const settingsCacheContainer = (apolloConfig, {outputParams}, props) => {
  return queryFromCacheContainer(
    apolloConfig, {
      name: 'settings',
      readInputTypeMapper,
      outputParams,
      typename: 'SettingsType',
      allowUnauthenticated: true,
      idField: 'key'
    }, props
  )
}


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
export const makeSettingsMutationContainer = v(R.curry((apolloConfig, {
  cacheOnlyObjs,
  cacheIdProps,
  outputParams
}, props) => {
  return makeMutationRequestContainer(
    R.mergeRight(
      apolloConfig,
      {
        options: {
          update: (store, {data, ...rest}) => {
            const _response = {result: {data}, ...rest};
            // Add mutate to response.data so we don't have to guess if it's a create or update
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

/**
 * Mutates the settings in the cache
 * @param apolloConfig
 * @param outputParams
 * @param existingSettingsWithCacheOnly
 * @param incomingSettings
 * @returns [{Object}] The result of one or more cache mutations, usually not needed
 */
export const makeSettingsCacheMutation = (apolloConfig, {outputParams}, existingSettingsWithCacheOnly, incomingSettings) => {

  // Add the cache only values to the persisted settings
  const propsWithCacheOnlyItems = mergeCacheable({}, incomingSettings, existingSettingsWithCacheOnly);

  // Cache by both key and id, normally we read the cache using the key
  // If the user isn't authenticated, only cache by key, since we haven't gotten the settings from the database
  return R.map(
    idField => {
      return makeCacheMutation(
        apolloConfig,
        {
          name: 'settings',
          idField,
          // output for the read fragment
          outputParams
        },
        propsWithCacheOnlyItems
      );
    },
    R.filter(p => R.propOr(null, p, propsWithCacheOnlyItems), ['id', 'key'])
  );
};

/**
 * Mutates the settings in the cache as a container
 * @param apolloConfig
 * @param outputParams
 * @param props
 * @param settings
 * @returns {*}
 */
export const makeSettingsCacheMutationContainer = (apolloConfig, {outputParams}, props, settings) => {

  // Add the cache only values to the persisted settings
  const propsWithCacheOnlyItems = mergeCacheable({}, settings, props);

  return composeWithComponentMaybeOrTaskChain([
    ({settingsResponse, render}) => {
      // Just here so compose has at least two functions
      return containerForApolloType(
        apolloConfig,
        {
          render: getRenderPropFunction(props),
          // Match a server response
          response: {result: {data: {mutate: {settings: settingsResponse}}}}
        }
      );
    },
    ...R.map(
      idField => {
        return mapTaskOrComponentToNamedResponseAndInputs(apolloConfig, 'settingsResponse',
          ({render}) => {
            return makeCacheMutationContainer(
              apolloConfig,
              {
                name: 'settings',
                idField,
                // output for the read fragment
                outputParams
              },
              R.mergeRight(propsWithCacheOnlyItems, {render})
            );
          }
        );
      },
      R.filter(p => R.propOr(null, p, propsWithCacheOnlyItems), ['id', 'key'])
    )
  ])(R.pick(['render'], props));
};

