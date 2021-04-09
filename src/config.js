/**
 * Created by Andy Likuski on 2019.10.02
 * Copyright (c) 2019 Andy Likuski
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 *
 */
import {tokenAuthTypePolicy} from './stores/tokenAuthStore';
import {settingsDataTypePolicy, settingsTypePolicy} from './helpers/defaultSettingsStore';
import * as R from 'ramda';


/**
 * Raw Type Policies. Implementors should merges theirs with these
 * @type {{settingsDataTypePolicy: {cacheOnlyFieldLookup: {mapbox: {mapboxAuthentication: boolean}}, type: string, fields: [string]}, settingsTypePolicy: {cacheOnlyFieldLookup: {data: {mapbox: boolean, testAuthorization: boolean}}, keyFields: [string], type: string, fields: [string], idPathLookup: {[p: string]: [string], 'data.routing.routes': string[]}}, tokenAuthTypePolicy: {keyFields: [], outputParams: {payload: number, token: number}, name: string, type: string}}}
 */
export const typePolicies = {
  settingsTypePolicy,
  settingsDataTypePolicy,
  tokenAuthTypePolicy
}

/**
 * Takes the values of the typePolicies.
 * @returns {[Object]} List of type policies
 */
export const typePoliciesConfig = mergedTypePolicies => {
  return R.values(mergedTypePolicies)
}

// For local testing only
export const typePoliciesConfigLocal = typePoliciesConfig(typePolicies);
