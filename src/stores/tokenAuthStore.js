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

import {ApolloConsumer} from '@apollo/client';
import * as R from 'ramda';
import {makeMutationRequestContainer} from '../helpers/mutationHelpers.js';
import T from 'folktale/concurrency/task/index.js';
import {containerForApolloType} from '../helpers/containerHelpers.js';
import {composeWithComponentMaybeOrTaskChain, getRenderPropFunction} from '../helpers/componentHelpersMonadic.js';
import {reqStrPathThrowing, strPathOr} from '@rescapes/ramda';
import {makeCacheMutation} from '../helpers/mutationCacheHelpers.js';
import {makeReadFragmentFromCacheContainer} from '../helpers/queryCacheHelpers.js';
import {e} from '../helpers/componentHelpers.js';

const {of} = T;

export const tokenAuthOutputParams = {
  token: 1,
  payload: 1
};
export const deleteTokenCookieOutputParams = {
  deleted: 1
};

export const tokenAuthReadInputTypeMapper = {};

export const tokenAuthTypePolicy = {
  type: 'ObtainJSONWebToken',
  // Indicates Singleton. Only one exists in the cache. This also means that the value will be written to the cache
  // as null initially so that updates to the cache trigger observing queries to re-fire
  keyFields: [],
  // This is for the singleton initial null write
  name: 'tokenAuthStore',
  outputParams: {
    token: 1,
    payload: 1
  }
};

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
    return makeReadFragmentFromCacheContainer(
      apolloConfig,
      {
        name: 'tokenAuth',
        readInputTypeMapper: tokenAuthReadInputTypeMapper,
        outputParams: tokenAuthOutputParams
      },
      // Pass all the props including the render function. Only __typenmae and id are needed by the fragment read
      R.merge(props,
        // Singleton so id is just the type
        {__typename: 'ObtainJSONWebToken', id: 'ObtainJSONWebToken'}
      )
    )
  } catch (e) {
    return containerForApolloType(
      apolloConfig,
      {
        render: getRenderPropFunction(props),
        response: {data: null}
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
          variables: props => {
            return R.pick(['username', 'password'], props);
          },
          update: (store, {data, ...rest}) => {
            const _response = {result: {data}, ...rest};
            return R.compose(
              // Accept an update method from apolloConfig.options so that queries can be refetched
              ({store, response}) => {
                return strPathOr(R.identity, 'options.update', apolloConfig)(store, response);
              },
              ({store, response}) => {
                const tokenAuth = reqStrPathThrowing(
                  'result.data.tokenAuth',
                  response
                );

                // This is what the Apollo Client reads to be authenticated
                // This updates the Apollo Client to authorized which gives all components access to an authorized
                // Apollo Client in their context
                localStorage.setItem('token', reqStrPathThrowing('token', tokenAuth));
                // Use the store for writing if we don't have an apolloClient
                mutateTokenAuthCache(R.merge({store}, apolloConfig), {outputParams}, tokenAuth);

                return ({store, response});
              }
            )({store, response: _response});
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
 * Mutate the cache with a singleton tokenAuth since we don't query for the tokenAuth
 * This is what Apollo Container queries react to. Note that this singleton cache value is initializing
 * to null when the cache is created by searching the TypePolicies for singletons.
 * @param apolloConfig
 * @param outputParams
 * @param tokenAuth
 * @returns {any}
 */
export const mutateTokenAuthCache = (apolloConfig, {outputParams}, tokenAuth) => {
  return makeCacheMutation(
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
};

/**
 * Deletes the token cookie of the current user
 * @param {Object} apolloClient
 * @param {Object} [outputParams] Defaults to {deleted: true}
 * @param {Object} props Should always be empty
 * @return {TasK|Object} Task or Apollo Component resolving to
 */
export const deleteTokenCookieMutationRequestContainer = R.curry((apolloConfig, {outputParams = deleteTokenCookieOutputParams}, props) => {
  return composeWithComponentMaybeOrTaskChain([
    ({apolloClientFromConsumer, ...props}) => {
      return makeMutationRequestContainer(
        R.merge(
          apolloConfig,
          {
            options: {
              variables: props => {
                return {};
              },
              update: async (store, {data, ...rest}) => {
                const _response = {result: {data}, ...rest};
                // Clear the token so apolloClient is no longer authenticated
                // This will reset the apolloClient to unauthenticated and clear the cache
                localStorage.removeItem('token');
                await apolloClientFromConsumer.clearStore();
              }
            }
          }
        ),
        {
          outputParams: outputParams || {deleted: 1},
          flattenVariables: true,
          mutationNameOverride: 'deleteTokenCookie'
        },
        props
      );
    },
    ({render}) => {
      // If a component, supply the apolloClient from the ApolloConsumer so that update can call clearStore()
      return R.ifElse(
        R.has('apolloClient'),
        of,
        () => {
          return e(
            ApolloConsumer,
            {},
            apolloClientFromConsumer => {
              return render(R.merge({apolloClientFromConsumer}, props))
            }
          );
        }
      )(apolloConfig);
    }
  ])(props);
});


/**
 * Deletes the token cookie for all users
 * @param {Object} apolloClient
 * @param {Object} [outputParams] Defaults to {deleted: true}
 * @param {Object} props Should always be empty
 * @return {TasK|Object} Task or Apollo Component resolving to
 */
export const deleteRefreshTokenCookieMutationRequestContainer = R.curry((apolloConfig, {outputParams = deleteTokenCookieOutputParams}, props) => {
  // TODO the server is currently complaining graphql.error.located_error.GraphQLLocatedError: Error decoding signature
  // I don't currently use this API method anyway
  return makeMutationRequestContainer(
    R.merge(
      apolloConfig,
      {
        options: {
          variables: props => {
            return {};
          },
          update: (store, {data, ...rest}) => {
            const _response = {result: {data}, ...rest};
            // Clear the token so apolloClient is no longer authenticated
            // This will reset the apolloClient to unauthenticated and clear the cache
            localStorage.removeItem('token');
          }
        }
      }
    ),
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
