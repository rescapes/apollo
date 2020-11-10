/**
 * Created by Andy Likuski on 2018.07.31
 * Copyright (c) 2018 Andy Likuski
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 */
import * as R from 'ramda';
import {keyStringToLensPath, reqStrPathThrowing} from 'rescape-ramda';
import settings from './privateSettings';
import PropTypes from 'prop-types';
import {v} from 'rescape-validate';
import {defaultStateLinkResolvers, mergeLocalTestValuesIntoConfig} from '../client/stateLink';
import {writeConfigToServerAndCache} from './settingsStore';
import {createAuthTask, createNoAuthTask, typePoliciesWithMergeObjects} from './clientHelpers';
import {typePoliciesConfig} from '../config';
import {
  defaultSettingsCacheIdProps,
  defaultSettingsCacheOnlyObjs,
  defaultSettingsOutputParams, defaultSettingsTypenames
} from './defaultSettingsStore';

/**
 * InMemoryCache Policies for tests. This makes sure that the given type fields merge existing with incoming
 * when updating the cache
 * @type {any}
 */
export const cacheOptions = {
  typePolicies: typePoliciesWithMergeObjects(
    typePoliciesConfig
  )
};

/**
 * The config for test. We add some cache only properties to
 */
export const localTestConfig = mergeLocalTestValuesIntoConfig({
  settings,
  settingsConfig: {
    settingsOutputParams: defaultSettingsOutputParams,
    cacheOnlyObjs: defaultSettingsCacheOnlyObjs,
    cacheIdProps: defaultSettingsCacheIdProps,
    // These are only used to store settings for a non-auth user. Not needed if
    // we allow no auth querying of the default settings
    defaultSettingsTypenames,
  },
  apollo: {
    writeDefaultsCreator: writeConfigToServerAndCache,
    stateLinkResolvers: defaultStateLinkResolvers,
    cacheOptions
  }
});

/**
 * Task to return and authorized client for tests
 * Returns an object {apolloClient:An authorized client}
 */
export const localTestAuthTask = () => createAuthTask(localTestConfig);

/**
 * Task to return and authorized client for tests
 * Returns an object {apolloClient:An unauthorized client}
 */
export const localTestNoAuthTask = () => {
  // Clear the localStorage. TODO this might need to be keyed for parallel tests
  localStorage.setItem('token', null);
  return createNoAuthTask(localTestConfig);
};

/**
 * Duplicate or rescape-helpers-test to avoid circular dependency
 * Convenient way to check if an object has a few expected keys at the given path
 * @param {[String]} keyPaths keys or dot-separated key paths of the object to check
 * @param {Object} obj The object to check
 * @return {*} Expects the object has the given keys. Throws if expect fails* @return {*}
 */
export const expectKeys = v(R.curry((keyPaths, obj) => {
  expect(
    R.compose(
      // Put the keyPaths that survive in a set for comparison
      a => new Set(a),
      // Filter out keyPaths that don't resolve to a non-nil value
      obj => R.filter(
        keyPath => R.complement(R.isNil)(
          R.view(R.lensPath(keyStringToLensPath(keyPath)), obj)
        ),
        keyPaths
      )
    )(obj)
  ).toEqual(
    new Set(keyPaths)
  );
  // Required for validated functions
  return true;
}), [
  ['keys', PropTypes.arrayOf(PropTypes.string).isRequired],
  ['obj', PropTypes.shape({}).isRequired]
]);

