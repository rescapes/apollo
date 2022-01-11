/**
 * Created by Andy Likuski on 2018.04.23
 * Copyright (c) 2018 Andy Likuski
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 */

import {expectKeys, localTestAuthTask} from './testHelpers.js';
import {
  composeWithChain,
  defaultRunConfig,
  mapToNamedPathAndInputs,
  mapToNamedResponseAndInputs,
  strPathOr,
  taskToPromise
} from '@rescapes/ramda'
import * as R from 'ramda';
import {makeCacheMutationContainer} from './mutationCacheHelpers.js';
import {
  defaultSettingsCacheIdProps,
  defaultSettingsCacheOnlyObjs,
  defaultSettingsOutputParams
} from './defaultSettingsStore.js';
import T from 'folktale/concurrency/task/index.js'
import {createSampleSettingsTask} from './defaultSettingsStore.sample.js';
import {
  createCacheOnlyPropsForSettings,
  makeSettingsCacheMutationContainer,
  settingsQueryContainer
} from './settingsStore.js';
import {settingsLocalQueryContainerDefault} from './defaultContainers';
import {composeFuncAtPathIntoApolloConfig} from "./queryHelpers.js";
import {deleteTokenCookieMutationRequestContainer} from "../stores/tokenAuthStore.js";

const {of} = T;

// A blend of values from the server and the cache-only values
const someSettingsKeys = ['id', 'key', 'data.api', 'data.overpass', 'data.testAuthorization.username',
  'data.mapbox.viewport', 'data.mapbox.mapboxAuthentication'
];

describe('mutationCacheHelpers', () => {
  test('makeMutationWithClientDirectiveContainerCheckCaching', done => {
    expect.assertions(2);
    const errors = [];
    composeWithChain([
      // See if the all the settings are still in the cache
      mapToNamedPathAndInputs('settings', 'data.settings.0',
        ({settingsWithoutCacheValues, apolloConfig: {apolloClient}}) => {
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
      apolloConfig => createSampleSettingsTask(apolloConfig),
      () => localTestAuthTask()
    ])().run().listen(defaultRunConfig({
      onResolved:
        ({settings, settingsFromQuery}) => {
          expectKeys(someSettingsKeys, settings);
          expectKeys(someSettingsKeys, settingsFromQuery);
        }
    }, errors, done));
  }, 25000);

  test('makeMutationWithClientDirectiveContainerModifyCacheOnlyValues', done => {
    const errors = [];
    composeWithChain([
      // See if the all correct settings in the cache
      mapToNamedPathAndInputs('settingsWithKey', 'data',
        ({settingsWithoutCacheValues, apolloConfig: {apolloClient}}) => {
          return settingsLocalQueryContainerDefault(
            {
              apolloClient,
            },
            {outputParams: defaultSettingsOutputParams},
            R.pick(['key'], settingsWithoutCacheValues)
          );
        }
      ),
      // See if the all correct settings in the cache
      mapToNamedPathAndInputs('settingsWithId', 'data.settings.0',
        ({settingsWithoutCacheValues, apolloConfig: {apolloClient}}) => {
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
      // Just update cache-only values like we would on the browser
      mapToNamedResponseAndInputs('void',
        ({settingsFromCache, apolloConfig}) => {
          return makeSettingsCacheMutationContainer(
            apolloConfig,
            {
              // output for the read fragment
              outputParams: defaultSettingsOutputParams,
            },
            // Make a nonsense change to cache only data
            createCacheOnlyPropsForSettings(
              {
                cacheIdProps: defaultSettingsCacheIdProps,
                cacheOnlyObjs: defaultSettingsCacheOnlyObjs
              },
              R.compose(
                R.over(
                  R.lensPath(['data', 'mapbox', 'mapboxAuthentication', 'mapboxApiAccessToken']),
                  token => R.concat('happy', token)
                ),
                R.head
              )(settingsFromCache)
            )
          );
        }
      ),
      (apolloConfig) => createSampleSettingsTask(apolloConfig),
      () => localTestAuthTask()
    ])().run().listen(defaultRunConfig({
      onResolved:
        ({settingsWithId, settingsWithKey}) => {
          expect(strPathOr(null, 'data.mapbox.mapboxAuthentication.mapboxApiAccessToken', settingsWithId)).toContain('happy');
          expect(strPathOr(null, 'data.mapbox.mapboxAuthentication.mapboxApiAccessToken', settingsWithKey)).toContain('happy');
        }
    }, errors, done));
  }, 25000);

  test('makeCacheMutationContainerConcatArrays', async () => {
    expect.assertions(2);
    // TODO There is some crazy problem with chaining tasks that causes the cache to get values
    // earlier than it should. Use await+taskToPromise solves the problem.
    // I'm hoping this is something that only occurs with tasks and node, and not components
    const selectedBlocksOutputParams = {blocks: {id: true}, buster: true, michael: true}
    const typename = 'BlockSelectionType'
    const blockTypename = 'BlockType'

    const blockSelectionPathLookup = {
      // Identify routes as unique by key
      blocks: ['id']
    };

    const blocksSelectionTypePolicy = {
      type: typename,
      keyFields: [],
      fields: ['blocks'],
      idPathLookup: blockSelectionPathLookup,
      arrayMergeStrategyPropLookup: {
        blocks: 'concat'
      },
      cacheOnlyFieldLookup: {},
      // These are for the singleton initial null write
      name: 'selectedBlocks',
      outputParams: selectedBlocksOutputParams
    };

    // Normally the props structure would always be the same. This is for testing
    const props1 = {
      __typename: typename,
      blocks: [{__typename: blockTypename, id: 70}, {__typename: blockTypename, id: 71}],
      buster: 'hey brother'
    }
    const props2 = {
      spooky: {
        __typename: typename,
        blocks: [{__typename: blockTypename, id: 72}, {__typename: blockTypename, id: 73}, {
          __typename: blockTypename,
          id: 71
        }],
        michael: 'hey buster'
      }
    }
    // No interaction with the server is needed for this test since we're just caching
    const apolloConfig = await taskToPromise(localTestAuthTask({blockSelection: blocksSelectionTypePolicy}))
    const mutationOptions = {
        idField: 'id',
        name: 'selectedBlocks',
        outputParams: selectedBlocksOutputParams,
        readInputTypeMapper: {},
        idPathLookup: blockSelectionPathLookup,
        // The props represent a singleton because the items being concatted
        // deeper in the props and themselves have ids and themselves have ids and themselves have ids and themselves have ids and themselves have ids and themselves have ids and themselves have ids and themselves have ids and themselves have ids.
        singleton: true
      }

    // Write 2 blocks
    const concattedValuesResponseInitial = await taskToPromise(makeCacheMutationContainer(
      apolloConfig,
      mutationOptions,
      props1
    ))
    expect(R.length(concattedValuesResponseInitial.blocks)).toBe(2)

    // Write 3 blocks, 1 of which is a duplicate, resulting in 4 concatinated blocks
    const concattedValuesResponse = await taskToPromise(makeCacheMutationContainer(
      composeFuncAtPathIntoApolloConfig(
        apolloConfig,
        'options.variables',
        props => R.prop('spooky', props)
      ),
      mutationOptions,
      props2
    ))

    expect(R.length(concattedValuesResponse.blocks)).toBe(4)
  }, 5000)
});

