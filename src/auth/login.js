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
import {noAuthApolloClientTask} from '../client/apolloClient.js';
import T from 'folktale/concurrency/task/index.js';
import * as AC from '@apollo/client';
import { composeWithChain, mapToNamedPathAndInputs, mapToNamedResponseAndInputs, reqStrPathThrowing, defaultNode } from '@rescapes/ramda'
import {
  getOrCreateAuthApolloClientWithTokenTask,
  getOrCreateNoAuthApolloClientTask
} from '../client/apolloClientAuthentication.js';
import {tokenAuthMutationContainer, tokenAuthOutputParams} from '../stores/tokenAuthStore.js';
import {currentUserQueryContainer, userOutputParams} from '../stores/userStore.js';
import {defaultSettingsTypenames} from '../helpers/defaultSettingsStore.js';

const {of} = T;
const {ApolloClient} = defaultNode(AC);

/**
 * Login and return an authenticated client task
 * @param {Object} config
 * @param {Object} config.cacheOptions
 * @param {String} config.uri graphql uri
 * @param {Object} config.stateLinkResolvers: Resolvers for the stateLink, meaning local caching
 * @param {Object} props
 * @param {String} props.username The username
 * @param {String} props.password The password
 * @param {Object} config.settingsConfig
 * @param {Array|Object} config.settingsConfig.defaultSettingsOutputParams The settings outputParams
 * @param {[String]} config.settingsConfig.defaultSettingsCacheOnlyObjs See defaultSettingsStore for an example
 * @param {[String]} config.settingsConfig.defaultSettingsCacheIdProps See defaultSettingsStore for an example
 * @return {{apolloClient: ApolloClient, token}}
 */
export const loginToAuthClientTask = R.curry(({cacheOptions, uri, stateLinkResolvers, writeDefaults, settingsConfig: {cacheOnlyObjs, cacheIdProps, settingsOutputParams}}, props) => {
  return composeWithChain([
    // loginResult.data contains {tokenAuth: token}
    // TODO can we modify noAuthApolloClientTask by writing the auth data to the cache instead??
    ({apolloConfig, user, loginData}) => {
      return of(
        R.mergeAll([
          apolloConfig,
          {user: reqStrPathThrowing('data.currentUser', user)},
          R.pick(
            ['token', 'payload'],
            reqStrPathThrowing('tokenAuth', loginData)
          )
        ])
      );
    },

    mapToNamedResponseAndInputs('user',
      ({apolloConfig}) => {
        return currentUserQueryContainer(apolloConfig, userOutputParams, {});
      }
    ),

    mapToNamedPathAndInputs('loginData', 'data',
      ({apolloConfig, props}) => {
        return tokenAuthMutationContainer(
          apolloConfig,
          {outputParams: tokenAuthOutputParams},
          props
        );
      }
    ),
    mapToNamedResponseAndInputs('apolloConfig',
      ({uri, stateLinkResolvers}) => {
        // Use unauthenticated ApolloClient for login
        return noAuthApolloClientTask({cacheOptions, uri, stateLinkResolvers});
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
export const noLoginToAuthClientTask = R.curry(({cacheOptions, uri, stateLinkResolvers, writeDefaults, settingsConfig: {cacheOnlyObjs, cacheIdProps, settingsOutputParams}}) => {
  return getOrCreateNoAuthApolloClientTask({
      cacheOptions,
      uri,
      stateLinkResolvers,
      writeDefaults,
      settingsConfig: {cacheOnlyObjs, cacheIdProps, settingsOutputParams}
    }
  );
});


/**
 * Expects a GraphQLClient if already authenticated or login data if not
 * @param {Object} config
 * @param {Object} config.cacheOptions
 * @param {String} config.uri The URL to create client with if authentication is not already a GraphQLClient
 * @param {Object} config.stateLinkResolvers: Resolvers for the stateLink, meaning local caching
 * @param {Array} config.defaultSettingsOutputParams the settings output params
 * @param {Function} config.writeDefaults. Function to write default values to the client
 * @param {Object} config.settingsConfig
 * @param {Array|Object} config.settingsConfig.defaultSettingsOutputParams The settings outputParams
 * @param {[String]} config.settingsConfig.defaultSettingsCacheOnlyObjs See defaultSettingsStore for an example
 * @param {[String]} config.settingsConfig.defaultSettingsCacheIdProps See defaultSettingsStore for an example
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
    writeDefaults,
    settingsConfig: {cacheOnlyObjs, cacheIdProps, settingsOutputParams}
  }, authentication) => {
  return R.ifElse(
    ({authentication}) => R.is(ApolloClient, authentication),
    // Just wrap it in a task to match the other option
    apolloClient => of({apolloClient}),
    composeWithChain([
      // map userLogin to getApolloClientTask and token
      ({apolloConfig, uri, stateLinkResolvers, loginAuthentication}) => {
        return getOrCreateAuthApolloClientWithTokenTask({
            cacheData: reqStrPathThrowing('apolloClient.cache.data.data', apolloConfig),
            cacheOptions,
            uri,
            stateLinkResolvers,
            writeDefaults,
            settingsConfig: {
              cacheOnlyObjs, cacheIdProps, settingsOutputParams, defaultSettingsTypenames
            }
          },
          R.prop('data', loginAuthentication)
        );
      },
      mapToNamedResponseAndInputs('loginAuthentication',
        ({apolloConfig, authentication}) => {
          return tokenAuthMutationContainer(apolloConfig, {}, authentication);
        }
      ),
      // map login values to token
      mapToNamedResponseAndInputs('apolloConfig',
        ({uri, stateLinkResolvers}) => {
          return noAuthApolloClientTask({cacheOptions, uri, stateLinkResolvers});
        }
      )
    ])
  )({uri, stateLinkResolvers, authentication: authentication});
});
