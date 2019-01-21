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
import {reqStrPathThrowing, defaultRunConfig, taskToPromise, promiseToTask} from 'rescape-ramda';
import * as Result from 'folktale/result';
import {sampleStateLinkResolversAndDefaults, testAuthTask, testConfig} from '../helpers/testHelpers';
import {parseApiUrl} from 'rescape-helpers';
import {authClientOrLoginTask, loginToAuthClientTask} from '../auth/login';
import {
  authApolloClientMutationRequestTask, authApolloClientTask, getUnsubscribe,
  noAuthApolloClient
} from './apolloClient';
import {makeMutationTask} from '../helpers/mutationHelpers';

import * as R from 'ramda';
import {makeRegionsQueryTask, regionOutputParams} from '../stores/scopeStores/regionStore';
import {makeQueryTask, makeReadQueryTask} from '../helpers/queryHelpers';
import {readInputTypeMapper} from '../stores/scopeStores/regionStore';

const {settings: {api}} = testConfig;
const uri = parseApiUrl(api);

/**
 * Requires a running graphql server at uri
 */
describe('apolloClient', () => {


  test('Confirm queries work', async () => {
    const {apolloClient} = await taskToPromise(testAuthTask);
    const response = await apolloClient.query({
      query: gql`query regionsQuery {
          regions {
              key
              name
          }
      }`
    });
    expect(reqStrPathThrowing('data.regions', response)).toBeTruthy();
  });

  test('createApolloClient with sample data and test query caching', async () => {

    // Make sample region. This will update if the key: 'earth' already exists, since key is a unique prop on Region
    // and there is not automatic incrementor on region
    const response = await taskToPromise(R.composeK(
      // Query so we can cache what we created
      ({apolloClient, region}) => makeReadQueryTask(
        apolloClient,
        {name: 'regions', readInputTypeMapper},
        // If we have to query for regions separately use the limited output userStateOutputParamsCreator
        regionOutputParams,
        {key: region.key}
      ),
      // Query so we can cache what we created
      ({apolloClient, region}) => R.map(
        () => ({apolloClient, region}),
        makeQueryTask(
          apolloClient,
          {name: 'regions', readInputTypeMapper},
          // If we have to query for regions separately use the limited output userStateOutputParamsCreator
          regionOutputParams,
          {key: region.key}
        )
      ),
      ({apolloClient}) => R.map(
        response => ({apolloClient, region: reqStrPathThrowing('data.region', response)}),
        makeMutationTask(
          apolloClient,
          {name: 'region'},
          ['id', 'key', 'name', {geojson: [{features: ['type']}]}],
          {
            key: 'earth',
            name: 'Earth'
          }
        )
      ),
      () => testAuthTask
    )());

    expect(reqStrPathThrowing('regions.0', response)).toBeTruthy();
  });

  test('test linkState caching', async () => {

    const mutateNetworkStatus = gql`
        mutation updateNetworkStatus($isConnected: Boolean) {
            updateNetworkStatus(isConnected: $isConnected) @client
        }
    `;

    const queryRegions = gql`
        query($key: String) {
            networkStatus @client {
                isConnected
            }
            regions(key: $key) {
                id
                key
                name
            }
        }
    `;

    // Initially our networkStatus.isConnected is false because we defaulted it thus
    const {apolloClient} = await taskToPromise(testAuthTask);
    await taskToPromise(makeMutationTask(
      apolloClient,
      {name: 'region'},
      regionOutputParams,
      {
        key: 'earth',
        name: 'Earth'
      }
    ));
    const queryInitialResponse = await apolloClient.query({
        query: queryRegions,
        variables: {key: "earth"}
      }
    );
    expect(reqStrPathThrowing('data.networkStatus.isConnected', queryInitialResponse)).toEqual(false);
    expect(reqStrPathThrowing('data.regions.0.key', queryInitialResponse)).toEqual('earth');

    // Update the network status
    await apolloClient.mutate(
      {
        mutation: mutateNetworkStatus,
        variables: {isConnected: true}
      }
    );

    // Query the cache
    const queryResponse = await apolloClient.readQuery({
        query: queryRegions,
        variables: {key: "earth"}
      }
    );
    expect(reqStrPathThrowing('networkStatus.isConnected', queryResponse)).toEqual(true);
    expect(reqStrPathThrowing('regions.0.key', queryResponse)).toEqual('earth');

    // Make sure store can be reset
    // TODO this seems to be a bug. The defaults aren't being propery restored
    /*
    await apolloClient.restoreStore();

    // Query the cache
    const queryResponseAfterUnscubscribe = await apolloClient.readQuery({
        query: queryRegions,
        variables: {key: "earth"}
      }
    );
    expect(reqStrPathThrowing('networkStatus.isConnected', queryResponseAfterUnscubscribe)).toEqual(false);
    // But the cache remains
    expect(reqStrPathThrowing('regions.0.key', queryResponseAfterUnscubscribe)).toEqual('earth');
    */
  });
});
