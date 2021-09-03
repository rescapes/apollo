/**
 * Created by Andy Likuski on 2018.04.25
 * Copyright (c) 2018 Andy Likuski
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 */

import * as R from 'ramda';
import T from 'folktale/concurrency/task/index.js';
import * as AC from '@apollo/client';
import {
  composeWithChain,
  defaultNode,
  mapToNamedResponseAndInputs,
  reqStrPathThrowing
} from '@rescapes/ramda';
import {
  writeDefaultsAndQueryCurrentUserContainer
} from '../client/apolloClientAuthentication.js';
import {tokenAuthMutationContainer, tokenAuthOutputParams} from '../stores/tokenAuthStore.js';
import {makeCacheMutation} from '../helpers/mutationCacheHelpers.js';
import {getOrCreateApolloClientTask} from '../client/apolloClient.js';

const {of} = T;
const {ApolloClient} = defaultNode(AC);

/**
 * Login and return an authenticated client task
 * @param {Object} config
 * @param {Object} config.cacheOptions
 * @param {String} config.uri graphql uri
 * @param {Object} config.stateLinkResolvers: Resolvers for the stateLink, meaning local caching
 * @param {Object} config.writeDefaultsContainer: Writes defaults to the cache and optionally
 * updates the database settings or cache settings
 * @param {Object} props
 * @param {String} props.username The username
 * @param {String} props.password The password
 * @param {Object} config.settingsConfig
 * @param {Array|Object} config.settingsConfig.defaultSettingsOutputParams The settings outputParams
 * @param {[String]} config.settingsConfig.defaultSettingsCacheOnlyObjs See defaultSettingsStore for an example
 * @param {[String]} config.settingsConfig.defaultSettingsCacheIdProps See defaultSettingsStore for an example
 * @param {Object} [mockTokenAuth] Default null, if using mocks, pass a response in the form:
 *       "tokenAuth": {
        "token": "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJ1c2VybmFtZSI6InRlc3QiLCJleHAiOjE2MzA0ODUwMTIsIm9yaWdJYXQiOjE2MzA0ODQ3MTJ9.PA31kF2P1CeMedybVrYdNWKq7EhNDYka3r9SsSGWfxI",
        "payload": {
          "username": "test",
          "exp": 1630485012,
          "origIat": 1630484712
        },
        "__typename": "ObtainJSONWebToken"
      }
 * @return {{apolloClient: ApolloClient, token}}
 */
export const loginToAuthClientTask = R.curry((
  {
    cacheOptions,
    uri,
    stateLinkResolvers,
    writeDefaultsContainer,
    settingsConfig: {cacheOnlyObjs, cacheIdProps, settingsOutputParams},
    mockTokenAuth=null
  },
  props
) => {
  return composeWithChain([
    // loginResult.data contains {tokenAuth: token}
    // TODO can we modify noAuthApolloClientTask by writing the auth data to the cache instead??
    ({apolloConfig, currentUserResponse, tokenAuth}) => {
      return of(
        R.mergeAll([
          apolloConfig,
          {user: reqStrPathThrowing('data.currentUser', currentUserResponse)},
          R.pick(
            ['token', 'payload'],
            reqStrPathThrowing('result.data.tokenAuth', tokenAuth)
          )
        ])
      );
    },

    // Write defaults and settings
    mapToNamedResponseAndInputs('currentUserResponse',
      ({apolloConfig, uri, stateLinkResolvers}) => {
        // Since we have a token we can call this getOrCreateApolloClientAndDefaultsTask,
        // although the token will also be stored in localStorage.getItem('token'),
        // so we could likewise call getOrCreateNoAuthApolloClientWithTokenTask
        return writeDefaultsAndQueryCurrentUserContainer({
            apolloConfig,
            cacheData: reqStrPathThrowing('apolloClient.cache.data.data', apolloConfig),
            cacheOptions,
            uri,
            stateLinkResolvers,
            writeDefaultsContainer,
            settingsConfig: {
              cacheOnlyObjs, cacheIdProps, settingsOutputParams
            }
          },
          {}
        );
      }
    ),
    // Login in to the server to get the auth token
    mapToNamedResponseAndInputs('tokenAuth',
      ({apolloConfig, props}) => {
        // If mocking don't call the mutation, rather return the mock token auth response
        return mockTokenAuth ? of(mockTokenAuth) : tokenAuthMutationContainer(
          apolloConfig,
          {outputParams: tokenAuthOutputParams},
          props
        );
      }
    ),
    mapToNamedResponseAndInputs('apolloConfig',
      ({uri, stateLinkResolvers}) => {
        // Use unauthenticated ApolloClient for login
        return getOrCreateApolloClientTask({
          cacheOptions,
          uri,
          stateLinkResolvers,
          makeCacheMutation,
          fixedHeaders: {authorization: null}
        });
      }
    )
  ])({uri, stateLinkResolvers, props});
});

