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
  strPathOr
} from '@rescapes/ramda'
import * as R from 'ramda';
import {concatCacheMutation, makeCacheMutation} from './mutationCacheHelpers.js';
import {
  defaultSettingsCacheIdProps,
  defaultSettingsCacheOnlyObjs,
  defaultSettingsOutputParams, settingsTypeIdPathLookup
} from './defaultSettingsStore.js';
import T from 'folktale/concurrency/task/index.js'

const {of} = T;
import {createSampleSettingsTask} from './defaultSettingsStore.sample.js';
import {
  createCacheOnlyPropsForSettings,
  makeSettingsCacheMutationContainer,
  settingsQueryContainer
} from './settingsStore.js';
import {settingsLocalQueryContainerDefault} from './defaultContainers';
import {mapTaskOrComponentToNamedResponseAndInputs} from "./containerHelpers.js";
import {composeFuncAtPathIntoApolloConfig} from "./queryHelpers.js";
import {ap} from "ramda";

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
      mapToNamedPathAndInputs('settings', 'data.settings',
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
      (apolloConfig) => createSampleSettingsTask(apolloConfig),
      () => localTestAuthTask()
    ])().run().listen(defaultRunConfig({
      onResolved:
        ({settings, settingsFromQuery}) => {
          expectKeys(someSettingsKeys, R.head(settings));
          expectKeys(someSettingsKeys, R.head(settingsFromQuery));
        }
    }, errors, done));
  }, 100000);

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
  }, 1000000);

  test('concatCacheMutation', done => {
    const selectedBlocksOutputParams = {blocks: {id: true}, buster: true, michael: true}
    const errors = [];
    const typename = 'BlockSelectionType'
    const blockTypename = 'BlockType'
    // Normally the props structure would always be the same. This is for testing
    const props1 = {
      __typename: typename,
      blocks: [{__typename: blockTypename, id: 70}, {__typename: blockTypename, id: 71}],
      buster: 'hey brother'
    }
    const props2 = {
      spooky: {
        __typename: typename,
        blocks: [{__typename: blockTypename, id: 72}, {__typename: blockTypename, id: 73}, {__typename: blockTypename, id: 71}],
        michael: 'hey buster'
      }
    }
    const blockSelectionPathLookup = {
      // Identify routes as unique by key
      ['blocks']: ['id']
    };

    const blocksSelectionTypePolicy = {
      type: typename,
      keyFields: [],
      fields: ['blocks'],
      idPathLookup: blockSelectionPathLookup,
      cacheOnlyFieldLookup: {},
      // These are for the singleton initial null write
      name: 'selectedBlocks',
      outputParams: selectedBlocksOutputParams
    };

    composeWithChain([
      // Just update cache-only values like we would on the browser
      mapToNamedResponseAndInputs('concattedValues',
        ({apolloConfig}) => {
          return concatCacheMutation(
            composeFuncAtPathIntoApolloConfig(
              apolloConfig,
              'options.variables',
              props => R.prop('spooky', props)
            ),
            {
              name: 'selectedBlocks',
              outputParams: selectedBlocksOutputParams,
              readInputTypeMapper: {},
              idPathLookup: blockSelectionPathLookup,
              // The props represent a singleton because the items being concatted
              // deeper in the props and themselves have ids and themselves have ids and themselves have ids and themselves have ids and themselves have ids and themselves have ids and themselves have ids and themselves have ids and themselves have ids.
              singleton: true
            },
            props2
          )
        }
      ),
      // Just update cache-only values like we would on the browser
      mapToNamedResponseAndInputs('initialValues',
        ({apolloConfig}) => {
          return concatCacheMutation(
            apolloConfig,
            {
              name: 'selectedBlocks',
              outputParams: selectedBlocksOutputParams,
              readInputTypeMapper: {},
              idPathLookup: blockSelectionPathLookup,
              // The props represent a singleton because the items being concatted
              // deeper in the props and themselves have ids and themselves have ids and themselves have ids and themselves have ids and themselves have ids and themselves have ids and themselves have ids and themselves have ids and themselves have ids.
              singleton: true
            },
            props1
          )
        }
      ),
      mapToNamedResponseAndInputs('apolloConfig',
        () => localTestAuthTask({blockSelection: blocksSelectionTypePolicy})
      )
    ])({}).run().listen(defaultRunConfig({
      onResolved:
        ({initialValues, concattedValues}) => {
          expect(strPathOr(null, 'data.mapbox.mapboxAuthentication.mapboxApiAccessToken', settingsWithId)).toContain('happy');
          expect(strPathOr(null, 'data.mapbox.mapboxAuthentication.mapboxApiAccessToken', settingsWithKey)).toContain('happy');
        }
    }, errors, done));
  }, 100000)

});

