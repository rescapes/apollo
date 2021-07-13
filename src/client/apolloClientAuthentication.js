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

import {ApolloConsumer} from 'react-apollo';
import {e} from '@rescapes/helpers-component';
import {
  composeWithChain,
  defaultNode,
  mapToNamedResponseAndInputs,
  reqStrPathThrowing,
  memoizedTaskWith,
  strPathOr
} from '@rescapes/ramda';
import {getOrCreateApolloClientTask} from './apolloClient.js';
import {currentUserQueryContainer, userOutputParams} from '../stores/userStore.js';
import * as AC from '@apollo/client';
import * as R from 'ramda';
import T from 'folktale/concurrency/task/index.js';
import {loggers} from '@rescapes/log';
import {makeCacheMutation} from '../helpers/mutationCacheHelpers.js';
import {queryLocalTokenAuthContainer} from '../stores/tokenAuthStore.js';
import {composeWithComponentMaybeOrTaskChain, getRenderPropFunction} from '../helpers/componentHelpersMonadic.js';

const {ApolloClient} = defaultNode(AC);
const {of} = T;

const log = loggers.get('rescapeDefault');

/**
 * Writes defaults to the cache and then calls queryLocalTokenAuthContainer
 * to see if the user is logged in, then calls queryCurrentUserContainer if the user is authenticated
 * @param {Object} config
 * @param {Object} config.apolloConfig Created by
 getOrCreateApolloClientTask({ cacheData, cacheOptions, uri, stateLinkResolvers, makeCacheMutation } ); or similar
 * local storage to store are auth token
 * @param {Function} config.writeDefaultsContainer expecting apolloClient that writes defaults ot the cache
 * @param {Object} config.settingsConfig
 * @param {Array|Object} config.settingsConfig.settingsOutputParams The settings outputParams
 * @param {[String]} config.settingsConfig.cacheOnlyObjs See defaultSettingsStore for an example
 * @param {[String]} config.settingsConfig.cacheIdProps See defaultSettingsStore for an example
 * @param {Object} props
 * @param {Function} props.render The render function for component calls
 * @return {Object} Task or component currentUserQueryContainer response
 * Existing client cache data if restoring from some externally stored values
 */
export const writeDefaultsAndQueryCurrentUserContainer = (
  {
    apolloConfig,
    writeDefaultsContainer,
    settingsConfig
  },
  {render}
) => {
  const {cacheOnlyObjs, cacheIdProps, settingsOutputParams} = settingsConfig;

  return composeWithComponentMaybeOrTaskChain([
    tokenAuthResponse => {
      // Once we have the Apollo client, sync localStorage.getItem('token') with
      // what is in the Apollo Cache from previous session. We use localStorage as
      // a mirror of the cache value when the cache isn't in scope
      const token = strPathOr(null, 'data.token', tokenAuthResponse);
      if (token) {
        localStorage.setItem('token', token);
      } else {
        localStorage.removeItem('token');
      }
      // Fetch the user to get it into the cache if we are authenticated
      return currentUserQueryContainer(apolloConfig, userOutputParams, {token, render});
    },

    ({render}) => {
      return queryLocalTokenAuthContainer(apolloConfig, {render});
    },

    () => {
      const f = (apolloConfig, apolloClient) => {
        // Set writeDefaultsContainer to reset the cache. reset: true tells the function that this isn't the initial call
        apolloClient.onResetStore(() => writeDefaultsContainer(apolloClient, {
          cacheOnlyObjs,
          cacheIdProps,
          settingsOutputParams
        }).run());
        return writeDefaultsContainer(
          // Pass null for component queries
          R.propOr(null, 'apolloClient', apolloConfig),
          {cacheOnlyObjs, cacheIdProps, settingsOutputParams},
          {render}
        );
      }

      return R.ifElse(
        R.has('apolloClient'),
        ({apolloClient}) => {
          return f(apolloConfig, apolloClient);
        },
        () => {
          return e(
            ApolloConsumer,
            {},
            apolloClient => {
              return f(apolloConfig, apolloClient);
            }
          );
        }
      )(apolloConfig);
    }
  ])({ render });
};

/**
 * Given a userLogin with a tokenAuthMutation.token create the getApolloClientTask and return it and the token
 * This method is synchronous but returns a Task to be used in API chains
 * @param {Object} config
 * @param {Object} [config.cacheData] Existing cache data from a no auth apolloClient
 * @param {Object} config.cacheOptions
 * @param {String} config.uri Graphpl URL, e.g.  'http://localhost:8000/api/graphql';
 * @param {Object} config.stateLinkResolvers Resolvers for the stateLink, meaning local caching
 * @param {Function} config.writeDefaultsContainer Writes defaults to the cache and optionally
 * writes the settings to the database and/or cache
 * @param {Array|Object} config.outputParams Teh settings outputParams
 * @param {Object} token Return value from loginMutationTask() api call
 * @param {Array|Object} config.settingsConfig.defaultSettingsOutputParams The settings outputParams
 * @param {[String]} config.settingsConfig.defaultSettingsCacheOnlyObjs See defaultSettingsStore for an example
 * @param {[String]} config.settingsConfig.defaultSettingsCacheIdProps See defaultSettingsStore for an example
 * @return {Task<Object>} Task resolving to an object containing and object with a apolloClient
 */
export const getOrCreateApolloClientAndDefaultsTask = R.curry((
  {
    cacheData, cacheOptions, uri, stateLinkResolvers, writeDefaultsContainer,
    settingsConfig
  }
) => {
  const {cacheOnlyObjs, cacheIdProps, settingsOutputParams} = settingsConfig;
  return composeWithChain([
    ({apolloConfig, user}) => {
      return of(apolloConfig);
    },
    mapToNamedResponseAndInputs('user',
      ({apolloConfig}) => {
        return writeDefaultsAndQueryCurrentUserContainer({
          apolloConfig,
          cacheData,
          cacheOptions,
          uri,
          stateLinkResolvers,
          writeDefaultsContainer: writeDefaultsContainer,
          settingsConfig: {cacheOnlyObjs, cacheIdProps, settingsOutputParams}
        }, {});
      }
    ),
    mapToNamedResponseAndInputs('apolloConfig',
      () => {
        // Memoized call
        return getOrCreateApolloClientTask({
            // Existing apolloClient to add auth to
            // If we have an unauthorized client we want to authorize it so we can maintain its cache
            cacheData,
            cacheOptions,
            uri,
            stateLinkResolvers,
            makeCacheMutation
          }
        );
      })
  ])();
});