/**
 * Return an nauthenticated client task
 * @param {Object} config
 * @param {Object} config.cacheOptions
 * @param {String} config.uri graphql uri
 * @param {Object} config.stateLinkResolvers: Resolvers for the stateLink, meaning local caching
 * @param {Object} config.settingsConfig
 * @param {Array|Object} config.settingsConfig.defaultSettingsOutputParams The settings outputParams
 * @param {[String]} config.settingsConfig.defaultSettingsCacheOnlyObjs See defaultSettingsStore for an example
 * @param {[String]} config.settingsConfig.defaultSettingsCacheIdProps See defaultSettingsStore for an example
 * @return {{apolloClient: ApolloClient, token}}
 */


/**
 * Expects a GraphQLClient if already authenticated or login data if not
 * @param {Object} config
 * @param {Object} config.cacheOptions
 * @param {String} config.uri The URL to create client with if authentication is not already a GraphQLClient
 * @param {Object} config.stateLinkResolvers: Resolvers for the stateLink, meaning local caching
 * @param {Array} config.defaultSettingsOutputParams the settings output params
 * @param {Object} config.writeDefaultsContainer: Writes defaults to the cache and optionally
 * updates the database settings or cache settings
 * @param {Array|Object} config.settingsConfig.defaultSettingsOutputParams The settings outputParams
 * @param {[String]} config.settingsConfig.defaultSettingsCacheOnlyObjs See defaultSettingsStore for an example
 * @param {[String]} config.settingsConfig.defaultSettingsCacheIdProps See defaultSettingsStore for an example
 * @param {[String]} config.settingsConfig.defaultSettingsTypenames See defaultSettingsStore for an example
 * @param {GraphQLClient|Object} authentication. If a GraphQLClient, a client with authentication already
 * in the header, such as an auth token. If an object, then username and password
 * @returns {Task<Object>} {apolloClient: Authorized Apollo Client, token: The authentication token,
 * function to clear the link state}
 */
export const authClientOrLoginTask = R.curry((
  {
    cacheOptions,
    uri,
    stateLinkResolvers,
    writeDefaultsContainer,
    settingsConfig: {cacheOnlyObjs, cacheIdProps, settingsOutputParams, defaultSettingsTypenames}
  }, authentication) => {
  return R.ifElse(
    ({authentication}) => R.is(ApolloClient, authentication),
    // Just wrap it in a task to match the other option
    apolloClient => of({apolloClient}),
    composeWithChain([
      // Write defaults and settings
      mapToNamedResponseAndInputs('currentUserResponse',
        ({apolloConfig, uri, stateLinkResolvers}) => {
          // Since we have a token we can call this getOrCreateApolloClientAndDefaultsTask,
          // although the token will also be stored in localStorage.getItem('token'),
          // so we could likewise call getOrCreateNoAuthApolloClientWithTokenTask
          return writeDefaultsAndQueryCurrentUserContainer({
              apolloConfig,
              cacheData: reqStrPathThrowing('apolloClient.cache.data.data', apolloConfig),
              cacheOptions,
              uri,
              stateLinkResolvers,
              writeDefaultsContainer,
              settingsConfig: {
                cacheOnlyObjs, cacheIdProps, settingsOutputParams, defaultSettingsTypenames
              }
            },
            {}
          );
        }
      ),
      // Log in with the authentication props
      mapToNamedResponseAndInputs('loginAuthentication',
        ({apolloConfig, authentication}) => {
          return tokenAuthMutationContainer(apolloConfig, {}, authentication);
        }
      ),
      // Get the apolloConfig, authenticated or not
      mapToNamedResponseAndInputs('apolloConfig',
        ({uri, stateLinkResolvers}) => {
          return getOrCreateApolloClientTask({
            cacheOptions, uri, stateLinkResolvers, makeCacheMutation
          });
        }
      )
    ])
  )({uri, stateLinkResolvers, authentication: authentication});
});
