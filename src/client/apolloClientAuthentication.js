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
import {composeWithChain, mapToNamedResponseAndInputs, reqStrPathThrowing} from '@rescapes/ramda'
import {getOrCreateApolloClientTask} from './apolloClient';
import {currentUserQueryContainer, userOutputParams} from '../stores/userStore';
import AC from '@apollo/client';
const {ApolloClient} = AC
import R from 'ramda';
import T from 'folktale/concurrency/task'
const {of} = T;
import {loggers} from '@rescapes/log';

const log = loggers.get('rescapeDefault');

/**
 * Given a token returns a GraphQL client
 * @param {Object} config
 * @param {String} config.uri Graphpl URL, e.g.  'http://localhost:8000/api/graphql';
 * @param {Object} config.stateLinkResolvers: Resolvers for the stateLink, meaning local caching
 * local storage to store are auth token
 * @param {Function} config.writeDefaults expecting apolloClient that writes defaults ot the cache
 * @param {Object} config.settingsConfig
 * @param {Array|Object} config.settingsConfig.settingsOutputParams The settings outputParams
 * @param {[String]} config.settingsConfig.cacheOnlyObjs See defaultSettingsStore for an example
 * @param {[String]} config.settingsConfig.cacheIdProps See defaultSettingsStore for an example
 * @param {[String]} config.cacheData Existing client cache data if going from unauthorized to authorized
 * @param {String} authToken: If non-null, authenticates the client. Otherwise a non-auth Apollo Client
 * is created
 * @return {{apolloClient: ApolloClient}}
 */
export const getOrCreateApolloClientTaskAndSetDefaults = (
  {
    // Existing client cache data if going from unauthorized to authorized
    cacheData,
    cacheOptions,
    uri,
    stateLinkResolvers,
    writeDefaults,
    settingsConfig
  },
  authToken
) => {
  const {cacheOnlyObjs, cacheIdProps, settingsOutputParams} = settingsConfig;
  return composeWithChain([
    ({apolloConfig, cacheOnlyObjs, cacheIdProps, settingsOutputParams, writeDefaults}) => {
      const apolloClient = reqStrPathThrowing('apolloClient', apolloConfig);
      // Set writeDefaults to reset the cache. reset: true tells the function that this isn't the initial call
      apolloClient.onResetStore(() => writeDefaults(apolloClient, {cacheOnlyObjs, cacheIdProps, settingsOutputParams}));
      const taskIfNotTask = obj => {
        return R.unless(obj => 'run' in obj, of)(obj);
      };
      // Write the initial defaults as a task if not one already, return the apolloClient
      // The initial write sets reset: false in case we need to go to the server the first time to get the values
      // or the structure of the values
      return R.map(
        () => ({apolloClient}),
        taskIfNotTask(writeDefaults(apolloClient, {cacheOnlyObjs, cacheIdProps, settingsOutputParams}))
      );
    },
    mapToNamedResponseAndInputs('user',
      ({apolloConfig, authToken}) => {
        // Fetch the user to get it into the cache so we know we are authenticated
        return R.ifElse(
          R.identity,
          () => currentUserQueryContainer(apolloConfig, userOutputParams, {}),
          () => of(null)
        )(authToken);
      }
    ),
    mapToNamedResponseAndInputs('apolloConfig',
      ({cacheData, uri, stateLinkResolvers, authToken}) => {
        // Memoized call
        return getOrCreateApolloClientTask({
            // Existing apolloClient to add auth to
            // If we have an unauthorized client we want to authorize it so we can maintain its cache
            cacheData,
            cacheOptions,
            uri,
            stateLinkResolvers,
            fixedHeaders: {
              authorization: authToken ? `JWT ${authToken}` : ''
            }
          }
        );
      }
    )
  ])({
    cacheData,
    uri,
    stateLinkResolvers,
    authToken,
    writeDefaults,
    cacheOnlyObjs,
    cacheIdProps,
    settingsOutputParams
  });
};

/**
 * Given a userLogin with a tokenAuthMutation.token create the getApolloClientTask and return it and the token
 * This method is synchronous but returns a Task to be used in API chains
 * @param {Object} config
 * @param {Object} [config.cacheData] Existing cache data from a no auth apolloClient
 * @param {Object} config.cacheOptions
 * @param {String} config.uri Graphpl URL, e.g.  'http://localhost:8000/api/graphql';
 * @param {Object} config.stateLinkResolvers Resolvers for the stateLink, meaning local caching
 * @param {Function} config.writeDefaults
 * @param {Array|Object} config.outputParams Teh settings outputParams
 * @param {Object} token Return value from loginMutationTask() api call
 * @param {Array|Object} config.settingsConfig.defaultSettingsOutputParams The settings outputParams
 * @param {[String]} config.settingsConfig.defaultSettingsCacheOnlyObjs See defaultSettingsStore for an example
 * @param {[String]} config.settingsConfig.defaultSettingsCacheIdProps See defaultSettingsStore for an example
 * @return {Task<Object>} Task resolving to an object containing and object with a apolloClient, token.
 */
export const getOrCreateAuthApolloClientWithTokenTask = R.curry((
  {
    cacheData, cacheOptions, uri, stateLinkResolvers, writeDefaults,
    settingsConfig
  },
  token,
) => {
  const {cacheOnlyObjs, cacheIdProps, settingsOutputParams} = settingsConfig;
  return R.map(
    obj => {
      return R.merge(
        {token},
        obj
      );
    },
    getOrCreateApolloClientTaskAndSetDefaults({
      cacheData,
      cacheOptions,
      uri,
      stateLinkResolvers,
      writeDefaults,
      settingsConfig: {cacheOnlyObjs, cacheIdProps, settingsOutputParams}
    }, token)
  );
});


/**
 * Given a userLogin with a tokenAuth.token create the getApolloClientTask and return it and the token
 * This method is synchronous but returns a Task to be used in API chains
 * @param {Object} config
 * @param {Object} config.cacheOptions
 * @param {String} config.uri Graphpl URL, e.g.  'http://localhost:8000/api/graphql';
 * @param {Object} config.stateLinkResolvers Resolvers for the stateLink, meaning local caching
 * @param {Function} config.writeDefaults
 * @param {Array|Object} config.outputParams Teh settings outputParams
 * @param {Object} config.settingsConfig
 * @param {Array|Object} config.settingsConfig.defaultSettingsOutputParams The settings outputParams
 * @param {[String]} config.settingsConfig.defaultSettingsCacheOnlyObjs See defaultSettingsStore for an example
 * @param {[String]} config.settingsConfig.defaultSettingsCacheIdProps See defaultSettingsStore for an example
 * @return {Task<Object>} Task resolving to an object containing and object with a no auth apolloClient and null token.
 */
export const getOrCreateNoAuthApolloClientTask = R.curry((
  {
    cacheOptions, uri, stateLinkResolvers, writeDefaults,
    settingsConfig
  }
) => {
  const {cacheOnlyObjs, cacheIdProps, settingsOutputParams} = settingsConfig;
  return R.map(
    obj => {
      // Matches resolved value of getOrCreateAuthApolloClientWithTokenTask
      return R.merge(
        {token: null},
        obj
      );
    },
    getOrCreateApolloClientTaskAndSetDefaults({
        cacheOptions,
        uri,
        stateLinkResolvers,
        writeDefaults,
        settingsConfig: {cacheOnlyObjs, cacheIdProps, settingsOutputParams}
      },
      // null authToken
      null
    )
  );
});
