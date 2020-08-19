/**
 * Created by Andy Likuski on 2020.08.18
 * Copyright (c) 2020 Andy Likuski
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 */

import * as R from 'ramda';
import {v} from 'rescape-validate';
import PropTypes from 'prop-types';
import {makeQueryContainer} from '../helpers/queryHelpers';
import {makeQueryFromCacheContainer} from '../helpers/queryCacheHelpers';
import {versionOutputParamsMixin} from '../helpers/requestHelpers';
import {reqStrPathThrowing, strPathOr} from 'rescape-ramda';
import {makeMutationRequestContainer} from '..';
import {normalizeSampleRegionPropsForMutating, regionOutputParams} from '../helpers/samples/sampleRegionStore';

export const tokenAuthOutputParams = {
  token: 1,
};

export const tokenAuthReadInputTypeMapper = {
};

/**
 * Queries tokenAuths
 * @params {Object} apolloClient The Apollo Client
 * @params {Object} outputParams OutputParams for the query such as tokenAuthOutputParams
 * @params {Object} props
 * @params {Object} props.login The login props
 * @params {Object} props.login.username Required username
 * @params {Object} props.login.password Required password
 * @returns {Object|Task} A mutation component or task. The mutation component gives the mutate
 * function to the child component. The task resolves to the mutation results
 */
export const makeTokenAuthMutationContainer = v(R.curry((apolloConfig, outputParams, props) => {
    return makeMutationRequestContainer(
      {
        options: {
          variables: (props) => {
            return R.pick(['username', 'password'], reqStrPathThrowing('login', props));
          },

          errorPolicy: 'all'
        }
      },
      {
        name: 'region',
        outputParams: regionOutputParams
      },
      normalizeSampleRegionPropsForMutating(props)
    )
  }),
  [
    ['apolloConfig', PropTypes.shape().isRequired],
    ['outputParams', PropTypes.shape().isRequired],
    ['props', PropTypes.shape()]
  ], 'makeCurrentUserQueryContainer');
