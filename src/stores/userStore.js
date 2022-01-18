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

import * as AC from '@apollo/client';
import T from 'folktale/concurrency/task/index.js';
import {makeQueryContainer} from '../helpers/queryHelpers.js';
import {makeQueryFromCacheContainer} from '../helpers/queryCacheHelpers.js';
import {versionOutputParamsMixin} from '../helpers/requestHelpers.js';
import {strPathOr, defaultNode} from '@rescapes/ramda';
import {containerForApolloType} from '../helpers/containerHelpers.js';
import * as R from 'ramda';
import {getRenderPropFunction} from '../helpers/componentHelpersMonadic.js';

const {MissingFieldError} = defaultNode(AC);
const {of} = T;
import {v} from '@rescapes/validate';
import PropTypes from 'prop-types';


export const userOutputParams = {
  id: 1,
  lastLogin: 1,
  username: 1,
  firstName: 1,
  lastName: 1,
  email: 1,
  isStaff: 1,
  isActive: 1,
  dateJoined: 1,
  ...versionOutputParamsMixin
};

// Every complex input type needs a type specified in graphql. Our type names are
// always in the form [GrapheneFieldType]of[GrapheneModeType]RelatedReadInputType
// Following this location.data is represented as follows:
// TODO These value should be dervived from the schema
export const userReadInputTypeMapper = {
  'data': 'DataTypeofUserTypeRelatedReadInputType'
};


/**
 * Container to get local auth
 *
 * @param {Object} apolloConfig
 * @param apolloConfig.apolloClient. If non-null then a task is returned. If null
 * an apollo component is returned
 * @param {Object} props
 * @returns {Task|Object} The authenticated user as a task or apollo component
 */
export const authenticatedUserLocalContainer = (apolloConfig, props) => {
  return makeQueryFromCacheContainer(
    R.mergeRight(apolloConfig,
      {
        options: {
          variables: () => {
            return {};
          },
          // Pass through error so we can handle it in the component
          errorPolicy: 'all',
          partialRefetch: true
        }
      }
    ),
    {name: 'currentUser', readInputTypeMapper: userReadInputTypeMapper, outputParams: userOutputParams},
    props
  );
};

/**
 * Queries users
 * @params {Object} apolloClient The Apollo Client
 * @params {Object} ouptputParams OutputParams for the query such as userOutputParams
 * @params {Object} props
 * @params {Object} props.token or localStorage.getItem('token') Unless present skip the query
 * @returns {Task|Object} Task or Component query
 */
export const currentUserQueryContainer = v(R.curry((apolloConfig, outputParams, props) => {
    return makeQueryContainer(
      R.mergeRight(apolloConfig, {
        options: {
          // Skip if the user isn't authenticated. If we allow unauthenticated requests, it seems to cache
          // the response and not query again
          skip: !R.propOr(localStorage.getItem('token'), 'token', props),
          variables: props => {
            // No arguments, the server resolves the current user based on authentication
            return {};
          },
          errorPolicy: 'all',
          partialRefetch: true
        }
      }),
      {
        // If we have to query for users separately use the limited output userStateOutputParamsCreator
        name: 'currentUser', readInputTypeMapper: userReadInputTypeMapper, outputParams
      },
      props
    );
  }),
  [
    ['apolloConfig', PropTypes.shape().isRequired],
    ['outputParams', PropTypes.shape().isRequired],
    ['props', PropTypes.shape()]
  ], 'currentUserQueryContainer');

