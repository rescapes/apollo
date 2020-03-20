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
import {gql} from '@apollo/client';
import {print} from 'graphql';
import {v} from 'rescape-validate';
import {capitalize, mergeDeepWithRecurseArrayItemsByRight, pickDeepPaths, reqStrPathThrowing} from 'rescape-ramda';
import PropTypes from 'prop-types';
import {makeFragmentQuery} from './queryHelpers';
import {of} from 'folktale/concurrency/task';
import {Just} from 'folktale/maybe';
import {loggers} from 'rescape-log';
import {omitClientFields} from './requestHelpers';
import {mapped} from 'ramda-lens';

const log = loggers.get('rescapeDefault');

/**
 * Used to update the cache by directly or in response to a mutation.
 *
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
export const makeCacheMutation = v(R.curry(
  (apolloConfig,
   {
     name,
     outputParams
   },
   props) => {
    const apolloClient = reqStrPathThrowing('apolloClient', apolloConfig);
    // Create a fragment to fetch the existing data from the cache. Note that we only use props for the __typename
    const fragment = gql`${makeFragmentQuery(
      `${name}WithoutClientFields`, 
      {}, 
      // Don't output cache only fields here. We just want the id
      omitClientFields(outputParams), 
      R.pick(['__typename'], props)
    )}`;
    // The id to get use to get the right fragment
    const id = `${reqStrPathThrowing('__typename', props)}:${reqStrPathThrowing('id', props)}`;
    log.debug(`Query Fragment: ${print(fragment)} id: ${id}`);

    // Get the fragment
    const result = apolloClient.readFragment({fragment, id});
    // Merge the existing cache data with the full props, where the props are the cache-only data to write
    // Be careful because props will override anything it matches with deep in result
    const data = mergeDeepWithRecurseArrayItemsByRight(
      item => R.when(R.is(Object), R.propOr(v, 'id'))(item),
      result,
      R.omit(['id', '__typename'], props)
    );
    // Write the fragment
    const writeFragment = gql`${makeFragmentQuery(
      `${name}WithClientFields`, 
      {}, 
      outputParams, 
      R.pick(['__typename'], props))
    }`;
    log.debug(`Query write Fragment: ${print(writeFragment)} id: ${id} args: ${JSON.stringify(R.pick(['__typename'], props))}`);
    apolloClient.writeFragment({fragment: writeFragment, id, data});
    // Read to verify that the write succeeded.
    // If this throws then we did something wrong
    try {
      const test = apolloClient.readFragment({fragment: writeFragment, id});
    } catch (e) {
      log.error('Could not read the fragment just written to the cache');
      throw e;
    }
    return data;
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
  'makeCacheMutation'
);

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
     outputParams
   },
   props) => {

    const data = makeCacheMutation(
      apolloConfig,
      {
        name,
        outputParams
      },
      props
    );

    // Put the new cache value in a Task or Maybe.Just, depending on if we have an Apollo Client or Container
    return R.cond([
      // If we have an ApolloClient
      [apolloConfig => R.has('apolloClient', apolloConfig),
        () => of(data)
      ],
      // If we have an Apollo Component
      [R.T,
        () => Just(data)
      ]
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

/**
 * For objects that only exist in the cache we need to assign them a type name
 * @param {String} typeName The plain type name, such as 'settings'. Used to name generate a cache-only __typename
 * @param {Object} cacheOnlyObjs Keyed by the path to the object, such as 'data.authorization' and valued
 * by
 * @return {any}
 */
const cacheOnlyObjectTypeNames = (typeName, cacheOnlyObjs) => {
  return R.fromPairs(
    R.map(
      path => {
        return [
          path,
          R.join('', [
              'CacheOnlyType',
              capitalize(typeName),
              ...R.compose(
                R.map(capitalize),
                // Eliminate wildcards from the path name
                R.filter(R.complement(R.equals)('*')),
                R.split('.')
              )(path)
            ]
          )
        ];
      }, cacheOnlyObjs)
  );
};

/**
 * Creates props that only belong in the cache based on the configuration
 * @param {String} name The name of the object, such as 'settings', used to create cache-only __typenames
 * @param {[String]} cacheOnlyObjs Paths of objects that only go in the cache. These get assigned type names
 * so that they cache correctly.
 * @param {[String]} cacheIdProps Paths of props that need to be included because they are ids or __typenames.
 * This can probably be automated with something like pickDeepWhenOtherPropsExists(['__typename', 'id'], props)
 * @param props
 * @return {Object} The limit props with __typenames added to objects that don't have them
 */
export const createCacheOnlyProps = ({name, cacheOnlyObjs, cacheIdProps}, props) => {
  // These our the paths that we only want in the cache, not sent to the server
  const limitedProps = pickDeepPaths(R.concat(cacheOnlyObjs, cacheIdProps), props);
  // Use cacheOnlyObjectTypeNames to add __typenames to cache only objects that need them
  return R.reduce(
    (prps, [path, value]) => {
      return R.over(
        // Use mapped for * to construct a lens prop that works on arrays.
        // TODO Not sure if this works for * on objects, but that's a strange shape for stored data anyway
        R.apply(R.compose,
          R.map(
            str => R.ifElse(
              R.equals('*'),
              () => mapped,
              str => R.lensProp(str)
            )(str),
            R.split('.', path)
          )
        ),
        pathValue => {
          return R.unless(
            R.isNil,
            pathValue => {
              return R.merge(pathValue, {__typename: value});
            }
          )(pathValue);
        }
      )(prps);
    },
    limitedProps,
    R.toPairs(cacheOnlyObjectTypeNames(name, cacheOnlyObjs))
  );
};