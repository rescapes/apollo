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
import {
  authApolloQueryContainer
} from '../client/apolloClient';
import {replaceValuesWithCountAtDepthAndStringify} from 'rescape-ramda';
import gql from 'graphql-tag';
import {print} from 'graphql';
import {authApolloClientOrComponentQueryCacheContainer} from '../client/apolloClientCache';
import {_makeQuery, makeQuery} from './queryHelpers';
import {loggers} from 'rescape-log';
import {Just} from 'folktale/maybe';

const log = loggers.get('rescapeDefault');

/**
 * Makes a graphql client query based on the queryParams
 * @param {String} queryName
 * @param {Object} inputParamTypeMapper maps Object params paths to the correct input type for the query
 * e.g. { 'data': 'DataTypeRelatedReadInputType' }
 * @param {Object} outputParams
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
 * @param {Object} apolloConfig.apolloComponent Optional Apollo component
 * @params {String} name The lowercase name of the object matching the query name, e.g. 'regions' for regionsQuery
 * @params {Object} readInputTypeMapper maps object keys to complex input types from the Apollo schema. Hopefully this
 * will be automatically resolved soon. E.g. {data: 'DataTypeofLocationTypeRelatedReadInputType'}
 * @param {String|Object} [outputParams] output parameters for the query in this style json format. See makeQueryContainer
 * @param {Object} [propsStructure] Optional Used when props can't be specified ahead of time
 * @param {Object} component The Apollo component for component queries
 * @param {Function} props The properties to pass to the query.
 * @returns {Task|Maybe} container that resolves to and object with the results of the query. Successful results
 * are in obj.data[name]. Errors are in obj.errors. Since the queries are stored in data[name], multiple queries
 * of different could be merged together into the data field. This also matches what Apollo components expect.
 * If you need the value in a Result.Ok or Result.Error to halt operations on error, use requestHelpers.mapQueryTaskToNamedResultAndInputs.
 */
export const makeQueryWithClientDirectiveContainer = R.curry((apolloConfig, {name, readInputTypeMapper, outputParams, propsStructure}, component, props) => {
  const query = gql`${makeClientQuery(name, readInputTypeMapper, outputParams, propsStructure)}`;
  log.debug(`Client Directive Query: ${print(query)} Arguments: ${JSON.stringify(props)}`);
  return R.map(
    queryResponse => {
      log.debug(`makeQueryWithClientDirectiveContainer for ${name} responded: ${replaceValuesWithCountAtDepthAndStringify(2, queryResponse)}`);
      // If we're using a component unwrap the Just to get the underlying wrapped component for Apollo/React to use
      // If we're using an Apollo client we have a task and leave to the caller to run
      return R.when(Just.hasInstance, R.prop('value'))(queryResponse);
    },
    // With the client directive on the query we can use the normal authApolloQueryContainer that's used
    // for non-client directive queries
    authApolloQueryContainer(
      apolloConfig,
      query,
      component,
      props
    )
  );
});


/**
 * Like makeQueryWithClientDirectiveContainer but only reads from the cache. This is just for testing the read cache. Normally you
 * should always call makeQueryContainer and it will consult the cache before querying externally. Or for
 * data only in the cache, loaded via ApolloLinkState, use makeQueryWithClientDirectiveContainer
 */
export const makeQueryFromCacheContainer = R.curry((apolloConfig, {name, readInputTypeMapper, outputParams}, component, props) => {
  // Not using the client directive here, rather we'll do a direct cache read with this query
  const query = gql`${makeQuery(name, readInputTypeMapper, outputParams, props)}`;
  log.debug(`Cache Query: ${print(query)} Arguments: ${JSON.stringify(props)}`);
  return R.map(
    queryResponse => {
      log.debug(`makeQueryFromCacheContainer for ${name} responded: ${replaceValuesWithCountAtDepthAndStringify(2, queryResponse)}`);
      // If we're using a component unwrap the Just to get the underlying wrapped component for Apollo/React to use
      // If we're using an Apollo client we have a task and leave to the caller to run
      return R.when(Just.hasInstance, R.prop('value'))(queryResponse);
    },
    authApolloClientOrComponentQueryCacheContainer(
      apolloConfig,
      {
        query
      },
      component,
      props
    )
  );
});