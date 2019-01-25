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
import {reqStrPathThrowing, taskToPromise, mapToNamedPathAndInputs} from 'rescape-ramda';
import {testAuthTask} from '../helpers/testHelpers';
import {getUnsubscribe} from './apolloClient';
import {makeMutationTask} from '../helpers/mutationHelpers';

import * as R from 'ramda';
import {regionOutputParams} from '../stores/scopeStores/regionStore';
import {makeQueryTask, makeReadQueryTask} from '../helpers/queryHelpers';
import {readInputTypeMapper} from '../stores/scopeStores/regionStore';

/**
 * Requires a running graphql server at uri
 */
describe('apolloClient', () => {

  test('Confirm Apollo Client queries work', async () => {
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

  test('Use ApolloClient with sample data and test query caching', async () => {

    // Make sample region. This will update if the key: 'earth' already exists, since key is a unique prop on Region
    // and there is not automatic incrementor on region
    const response = await taskToPromise(R.composeK(
      // Query so we can cache what we created
      mapToNamedPathAndInputs('region', 'data.regions.0',
        ({apolloClient, region}) => makeReadQueryTask(
          {apolloClient},
          {name: 'regions', readInputTypeMapper},
          // If we have to query for regions separately use the limited output userStateOutputParamsCreator
          regionOutputParams,
          {key: region.key}
        )
      ),
      // Query so we can cache what we created
      mapToNamedPathAndInputs('region', 'data.regions.0',
        ({apolloClient, region}) => makeQueryTask(
          {apolloClient},
          {name: 'regions', readInputTypeMapper},
          // If we have to query for regions separately use the limited output userStateOutputParamsCreator
          regionOutputParams,
          {key: region.key}
        )
      ),
      mapToNamedPathAndInputs('region', 'data.region',
        ({apolloClient}) => makeMutationTask(
          {apolloClient},
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
    expect(reqStrPathThrowing('region', response)).toBeTruthy();
  });

  test('test linkState inital state', async () => {

    const {apolloClient} = await taskToPromise(testAuthTask);
    const queryDefaults = gql`
        query {
            networkStatus @client {
                isConnected
            }
            settings @client {
                mapbox {
                    viewport
                }
            }
        }
    `;
    const queryDefaultsResponse = await apolloClient.query({
        query: queryDefaults
      }
    );

    expect(reqStrPathThrowing('data.networkStatus.isConnected', queryDefaultsResponse)).toEqual(false);
    expect(reqStrPathThrowing('data.settings.mapbox.viewport', queryDefaultsResponse)).toBeTruthy();
  });

  test('test linkState mutation', async () => {

    const {apolloClient} = await taskToPromise(testAuthTask);
    // Mutate the network status
    const mutateNetworkStatus = gql`
        mutation updateNetworkStatus($isConnected: Boolean) {
            updateNetworkStatus(isConnected: $isConnected) @client
        }
    `;

    const mutateAddTodo = gql`
        mutation addTodo($text: String) {
            addTodo(text: $text) @client
        }
    `;

    const mutateToggleTodo = gql`
        mutation toggleTodo($id: String) {
            toggleTodo(id: $id) @client
        }
    `;

    const queryRegions = gql`
        query($key: String) {
            networkStatus @client {
                isConnected
            }
            todos @client {
                id
                text
                completed
            }
            regions(key: $key) {
                id
                key
                name
            }
        }
    `;


    // Create a Region
    await taskToPromise(makeMutationTask(
      {apolloClient},
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

    // Add a todo
    await apolloClient.mutate(
      {
        mutation: mutateAddTodo,
        variables: {text: 'Help Me Rhonda'}
      }
    );
    await apolloClient.mutate(
      {
        mutation: mutateAddTodo,
        variables: {text: 'Sloop John B'}
      }
    );

    await apolloClient.mutate(
      {
        mutation: mutateToggleTodo,
        variables: {id: '1'}
      }
    );

    // Query the cache
    const queryResponse = await apolloClient.query({
        query: queryRegions,
        variables: {key: "earth"}
      }
    );

    expect(reqStrPathThrowing('data.networkStatus.isConnected', queryResponse)).toEqual(true);
    const todos = reqStrPathThrowing('data.todos', queryResponse);
    expect(R.length(todos)).toEqual(2);
    expect(R.find(todo => R.propEq('id', 2, todo), todos).text).toEqual('Sloop John B');
    expect(reqStrPathThrowing('data.regions.0.key', queryResponse)).toEqual('earth');

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
