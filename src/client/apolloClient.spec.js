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
import {reqStrPathThrowing, defaultRunConfig, taskToPromise} from 'rescape-ramda';
import * as Result from 'folktale/result';
import {sampleStateLinkResolversAndDefaults, testConfig, testLoginCredentials} from '../helpers/testHelpers';
import {parseApiUrl} from 'rescape-helpers';
import {loginToAuthClientTask} from '../auth/login';
import {authApolloClientMutationRequestTask, getUnsubscribe, noAuthApolloClient} from './apolloClient';

const {settings: {api}} = testConfig;
const uri = parseApiUrl(api);

/**
 * Requires a running graphql server at uri
 */
describe('apolloClient', () => {


  test('Confirm queries work', async () => {
    const {apolloClient, unsubscribe} = noAuthApolloClient(uri, sampleStateLinkResolversAndDefaults);
    const response = await apolloClient.query({
      query: gql`query goalsQuery {
	goals {
    key
    name
    number
    imageName
  }
}`
    });
    expect(reqStrPathThrowing('data.goals.0.name', response)).toEqual('walkability');
  });

  test('createApolloClient with sample data', async () => {

    // Login, this calls createApolloClient
    const {apolloClient, unsubscribe} = await taskToPromise(loginToAuthClientTask(uri, sampleStateLinkResolversAndDefaults, testLoginCredentials));

    const queryArticles = gql`
    query region($key: String!) {
          region(key: $key) {
              id
              key
              name
          }
    }`;

    // Make sure it can query
    // Pass our authApolloClient and token here
    const response = await apolloClient.query({
        query: queryArticles,
        variables: {key: "earth"}
      }
    );
    expect(reqStrPathThrowing('data.region.key', response)).toEqual('earth');
  });

  test('test query caching', async () => {
    // Login, this calls createApolloClient
    const {apolloClient, unsubscribe} = await taskToPromise(loginToAuthClientTask(uri, sampleStateLinkResolversAndDefaults, testLoginCredentials));

    const queryArticles = gql`
    query region($key: String!) {
          region(key: $key) {
              id
              key
              name
          }
    }`;

    const response = await apolloClient.query({
        query: queryArticles,
        variables: {key: "earth"}
      }
    );
    expect(reqStrPathThrowing('data.region.key', response)).toEqual('earth');

    // Make sure the data is now in the cache
    const localResponse = apolloClient.readQuery({
        query: queryArticles,
        variables: {key: "earth"}
      }
    );

    // Note that the result is not wrapped in data: {}
    expect(reqStrPathThrowing('region.key', localResponse)).toEqual('earth');
  });


  test('test linkState caching', async () => {

    const {apolloClient, unsubscribe} = await taskToPromise(
      loginToAuthClientTask(
        uri,
        sampleStateLinkResolversAndDefaults,
        testLoginCredentials
      )
    );

    const mutateNetworkStatus = gql`
  mutation updateNetworkStatus($isConnected: Boolean) {
    updateNetworkStatus(isConnected: $isConnected) @client
  }
`;

    const queryRegion = gql`
  query($key: String) {
    networkStatus @client {
      isConnected
    }
    region(key: $key) {
        id
        key
        name
    }
  }
`;

    // Initially our networkStatus.isConnected is false because we defaulted it thus
    const queryInitialResponse = await apolloClient.query({
        query: queryRegion,
        variables: {key: "earth"}
      }
    );
    expect(reqStrPathThrowing('data.networkStatus.isConnected', queryInitialResponse)).toEqual(false);
    expect(reqStrPathThrowing('data.region.key', queryInitialResponse)).toEqual('earth');

    // Update the network status
    const murateResponse = await apolloClient.mutate(
      {
        mutation: mutateNetworkStatus,
        variables: {isConnected: true}
      }
    );

    // Query it again
    const queryResponse = await apolloClient.query({
        query: queryRegion,
        variables: {key: "earth"}
      }
    );
    expect(reqStrPathThrowing('data.networkStatus.isConnected', queryResponse)).toEqual(true);
    expect(reqStrPathThrowing('data.region.key', queryResponse)).toEqual('earth');

    // Make sure unsubscribe clears the local state
    unsubscribe();
    expect(reqStrPathThrowing('data.networkStatus.isConnected', queryInitialResponse)).toEqual(false);
  });
});
