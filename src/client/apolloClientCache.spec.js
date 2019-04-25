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
import {reqStrPathThrowing, taskToPromise, mapToNamedPathAndInputs, mapToNamedResponseAndInputs} from 'rescape-ramda';
import {localTestAuthTask} from '../helpers/testHelpers';
import {getUnsubscribe} from './apolloClient';
import {makeMutationRequestContainer} from '../helpers/mutationHelpers';

import * as R from 'ramda';
import {regionOutputParams} from '../stores/scopeStores/regionStore';
import {makeQueryCacheContainer} from '../helpers/queryHelpers';

/**
 * Requires a running graphql server at uri
 */
describe('apolloClient', () => {

  test('test linkState initial state', async () => {

    const {apolloClient} = await taskToPromise(localTestAuthTask);
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

    const {apolloClient} = await taskToPromise(localTestAuthTask);
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
    await taskToPromise(makeMutationRequestContainer(
      {apolloClient},
      {
        name: 'region',
        outputParams: regionOutputParams
      })(
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
})
;
