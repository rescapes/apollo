/**
 * Created by Andy Likuski on 2018.05.10
 * Copyright (c) 2018 Andy Likuski
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 */

import * as R from 'ramda';
import gql from 'graphql-tag';
import {print} from 'graphql';
import {v} from 'rescape-validate';
import {mergeDeep, reqStrPathThrowing} from 'rescape-ramda';
import PropTypes from 'prop-types';
import {makeFragmentQuery} from './queryHelpers';
import {of} from 'folktale/concurrency/task';
import {Just} from 'folktale/maybe';
import {loggers} from 'rescape-log';

const log = loggers.get('rescapeDefault');

/**
 * Like makeMutationContainer but creates a query with a client directive so values come back from the link state and not
 * the server
 * @param {Object} apolloConfig The Apollo configuration with either an ApolloClient for server work or an
 * Apollo wrapped Component for browser work. The client is specified here and the component in the component argument
 * @param {Object} apolloConfig.apolloClient Optional Apollo client, authenticated for most calls
 * @params {String} name The lowercase name of the object matching the query name, e.g. 'regions' for regionsQuery
 * @params {Object} readInputTypeMapper maps object keys to complex input types from the Apollo schema. Hopefully this
 * will be automatically resolved soon. E.g. {data: 'DataTypeofLocationTypeRelatedReadInputType'}
 * @param [String|Object] outputParams output parameters for the query in this style json format. See makeQueryContainer
 * @param {Object} props The properties to pass to the query.
 * @param {Object} props.id The id property is required to do a cache mutation so we know what to update and how
 * to find it again
 * @returns {Object} Task that resolves to and object with the results of the query. Successful results
 * are in obj.data[name]. Errors are in obj.errors. Since the queries are stored in data[name], multiple queries
 * of different could be merged together into the data field. This also matches what Apollo components expect.
 * If you need the value in a Result.Ok or Result.Error to halt operations on error, use requestHelpers.mapQueryTaskToNamedResultAndInputs.
 */
export const makeMutationWithClientDirectiveContainer = v(R.curry(
  (apolloConfig,
   {
     name,
     outputParams,
   },
   props) => {

    const fragment = gql`${makeFragmentQuery(name, {}, outputParams, R.pick(['__typename'], props))}`;
    // The id to get use to get the right fragment
    const id = `${reqStrPathThrowing('__typename', props)}:${reqStrPathThrowing('id', props)}`;
    log.debug(`Query Fragment for writeFragment: ${print(fragment)} id: ${id}`);

    /*
    const fragment = gql`
        fragment completeTodo on TodoItem {
            completed
        }
    `;
    */
    const cache = reqStrPathThrowing('apolloClient.cache', apolloConfig);
    const result = cache.readFragment({fragment, id});
    const data = mergeDeep(result, props);
    cache.writeFragment({fragment, id, data});

    // Put the new cache value in a Task or Maybe.Just, depending on if we have an Apollo Client or Container
    return R.cond([
      // If we have an ApolloClient
      [apolloConfig => R.has('apolloClient', apolloConfig),
        () => of(data)
      ],
      // If we have an Apollo Component
      [R.T,
        () => Just(data)
      ],

    ])(apolloConfig);
  }),
  [
    ['apolloConfig', PropTypes.shape().isRequired],
    ['mutationOptions', PropTypes.shape({
      name: PropTypes.string.isRequired,
      outputParams: PropTypes.arrayOf(
        PropTypes.oneOfType([
          PropTypes.string,
          PropTypes.array,
          PropTypes.shape()
        ])
      ).isRequired,
      // These are only used for simple mutations where there is no complex input type
      variableNameOverride: PropTypes.string,
      variableTypeOverride: PropTypes.string,
      mutationNameOverride: PropTypes.string
    })],
    ['props', PropTypes.shape().isRequired]
  ],
  'makeMutationWithClientDirectiveContainer'
);
