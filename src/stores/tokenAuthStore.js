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
import {makeMutationRequestContainer} from '../helpers/mutationHelpers';
import {of} from 'folktale/concurrency/task';
import {containerForApolloType} from '../helpers/containerHelpers';
import {getRenderPropFunction} from '../helpers/componentHelpersMonadic';
import {reqStrPathThrowing} from 'rescape-ramda';
import {makeCacheMutation} from '../helpers/mutationCacheHelpers';
import {makeReadFragmentFromCacheContainer} from '../helpers/queryCacheHelpers';
import {makeQueryFromCacheContainer} from '..';

export const tokenAuthOutputParams = {
  token: 1,
  payload: 1
};

export const tokenAuthReadInputTypeMapper = {};

/**
 * Look for the auth token in the cache so we know if we can get an authenticated client
 * This doesn't work with a cache query so I'm currently using a fragement read
 * TokenAuth is a singleton in the cache so it doesn't need any props
 * @param {Object} apolloConfig
 * @param {Object} apolloConfig.apolloClient Needed for both component and client queries
 * @param {Object} props No props needed
 * @returns {*}
 */
export const queryLocalTokenAuthContainer = (apolloConfig, props) => {
  // Unfortunately a cache miss throws
  try {
    return R.compose(
      // Wrap in a task when we are doing apolloClient queries, otherwise we already have
      // a proper apollo container
      containerOrValue => R.when(
        () => R.propOr(false, 'apolloClient', apolloConfig),
        of
      )(containerOrValue),
      props => {
        return makeReadFragmentFromCacheContainer(
          apolloConfig,
          {name: 'tokenAuthMutation', readInputTypeMapper: tokenAuthReadInputTypeMapper, outputParams: tokenAuthOutputParams},
          // Pass all the props including the render function. Only __typenmae and id are needed by the fragment read
          R.merge(props,
            // Singleton so id is just the type
            {__typename: 'ObtainJSONWebToken', id: 'ObtainJSONWebToken'}
          ),
        )
      }
    )(props);
  } catch (e) {
    return containerForApolloType(
      apolloConfig,
      {
        render: getRenderPropFunction(props),
        response: null
      }
    );
  }
};

/**
 * Verifies an apolloClient auth token.
 * @param {Object} apolloClient
 * @param {Object} outputParams
 * @param {Object} props The props are optional. They are typically sent via the mutation
 * function in {variables: {username, password}}
 * @param {String} [props.username]
 * @param {String} [props.password]
 * @return {TasK|Object} Task or Apollo Component resolving to
 * {
  "data": {
    "tokenAuthMutation": {
      "token": the token
      "payload": {
        "username": the username
        "exp": Expiration time as 1598264561,
        "origIat": Original login time 1598264261
      },
    }
  }
}
 */
export const tokenAuthMutationContainer = R.curry((apolloConfig, {outputParams = tokenAuthOutputParams}, props) => {
  return makeMutationRequestContainer(
    R.merge(
      apolloConfig,
      {
        options: {
          update: (store, response) => {
            const tokenAuth = reqStrPathThrowing(
              'data.tokenAuth',
              response
            );

            // This is what the Apollo Client reads to be authenticated
            localStorage.setItem('token', reqStrPathThrowing('token', tokenAuth))

            // TODO Don't know if we need this in the cache
            // Mutate the cache with a singleton tokenAuth since we don't query for the tokenAuth
            makeCacheMutation(
              apolloConfig,
              {
                name: 'tokenAuth',
                // output for the read fragment
                outputParams,
                // Write without @client fields
                force: true,
                singleton: true
              },
              tokenAuth
            );
          }
        }
      }
    ),
    {
      // Use this instead of name so that 'create' is prepended
      mutationNameOverride: 'tokenAuth',
      outputParams: outputParams || tokenAuthOutputParams,
      // Use username and password as flat variables, not as an ObtainJSONWebToken input type
      flattenVariables: true
    },
    // Defaults are used to tell makeMutationRequestContainer about the expected variable types
    R.merge({username: '', password: ''}, props)
  );
});

/**
 * Deletes the token cookie of the current user
 * @param {Object} apolloClient
 * @param {Object} [outputParams] Defaults to {deleted: true}
 * @param {Object} props Should always be empty
 * @return {TasK|Object} Task or Apollo Component resolving to
 */
export const deleteTokenCookieMutationRequestContainer = R.curry((apolloConfig, {outputParams = null}, props) => {
  return makeMutationRequestContainer(
    apolloConfig,
    {
      outputParams: outputParams || {deleted: 1},
      flattenVariables: true,
      mutationNameOverride: 'deleteTokenCookie'
    },
    props
  );
});


/**
 * Deletes the token cookie for all users
 * @param {Object} apolloClient
 * @param {Object} [outputParams] Defaults to {deleted: true}
 * @param {Object} props Should always be empty
 * @return {TasK|Object} Task or Apollo Component resolving to
 */
export const deleteRefreshTokenCookieMutationRequestContainer = R.curry((apolloConfig, {outputParams = null}, props) => {
  return makeMutationRequestContainer(
    apolloConfig,
    {
      outputParams: outputParams || {deleted: 1},
      flattenVariables: true,
      mutationNameOverride: 'deleteRefreshTokenCookie'
    },
    props
  );
});

/**
 * Verifies an apolloClient auth token.
 * @param {Object} apolloClient
 * @param {Object} outputParams
 * @param {Object} props
 * @param {String} props.token The token to verify
 * @return {Function} Unary function expecting props and returning an Apollo Componnet or Task that resolves to the
 * token verification
 */
export const verifyTokenMutationRequestContainer = R.curry((apolloConfig, {outputParams = null}, props) => {
  return makeMutationRequestContainer(
    apolloConfig,
    {
      outputParams: outputParams || {payload: 1},
      flattenVariables: true,
      mutationNameOverride: 'verifyToken'
    },
    props
  );
});

/**
 * Refresh an apolloClient auth token.
 * @param {Object} apolloClient
 * @param {Object} outputParams
 * @param {Object} variables
 * @param {String} variables.token The token to verify
 * @return {Object} Task that resolves to the username, expiration (exp), and origlat (?)
 */
export const refreshTokenMutationRequestContainer = R.curry((apolloConfig, {outputParams = null}, props) => {
  return makeMutationRequestContainer(
    apolloConfig,
    {
      outputParams: outputParams || {payload: 1},
      flattenVariables: true,
      mutationNameOverride: 'refreshToken'
    },
    props
  );
});