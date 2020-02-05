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
import {getCurrentConfig} from 'rescape-sample-data';
import * as R from 'ramda';
import {loginToAuthClientTask} from '../auth/login';
import {keyStringToLensPath, reqStrPathThrowing} from 'rescape-ramda';
import privateTestSettings from './privateTestSettings';
import PropTypes from 'prop-types';
import {v} from 'rescape-validate';
import {createStateLinkDefaults, defaultStateLinkResolvers} from '../client/stateLink';

/**
 * The config for test
 */
export const testConfig = getCurrentConfig({settings: privateTestSettings});

// Apollo Link State defaults are based on the config.
// TODO I've limited the keys here to keep out regions and users. If all tests are based on a server
// we should remove users and regions from our testConfig
const testStateLinkDefaults = createStateLinkDefaults(R.pick(['settings', 'browser'], testConfig));

export const testStateLinkResolversAndDefaults = {
  resolvers: defaultStateLinkResolvers, defaults: testStateLinkDefaults
};

/**
 * Task to return and authorized client for tests
 * Returns an object {apolloClient:An authorized client}
 */
export const localTestAuthTask = loginToAuthClientTask(
  reqStrPathThrowing('settings.api.uri', testConfig),
  testStateLinkResolversAndDefaults,
  reqStrPathThrowing('settings.testAuthorization', testConfig)
);

/**
 * Task to return and authorized client for tests
 * @param {Object} testConfig The configuration to set up the test
 * @param {Object} testConfig.settings.api.uri. Uril of the API
 * @param {Object} testConfig.settings.testAuthorization Special test section in the settings with
 * a username and password
 * Returns an object {apolloClient:An authorized client}
 *
 */
export const testAuthTask = testConfig => loginToAuthClientTask(
  reqStrPathThrowing('settings.api.uri', testConfig),
  testStateLinkResolversAndDefaults,
  reqStrPathThrowing('settings.testAuthorization', testConfig)
);

/**
 * Convenient way to check if an object has a few expected keys at the given path
 * @param {[String]} keyPaths keys or dot-separated key paths of the object to check
 * @param {String} strPath Dot separated path of keys into the object
 * @param {Object} obj The object to check
 * @return {*} Expects the object has the given keys. Throws if expect fails* @return {*}
 */
export const expectKeysAtStrPath = v(R.curry((keyPaths, strPath, obj) =>
  expectKeys(keyPaths, reqStrPathThrowing(strPath)(obj))
), [
  ['keys', PropTypes.arrayOf(PropTypes.string).isRequired],
  ['strPath', PropTypes.string.isRequired],
  ['obj', PropTypes.shape({}).isRequired]
]);

/**
 * Convenient way to check if an object has a few expected keys at the given path
 * @param {[String]} keyPaths keys or dot-separated key paths of the object to check
 * @param {Object} obj The object to check
 * @return {*} Expects the object has the given keys. Throws if expect fails* @return {*}
 */
export const expectKeys = v(R.curry((keyPaths, obj) => expect(
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
)), [
  ['keys', PropTypes.arrayOf(PropTypes.string).isRequired],
  ['obj', PropTypes.shape({}).isRequired]
]);

