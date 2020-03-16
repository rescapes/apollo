/**
 * Created by Andy Likuski on 2018.12.24
 * Copyright (c) 2018 Andy Likuski
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 */

import {HttpLink} from '@apollo/client'
import fetch from 'node-fetch';
import {setContext} from '@apollo/link-context';
import {introspectSchema, makeRemoteExecutableSchema} from 'graphql-tools';
import {reqStrPathThrowing} from 'rescape-ramda';
import * as R from 'ramda';
import {fromPromised, of} from 'folktale/concurrency/task';
import {authClientOrLoginTask} from '../auth/login';
import {writeSettingsToCache} from '../helpers/defaultSettingsStore';

const http = uri => new HttpLink({
  uri,
  credentials: 'include',
  fetch
});

const createAuthenticatedLink = (uri, token) => setContext((request, previousContext) => ({
  headers: {
    authorization: `JWT ${token}`
  }
})).concat(http(uri));

// Use this if authorization is having trouble
// const link = new HttpLink({ uri: 'http://api.githunt.com/graphql', fetch });


/**
 * Gets resolves to a remote schema based on the config
 * @param {Object} config
 * @param {Object} config.settings
 * @param {Object} config.settings.api.uri The full uri to the api on a server. E.g. http://foo.bar:8008/graphql
 * @param {Object} config.settings.testAuthorization For testing. Normally the user would enter these
 * @param {String} config.settings.testAuthorization.username the username to log in with
 * @param {String} config.settings.testAuthorization.password the password
 * @returns {Task<Object>} Resolves with an object containing the schema, the authenticated ApolloLink, and
 *
 */
export const remoteSchemaTask = config => {
  return R.composeK(
    // Create a link that concats HTTP to Authentication
    // Our authenticated link hard-codes the token. I don't know how to use the context
    ({uri, apolloClient, token, writeDefaults}) => {
      const link = createAuthenticatedLink(uri, token);
      return R.map(
        schema => ({schema, link, apolloClient}),
        fromPromised(l => introspectSchema(l))(link)
      );
    },
    // Authenticate
    config => {
      const uri = reqStrPathThrowing('settings.api.uri', config);
      const writeDefaults = reqStrPathThrowing('writeDefaults', config)
      return R.map(
        ({apolloClient, token}) => ({uri, apolloClient, token}),
        authClientOrLoginTask(
          uri,
          // StateLinkResolvers are empty for now
          {},
          reqStrPathThrowing('settings.testAuthorization', config),
          writeDefaults
        )
      );
    }
  )(config);
};

/**
 * Generates a reolsed schema from the server
 * https://www.apollographql.com/docs/graphql-tools/remote-schemas.html
 * @param {Object} config Needs settings.api.uri and settings.apiAithorization = {username=..., password=...}
 * @param {Function} config.writeDefaults Function expecting apolloClient that writes defaults to the cache
 * @return {Task<{schema: GraphQLSchema, link: HttpLink}>}
 */
export const remoteLinkedSchemaTask = config => {
  return R.composeK(
    ({schema, link}) => of(makeRemoteExecutableSchema({
      schema,
      link
    })),
    config => remoteSchemaTask(config)
  )(config);
};