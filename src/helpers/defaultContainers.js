/**
 * Created by Andy Likuski on 2021.03.26
 * Copyright (c) 2021 Andy Likuski
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 */

import {nameComponent} from './componentHelpersMonadic';
import {settingsQueryContainer} from './settingsStore';
import {omitClientFields} from './requestHelpers';
import * as R from 'ramda';

/**
 * Default settings query container
 * @param {Object} apolloConfig
 * @param {Object} outputParams Unlike other defaults, this query container needs outputParams
 * because implementing libraries will have unique settings
 * @param {Boolean} token Required auth token whose absence tells us to skip the query
 * @param props
 * @param {String} props.key The settings key. This or id must be used to query settings. Usually 'default'
 * @param {Number} props.id The settings id. This or id must be used to query settings
 * @returns {*}
 */
export const querySettingsContainerDefault = (apolloConfig, outputParams, {token, ...props}) => {
  return nameComponent('querySettingsContainerDefault',
    settingsQueryContainer(
      R.merge(apolloConfig, {
        options: {
          skip: !token,
          fetchPolicy: 'network-only',
          variables: props => {
            return R.pick(['id', 'key'], props);
          }
        }
      }),
      {outputParams: omitClientFields(outputParams)},
      props
    )
  );
};