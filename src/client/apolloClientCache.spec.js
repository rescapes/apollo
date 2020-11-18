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
import AC from '@apollo/client';
const {gql} = AC
import {reqStrPathThrowing, taskToPromise, mapToNamedPathAndInputs, mapToNamedResponseAndInputs} from '@rescapes/ramda'
import {localTestAuthTask} from '../helpers/testHelpers.js';
import {makeMutationRequestContainer} from '../helpers/mutationHelpers.js';

import R from 'ramda';
import {regionOutputParams} from '../helpers/samples/sampleRegionStore.js';

const initializeCache = async apolloClient => {
  const queryCache = gql`
      query {
          networkStatus @client {
              isConnected
          }
          todos @client {
              id
              text
              completed
          }
      }
  `;
  const getTodos = gql`query GetTodos {
      todos {
          id
          text
          completed
      }
  }`;

  // Mutate the network status
  const mutateNetworkStatus = gql`
      mutation updateNetworkStatus($isConnected: Boolean) {
          updateNetworkStatus(isConnected: $isConnected) @client
      }
  `;

  // Update the network status
  await apolloClient.mutate(
    {
      mutation: mutateNetworkStatus,
      variables: {isConnected: true}
    }
  );
  // Initialize todos
  apolloClient.writeQuery({query: getTodos, data: {todos: []}});
}
/**
 * Requires a running graphql server at url
 */
describe('apolloClient', () => {

  test('test linkState mutation', async done => {
    expect.assertions(6);
    const {apolloClient} = await taskToPromise(localTestAuthTask());

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

    await initializeCache(apolloClient);
    // Add a todo to test our custom muatation resolver
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

    const {uncachedResponse, cachedResponse, region} = await cycleRegion(apolloClient);
    expect(reqStrPathThrowing('data.networkStatus.isConnected', uncachedResponse)).toEqual(true);
    const todos = reqStrPathThrowing('data.todos', uncachedResponse);
    expect(R.length(todos)).toEqual(2);
    expect(R.find(todo => R.propEq('id', 2, todo), todos).text).toEqual('Sloop John B');
    // We find the region from the server
    expect(reqStrPathThrowing('data.regions.0.key', uncachedResponse)).toEqual(region.key);
    // Then we find the region from the cache
    expect(reqStrPathThrowing('data.regions.0.key', cachedResponse)).toEqual(region.key);


    // Create another region and make sure it's in the cache
    const {cachedResponse: newCachedResponse, region: newRegion} = await cycleRegion(apolloClient);
    expect(reqStrPathThrowing('data.regions.0.key', newCachedResponse)).toEqual(newRegion.key);

    // Make sure store can be reset
    // TODO this seems to be a bug. The defaults aren't being properly restored
    // apolloClient.resetStore()

    /*
    // Mix cache calls with remote call
    const queryEmptyCache = gql`
        query {
            networkStatus @client {
                isConnected
            }
            todos @client {
                id
                text
                completed
            }

        }
    `;

    // Query the cache
    const queryResponseAfterUnscubscribe = await apolloClient.query({
        query: queryEmptyCache
      }
    );
    expect(reqStrPathThrowing('data.networkStatus.isConnected', queryResponseAfterUnscubscribe)).toEqual(false);
   */
    done();
  }, 100000);
});

const cycleRegion = async apolloClient => {

  // Create a region
  const {data: {createRegion: {region: region}}} = await taskToPromise(makeMutationRequestContainer(
    {apolloClient},
    {
      name: 'region',
      outputParams: regionOutputParams
    },
    {
      key: 'earth',
      name: 'Earth',
      data: {
        mapbox: {
          viewport: {
            zoom: 5
          }
        }
      }
    }
  ));

  // Mix cache calls with remote call
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
          regions (key: $key) {
              id
              key
              name
              data {
                  mapbox {
                      viewport {
                          zoom
                          special @client
                      }
                  }
              }
          }
      }
  `;
  // Query for the region and cached stuff
  // This will get the region into the cache
  const uncachedResponse = await apolloClient.query({
      query: queryRegions,
      variables: {key: region.key}
    }
  );

  // Asd for the region from the cache
  const queryCachedRegion = gql`
      query($key: String) {
          regions (key: $key) @client {
              id
              key
              name
          }
      }
  `;
  const cachedResponse = await apolloClient.query({
      query: queryCachedRegion,
      variables: {key: region.key}
    }
  );
  return {uncachedResponse, cachedResponse, region};
};
