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
import {localTestAuthTask, testConfig, testStateLinkResolversAndDefaults} from '../helpers/testHelpers';
import {makeMutationRequestContainer} from '../helpers/mutationHelpers';

import * as R from 'ramda';
import {regionOutputParams} from '../stores/scopeStores/regionStore';
import {makeQueryContainer} from '../helpers/queryHelpers';
import {readInputTypeMapper} from '../stores/scopeStores/regionStore';
import {makeQueryFromCacheContainer, makeQueryWithClientDirectiveContainer} from '../helpers/queryCacheHelpers';

/**
 * Requires a running graphql server at uri
 */
describe('apolloClient', () => {

  test('Confirm Apollo Client queries work', async () => {
    const {apolloClient} = await taskToPromise(localTestAuthTask);
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

    const props = {
      key: 'earth',
      name: 'Earth'
    };
    // Make sample region. This will update if the key: 'earth' already exists, since key is a unique prop on Region
    // and there is not automatic incrementor on region
    const response = await taskToPromise(R.composeK(
      // Force the result to come from the cache
      // TODO this isn't finding the region even though we cached it below
      mapToNamedPathAndInputs('region', 'data.regions.0',
        ({apolloClient, region}) => makeQueryWithClientDirectiveContainer(
          {apolloClient},
          {name: 'regions', readInputTypeMapper, outputParams: regionOutputParams},
          null
        )({key: region.key})
      ),
      // Query with direct cache call
      // TODO reference to above. This does work
      mapToNamedPathAndInputs('region', 'data.regions.0',
        ({apolloClient, region}) => makeQueryFromCacheContainer(
          {apolloClient},
          {name: 'regions', readInputTypeMapper, outputParams: regionOutputParams},
          null
        )({key: region.key})
      ),
      // Query so we can cache what we created
      mapToNamedPathAndInputs('region', 'data.regions.0',
        ({apolloClient, region}) => makeQueryContainer(
          {apolloClient},
          {name: 'regions', readInputTypeMapper, outputParams: regionOutputParams},
          null
        )({key: region.key})
      ),
      mapToNamedPathAndInputs('region', 'data.createRegion.region',
        ({props, apolloClient}) => makeMutationRequestContainer(
          {apolloClient},
          {
            name: 'region',
            outputParams: ['id', 'key', 'name', {geojson: [{features: ['type']}]}],
            crud: 'create'
          },
          null
        )(props)
      ),
      mapToNamedPathAndInputs('apolloClient', 'apolloClient',
        () => localTestAuthTask
      )
      )({props})
    );
    expect(reqStrPathThrowing('region', response)).toBeTruthy();
  }, 20000);

});
