/**
 * Created by Andy Likuski on 2019.02.01
 * Copyright (c) 2019 Andy Likuski
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 */

import {ApolloConsumer} from 'react-apollo';
import * as R from 'ramda';
import {print} from 'graphql';
import {loggers} from 'rescape-log';
import {e} from 'rescape-helpers-component';

const log = loggers.get('rescapeDefault');

/**
 * Reads values loaded from the server that we know are now in the cache
 * @param apolloClient The authenticated Apollo Client
 * @param {Object} options Query options for the Apollo Client See Apollo's Client.query docs
 * The main arguments for options are QueryOptions with query and variables. Example
 * query: gql`
 query regions($key: String!) {
          regions(key: $key) {
              id
              key
              name
          }
    }`,
 variables: {key: "earth"}
 * @returns {Object} The cache result
 */
export const authApolloClientQueryCacheContainer = R.curry((apolloClient, options, props) => {
  // readQuery isn't a promise, just a direct call I guess
  log.debug(`Query cache: ${print(options.query)} props: ${JSON.stringify(props)}`);
  return {data: apolloClient.readQuery({variables: props, ...options})};
});

/**
 * Direct read from the cache
 */
export const authApolloClientOrComponentQueryCacheContainer = R.curry((apolloConfig, query, props) => {
  return R.cond([
    // Apollo Client instance
    [R.has('apolloClient'),
      apolloConfig => authApolloClientQueryCacheContainer(
        R.prop('apolloClient', apolloConfig),
        query,
        props
      )
    ],
    // Apollo component instance
    [R.T,
      // Since we aren't using a Query component, use an ApolloConsumer to get access to the
      // apollo client from the react context
      apolloConfig => {
        return e(
          ApolloConsumer,
          {},
          apolloClient => {
            return authApolloClientQueryCacheContainer(
              R.merge(apolloConfig, {apolloClient}),
              query,
              props
            );
          }
        );
      }
    ]
  ])(apolloConfig);
});
