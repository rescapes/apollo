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
import {
  noAuthApolloClientTask,
  getOrCreateAuthApolloClientWithTokenTask,
  noAuthApolloClientMutationRequestTask
} from '../client/apolloClient';
import {of} from 'folktale/concurrency/task';
import {gql} from '@apollo/client';
import {ApolloClient} from '@apollo/client';
import {PropTypes} from 'prop-types';
import {v} from 'rescape-validate';
import {makeMutationRequestContainer} from '../helpers/mutationHelpers';
import {
  composeWithChain,
  composeWithChainMDeep,
  composeWithMapMDeep,
  mapToNamedPathAndInputs,
  mapToNamedResponseAndInputs
} from 'rescape-ramda';

const loginMutation = gql`mutation TokenAuth($username: String!, $password: String!) {
    tokenAuth(username: $username, password: $password) {
        token
    }
}`;

/**
 * loginMutationTask returning a User and token
 * @param {Object} noAuthClient, Client an Apollo Client that doesn't need authentication
 * @param {Object} values
 * @param {String} values.username The username
 * @param {String} values.password The password
 * @return {Task} Returns an object representing a user with a token. This token must
 * be passed to authenticated calls
 */
export const loginMutationTask = v(R.curry((apolloConfig, variables) => {
  return noAuthApolloClientMutationRequestTask(
    apolloConfig,
    {mutation: loginMutation, variables}
  );
}), [
  ['noAuthClient', PropTypes.shape().isRequired],
  ['variables', PropTypes.shape({
    username: PropTypes.string.isRequired,
    password: PropTypes.string.isRequired
  }).isRequired]
]);

/**
 * Login and return an authenticated client task
 * @param {Object} config
 * @param {Object} config.cacheOptions
 * @param {String} config.uri graphql uri
 * @param {Object} config.stateLinkResolvers: Resolvers for the stateLink, meaning local caching
 * @param {Object} props
 * @param {String} props.username The username
 * @param {String} props.password The password
 * @return {{apolloClient: ApolloClient, token}}
 */
export const loginToAuthClientTask = R.curry(({cacheOptions, uri, stateLinkResolvers, writeDefaults}, props) => {
  return composeWithChain([
    // loginResult.data contains {tokenAuth: token}
    // TODO can we modify noAuthApolloClientTask by writing the auth data to the cache instead??
    ({uri, stateLinkResolvers, loginData}) => {
      return getOrCreateAuthApolloClientWithTokenTask({
          cacheOptions,
          uri,
          stateLinkResolvers,
          writeDefaults
        }, loginData
      );
    },
    mapToNamedPathAndInputs('loginData', 'data',
      ({apolloConfig, variables}) => {
        return loginMutationTask(apolloConfig, variables);
      }
    ),
    mapToNamedResponseAndInputs('apolloConfig',
      ({uri, stateLinkResolvers}) => {
        // Use unauthenticated ApolloClient for login
        return noAuthApolloClientTask({cacheOptions, uri, stateLinkResolvers});
      }
    )
  ])({uri, stateLinkResolvers, variables: props});
});

/**
 * Verifies an apolloClient auth token.
 * @param {Object} apolloClient
 * @param {Object} props
 * @param {String} props.token The token to verify
 * @return {Function} Unary function expecting props and returning an Apollo Componnet or Task that resolves to the
 * token verification
 */
export const verifyTokenRequestContainer = R.curry((apolloConfig, props) => {
  return makeMutationRequestContainer(
    apolloConfig,
    {
      outputParams: ['payload'],
      variableNameOverride: 'token', variableTypeOverride: 'String', mutationNameOverride: 'verifyToken'
    },
    props
  );
});

/**
 * Refresh an apolloClient auth token.
 * @param {Object} apolloClient
 * @param {Object} variables
 * @param {String} variables.token The token to verify
 * @return {Object} Task that resolves to the username, expiration (exp), and origlat (?)
 *
 */
export const refreshTokenContainer = R.curry((apolloConfig, props) => {
  return makeMutationRequestContainer(
    apolloConfig,
    {
      outputParams: ['payload'],
      variableNameOverride: 'token', variableTypeOverride: 'String', mutationNameOverride: 'refreshToken'
    },
    props
  );
});

/**
 * Expects a GraphQLClient if already authenticated or login data if not
 * @param {Object} config
 * @param {Object} config.cacheOptions
 * @param {String} config.url The URL to create client with if authentication is not already a GraphQLClient
 * @param {Object} config.stateLinkResolvers: Resolvers for the stateLink, meaning local caching
 * @param {Function} config.writeDefaults. Function to write default values to the client
 * @param {GraphQLClient|Object} authentication. If a GraphQLClient, a client with authentication already
 * in the header, such as an auth token. If an object, then username and password
 * @returns {Task<Object>} {apolloClient: Authorized Apollo Client, token: The authentication token,
 * function to clear the link state}
 */
export const authClientOrLoginTask = R.curry(({cacheOptions, url, stateLinkResolvers, writeDefaults}, authentication) => {
  return R.ifElse(
    ({authentication}) => R.is(ApolloClient, authentication),
    // Just wrap it in a task to match the other option
    apolloClient => of({apolloClient}),
    composeWithChain([
      // map userLogin to getApolloClientTask and token
      ({url, stateLinkResolvers, loginAuthentication}) => {
        return getOrCreateAuthApolloClientWithTokenTask({
            cacheOptions,
            url,
            stateLinkResolvers,
            writeDefaults
          },
          R.prop('data', loginAuthentication)
        );
      },
      mapToNamedResponseAndInputs('loginAuthentication',
        ({apolloConfig, authentication}) => {
          return loginMutationTask(apolloConfig, authentication);
        }
      ),
      // map login values to token
      mapToNamedResponseAndInputs('apolloConfig',
        ({url, stateLinkResolvers}) => {
          return noAuthApolloClientTask({cacheOptions, url, stateLinkResolvers});
        }
      )
    ])
  )({url, stateLinkResolvers, authentication: authentication});
});
