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
import {inspect} from 'util';
import {print} from 'graphql';
import {loggers} from '@rescapes/log';
import {e} from '@rescapes/helpers-component';
import {containerForApolloType} from '../helpers/containerHelpers.js';
import {getRenderPropFunction} from '../helpers/componentHelpersMonadic.js';
import AC from '@apollo/client';
import {_winnowRequestProps} from '../helpers/requestHelpers.js';
import R from 'ramda';
import {apolloClientReadFragmentCacheContainer} from './apolloClient.js';
import {reqStrPathThrowing} from '@rescapes/ramda';


const {MissingFieldError} = AC;

const log = loggers.get('rescapeDefault');

/**
 * Reads values loaded from the server that we know are now in the cache
 * @param {Object} apolloConfig
 * @param {Object} apolloConfig.apolloClient The authenticated Apollo Client
 * @param {Object} apolloConfig.options
 * @param {Function} apolloConfig.options.variables Optional filter of the props
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
export const authApolloClientQueryCacheContainer = R.curry((apolloConfig, options, props) => {
  const winnowedProps = _winnowRequestProps(apolloConfig, props);
  // readQuery isn't a promise, just a direct call I guess
  log.debug(`Query cache: ${print(options.query)} props: ${inspect(winnowedProps)}`);
  try {
    return {
      data: reqStrPathThrowing('apolloClient', apolloConfig).readQuery({variables: winnowedProps, ...options})
    };
  } catch (e) {
    if (!R.is(MissingFieldError, e)) {
      throw e;
    }
    return {data: null};
  }
});

/**
 * Direct read from the cache
 */
export const authApolloClientOrComponentQueryCacheContainer = R.curry((apolloConfig, query, props) => {
  return R.cond([
    // Apollo Client instance
    [R.has('apolloClient'),
      apolloConfig => {
        return authApolloClientQueryCacheContainer(
          apolloConfig,
          query,
          props
        );
      }
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
            return containerForApolloType(
              apolloClient,
              {
                render: getRenderPropFunction(props),
                response: authApolloClientQueryCacheContainer(
                  R.merge(apolloConfig, {apolloClient}),
                  query,
                  props
                )
              }
            );
          }
        );
      }
    ]
  ])(apolloConfig);
});

/**
 * Direct read fragment from the cache
 * @param {Object} apolloConfig
 * @param {Object} fragment The fragment query
 * @param {Object} props Not used in the fragment, but passed to the render prop for components
 * @param {Number|String} id The id for the fragment query
 */
export const authApolloClientOrComponentReadFragmentCacheContainer = R.curry((apolloConfig, {fragment}, props, id) => {
  return R.cond([
    // Apollo Client instance
    [R.has('apolloClient'),
      apolloConfig => apolloClientReadFragmentCacheContainer(
        apolloConfig,
        fragment,
        id
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
            return containerForApolloType(
              apolloConfig,
              {
                render: getRenderPropFunction(props),
                response: apolloClientReadFragmentCacheContainer(
                  R.merge(apolloConfig, {apolloClient}),
                  fragment,
                  id
                )
              }
            );
          }
        );
      }
    ]
  ])(apolloConfig);
});
