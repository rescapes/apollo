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

import AC from '@apollo/client';
const {MissingFieldError} = AC
import T from 'folktale/concurrency/task'
const {of} = T;
import R from 'ramda';
import {v} from 'rescape-validate';
import PropTypes from 'prop-types';
import {makeQueryContainer} from '../helpers/queryHelpers';
import {makeQueryFromCacheContainer} from '../helpers/queryCacheHelpers';
import {versionOutputParamsMixin} from '../helpers/requestHelpers';
import {strPathOr} from 'rescape-ramda';
import {containerForApolloType} from '../helpers/containerHelpers';
import {getRenderPropFunction} from '../helpers/componentHelpersMonadic';
import {makeCacheMutation, mergeCacheable} from '../helpers/mutationCacheHelpers';

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
 * Reads the cache to check if the client is authenticated
 * It's technically possible to used an unauthed apolloClient to read from the cache
 * when the user is present, but hopefully this won't happen. It would be better
 * to check the apolloClient for th AuthLink header auth token, but I don't know how
 * to access the authLink since it's composed with other links. We could also but
 * an auth flag on the apolloClient object somewhere
 * @param {Object} apolloConfig
 * @param {Object} apolloConfig.apolloClient The Apollo client
 * @returns {Boolean} true if authenticated or false
 */
export const isAuthenticatedLocal = apolloConfig => {
  // Unfortunately a cache miss throws
  try {
    return !!strPathOr(
      false,
      'data.currentUser',
      makeQueryFromCacheContainer(
        apolloConfig,
        {name: 'currentUser', readInputTypeMapper: userReadInputTypeMapper, outputParams: userOutputParams},
        {}
      )
    );
  } catch (e) {
    if (R.is(MissingFieldError)) {
      return false;
    }
    throw e
  }
};

/**
 * Like isAuthenticatedLocal, but matches the style of asynchronous requests,
 * returning a task or apollo component
 *
 * @param {Object} apolloConfig
 * @param apolloConfig.apolloClient. If non-null then a task is returned. If null
 * an apollo component is returned
 * @param {Object} props
 * @returns {Task|Object} The authenticated user as a task or apollo component
 */
export const authenticatedUserLocalContainer = (apolloConfig, props) => {
  // Unfortunately a cache miss throws
  try {
    return R.compose(
      // Wrap in a task when we are doing apolloClient queries, otherwise we already have
      // a proper apollo container
      containerOrValue => R.when(
        () => R.propOr(false, 'apolloClient', apolloConfig),
        of
      )(containerOrValue),
      props => makeQueryFromCacheContainer(
        R.merge(apolloConfig,
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
      )
    )(props);
  } catch (e) {
    if (R.is(MissingFieldError, e)) {
      return containerForApolloType(
        apolloConfig,
        {
          render: getRenderPropFunction(props),
          response: null
        }
      );
    }
    throw e
  }
};

/**
 * Queries users
 * @params {Object} apolloClient The Apollo Client
 * @params {Object} ouptputParams OutputParams for the query such as userOutputParams
 * @params {Object} props Unused but here to match the Apollo Component pattern. Use null or {}.
 * @returns {Task<Result>} A Task containing the Result.Ok with a User in an object with Result.Ok({data: currentUser: {}})
 * or errors in Result.Error({errors: [...]})
 */
export const currentUserQueryContainer = v(R.curry((apolloConfig, outputParams, props) => {
    return makeQueryContainer(
      R.merge(apolloConfig, {
        options: {
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

