/**
 * Created by Andy Likuski on 2017.11.29
 * Copyright (c) 2017 Andy Likuski
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 */
import gql from 'graphql-tag';
import {reqStrPath, defaultRunConfig, taskToPromise} from 'rescape-ramda';
import * as Result from 'folktale/result';
import {sampleConfig, testLoginCredentials} from '../helpers/testHelpers'
import {parseApiUrl} from 'rescape-helpers';
import {loginToAuthClientTask} from '../auth/login';
import {stateLinkResolvers} from '../helpers/testHelpers';
const {settings: {api}} = sampleConfig;
const uri = parseApiUrl(api);

/**
 * Requires a running graphql server at uri
 */
describe('apolloClient', () => {

  test('createApolloClient with sample data', async () => {

    // Login, this calls createApolloClient
    const {authClient, token} = await taskToPromise(loginToAuthClientTask(uri, stateLinkResolvers, testLoginCredentials));
    // Make sure it can query
    // Pass our authApolloClient and token here
    const response = await authClient.query({
        query: gql`
    query region($regionId: String!) {
          region(id: $regionId) {
              id
              name
              mapbox {
                viewport {
                  latitude
                  longitude
                  zoom
                }
              }
          }
    }`,
        variables: {regionId: "belgium"}
      }
    );
    expect(reqStrPath('data.region.id', response)).toEqual(Result.Ok('belgium'));
  });
});
