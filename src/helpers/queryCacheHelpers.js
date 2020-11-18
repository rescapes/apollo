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

import {formatWithOptions} from 'util';
import R from 'ramda';
import {authApolloQueryContainer} from '../client/apolloClient.js';
import {replaceValuesWithCountAtDepthAndStringify, reqStrPathThrowing} from '@rescapes/ramda'
import AC from '@apollo/client';
import {print} from 'graphql';
import {
  authApolloClientOrComponentQueryCacheContainer,
  authApolloClientOrComponentReadFragmentCacheContainer
} from '../client/apolloClientCache.js';
import {_makeQuery, makeFragmentQuery, makeQuery} from './queryHelpers.js';
import {loggers} from '@rescapes/log';
import {_winnowRequestProps} from './requestHelpers.js';
import {pickRenderProps} from './componentHelpersMonadic.js';

const {gql} = AC

const log = loggers.get('rescapeDefault');

/**
 * Makes a graphql client query based on the queryParams
 * @param {String} queryName
 * @param {Object} inputParamTypeMapper maps Object params paths to the correct input type for the query
 * e.g. { 'data': 'DataTypeRelatedReadInputType' }
 * @param {Array|Object} outputParams
 * @param {Object} queryArguments
 * @returns {String} The query in a string
 */
export const makeClientQuery = R.curry((queryName, inputParamTypeMapper, outputParams, queryArguments) => {
  return _makeQuery({client: true}, queryName, inputParamTypeMapper, outputParams, queryArguments);
});

/**
 * Like makeQueryContainer but creates a query with a client directive so values come back from the cache and not
 * the server
 * @param {Object} apolloConfig The Apollo configuration with either an ApolloClient for server work
 * @param {Object} apolloConfig.apolloClient Optional Apollo client, authenticated for most calls
 * @params {String} name The lowercase name of the object matching the query name, e.g. 'regions' for regionsQuery
 * @params {Object} readInputTypeMapper maps object keys to complex input types from the Apollo schema. Hopefully this
 * will be automatically resolved soon. E.g. {data: 'DataTypeofLocationTypeRelatedReadInputType'}
 * @param {Array|Object} [outputParams] output parameters for the query in this style json format. See makeQueryContainer
 * @param {Object} component The Apollo component for component queries
 * @param {Function} props The properties to pass to the query.
 * @returns {Task|Maybe} container that resolves to and object with the results of the query. Successful results
 * are in obj.data[name]. Errors are in obj.errors. Since the queries are stored in data[name], multiple queries
 * of different could be merged together into the data field. This also matches what Apollo components expect.
 * If you need the value in a Result.Ok or Result.Error to halt operations on error, use requestHelpers.mapQueryContainerToNamedResultAndInputs.
 */
export const makeQueryWithClientDirectiveContainer = R.curry((
  apolloConfig,
  {name, readInputTypeMapper, outputParams},
  props
) => {
  const query = gql`${makeClientQuery(name, readInputTypeMapper, outputParams, props)}`;
  log.debug(`Client Directive Query:\n\n${print(query)}\nArguments:\n${formatWithOptions({depth: 10}, '%j', props)}\n`);
  // With the client directive on the query we can use the normal authApolloQueryContainer that's used
  // for non-client directive queries
  const componentOrTask = authApolloQueryContainer(
    apolloConfig,
    query,
    props
  );
  return R.when(
    componentOrTask => 'run' in componentOrTask,
    // If it's a task report the result. Components have run their query
    componentOrTask => {
      return R.map(
        queryResponse => {
          log.debug(`makeQueryWithClientDirectiveContainer for ${name} responded: ${replaceValuesWithCountAtDepthAndStringify(2, queryResponse)}`);
          return queryResponse;
        },
        componentOrTask
      );
    }
  )(componentOrTask);
});


/**
 * Like makeQueryWithClientDirectiveContainer but only reads from the cache.
 * @param {Object} apolloConfig The Apollo configuration with either an ApolloClient for server work
 * @param {Object} apolloConfig.apolloClient Optional Apollo client, authenticated for most calls
 * @params {String} name The lowercase name of the object matching the query name, e.g. 'regions' for regionsQuery
 * @params {Object} readInputTypeMapper maps object keys to complex input types from the Apollo schema. Hopefully this
 * will be automatically resolved soon. E.g. {data: 'DataTypeofLocationTypeRelatedReadInputType'}
 * @param {Array|Object} [outputParams] output parameters for the query in this style json format. See makeQueryContainer
 * @param {Object} component The Apollo component for component queries
 * @param {Function} props The properties to pass to the query.
 * @returns {Object} Returns the object from cache
 */
export const makeQueryFromCacheContainer = R.curry((apolloConfig, {name, readInputTypeMapper, outputParams}, props) => {
  // Not using the client directive here, rather we'll do a direct cache read with this query
  const winnowedProps = _winnowRequestProps(apolloConfig, props);
  const query = gql`${makeQuery(
    name, 
    readInputTypeMapper, 
    outputParams, 
    winnowedProps
  )}`;
  log.debug(`Cache Query:\n\n${print(query)}\nArguments:\n${formatWithOptions({depth: 10}, '%j', winnowedProps)}\n`);
  const response = authApolloClientOrComponentQueryCacheContainer(
    apolloConfig,
    {
      query
    },
    R.merge(
      winnowedProps,
      pickRenderProps(props)
    )
  );
  // If it's not a component response
  if (R.has('data', response)) {
    log.debug(`makeQueryFromCacheContainer for ${name} responded: ${replaceValuesWithCountAtDepthAndStringify(2, response)}`);
  }
  return response;
});

/**
 * Read a fragment from the cache and return a task or apollo client
 * @param {Object} apolloConfig
 * @param {Object} config
 * @param {String} config.name The fragment name. This should match the mutation name that wrote the fragment
 * @param {Object} config.readInputMapper. Probably never needed
 * @param {Object} config.outputParams. The fragment query outputParams. Must be a subset of what was put in the cache
 * @param {Object} props All props (including the render prop for components). All props are passed to the render
 * function except id and __typename
 * @param {String} props.__typename Required. The typename for the fragment query
 * @param {Number|String} props.id Required. The id for the fragment query
 */
export const makeReadFragmentFromCacheContainer = R.curry((apolloConfig, {name, readInputTypeMapper, outputParams}, props) => {
  // Write the fragment
  const fragment = gql`${makeFragmentQuery(
  `${name}WithClientFields`,
   readInputTypeMapper,
    outputParams, 
    R.pick(['__typename'], props)
  )}`;

  log.debug(`Read Cache Fragment:\n${print(fragment)}\nArguments:\n${formatWithOptions({depth: 10}, '%j', props)}\n`);
  const response = authApolloClientOrComponentReadFragmentCacheContainer(
    apolloConfig,
    {
      fragment
    },
    R.omit(['__typename', 'id'], props),
    reqStrPathThrowing('id', props)
  );
  if (R.has('data', response || {})) {
    log.debug(`makeQueryFromCacheContainer for ${name} responded: ${replaceValuesWithCountAtDepthAndStringify(2, response)}`);
  }
  return response;
});
