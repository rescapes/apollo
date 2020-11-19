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
import {mapToNamedPathAndInputs, reqStrPathThrowing, taskToPromise} from '@rescapes/ramda'
import {localTestAuthTask} from '../helpers/testHelpers.js';
import {makeMutationRequestContainer} from '../helpers/mutationHelpers.js';
import T from 'folktale/concurrency/task/index.js'
const {of} = T;

import R from 'ramda';
import {readInputTypeMapper, regionOutputParams} from '../helpers/samples/sampleRegionStore.js';
import {makeQueryContainer} from '../helpers/queryHelpers.js';
import {makeQueryFromCacheContainer, makeQueryWithClientDirectiveContainer} from '../helpers/queryCacheHelpers.js';

/**
 * Requires a running graphql server at uri
 */
describe('apolloClient', () => {

  test('Confirm Apollo Client queries work', async () => {
    const {apolloClient} = await taskToPromise(localTestAuthTask());
    const response = await apolloClient.query({
      query: gql`query regionsQuery {
          regions {
              key
              name
          }
      }`
    });
    expect(reqStrPathThrowing('data.regions', response)).toBeTruthy();
  }, 100000);

  test('Use ApolloClient with sample data and test query caching', async () => {

    const props = {
      key: 'earth',
      name: 'Earth'
    };
    // Make sample region. This will update if the key: 'earth' already exists, since key is a unique prop on Region
    // and there is not automatic incrementor on region
    const response = await taskToPromise(R.composeK(
      // Allow the result to be found in the cache by using the @client directive
      mapToNamedPathAndInputs('region', 'data.regions.0',
        ({apolloClient, region}) => makeQueryWithClientDirectiveContainer(
          {apolloClient},
          {name: 'regions', readInputTypeMapper, outputParams: regionOutputParams},
          {key: region.key}
        )
      ),
      // Query with direct cache call. This works because the query with the same name was just made and it
      // will match that query by name
      mapToNamedPathAndInputs('region', 'data.regions.0',
        ({apolloClient, region}) => of(makeQueryFromCacheContainer(
          {apolloClient},
          {name: 'regions', readInputTypeMapper, outputParams: regionOutputParams},
          {key: region.key}
        ))
      ),
      // Query so we can cache what we created
      mapToNamedPathAndInputs('region', 'data.regions.0',
        ({apolloClient, region}) => makeQueryContainer(
          {apolloClient},
          {name: 'regions', readInputTypeMapper, outputParams: regionOutputParams},
          {key: region.key}
        )
      ),
      mapToNamedPathAndInputs('region', 'data.createRegion.region',
        ({props, apolloClient}) => {
          return makeMutationRequestContainer(
            {apolloClient},
            {
              name: 'region',
              outputParams: {
                id: 1,
                key: 1,
                name: 1,
                geojson: {
                  features: {
                    type: 1
                  }
                }
              },
              crud: 'create'
            },
            props
          );
        }
      ),
      mapToNamedPathAndInputs('apolloClient', 'apolloClient',
        () => localTestAuthTask()
      )
      )({props})
    );
    expect(reqStrPathThrowing('region', response)).toBeTruthy();
  }, 20000);

});
