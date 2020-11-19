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

import {inspect} from 'util';
import * as R from 'ramda';
import * as AC from '@apollo/client';
import {defaultNode} from './utilityHelpers.js'
const {gql} = defaultNode(AC)
import {print} from 'graphql';
import {v} from '@rescapes/validate';
import {capitalize, mergeDeepWithRecurseArrayItemsByRight, pickDeepPaths, reqStrPathThrowing} from '@rescapes/ramda'
import PropTypes from 'prop-types';
import {makeFragmentQuery} from './queryHelpers.js';
import T from 'folktale/concurrency/task/index.js'
const {of} = T;
import maybe from 'folktale/maybe/index.js';
import {loggers} from '@rescapes/log';
import {omitClientFields, omitUnrepresentedOutputParams} from './requestHelpers.js';
import {firstMatchingPathLookup} from './utilityHelpers.js';

const {Just} = maybe;


const log = loggers.get('rescapeDefault');

/**
 * Used to update the cache by directly or in response to a mutation.
 *
 * @param {Object} apolloConfig The Apollo configuration with either an ApolloClient for server work or an
 * Apollo wrapped Component for browser work. The client is specified here and the component in the component argument
 * @param {Object} apolloConfig.apolloClient Optional Apollo client, authenticated for most calls
 * @params {Object} mutationConfig
 * @params {String|Number|Function} mutationConfig.idField Default 'id', alternative id field
 * If a function pass props to get the value
 * @params {String} mutationConfig.name The lowercase name of the object matching the query name, e.g. 'regions' for regionsQuery
 * @params {Object} mutationConfig.readInputTypeMapper maps object keys to complex input types from the Apollo schema. Hopefully this
 * will be automatically resolved soon. E.g. {data: 'DataTypeofLocationTypeRelatedReadInputType'}
 * @param {Array|Object} mutationConfig.outputParams output parameters for the query in this style json format. See makeQueryContainer.
 * @param {Array|Object} [mutationConfig.idPathLookup] Optional lookup for array items by the array's field key to see how to
 * @param {Boolean} [mutationConfig.mergeFromCacheFirst] Default false. If true do a deep merge with the existing
 * value in cache before writing. This usually isn't needed because the cache is configured with type policies that
 * do the merging.
 * @param {Boolean} [force] Default false. Write to the cache even without @client fields
 * identify the array item. This is a path to an id, such as 'region.id' for userRegions.region.id
 * outputParams must contain @client directives that match values in props. Otherwise this function will not write
 * anything to the cache that wasn't written by the mutation itself
 * @param {Boolean} [singleton] Default false. When true, don't use an id, but assume only on instance is being cached
 * @param {Object} props The properties to pass to the query.
 * @param {Object} props.id The id property is required to do a cache mutation so we know what to update and how
 * to find it again
 * @returns {Object} Task that resolves to and object with the results of the query. Successful results
 * are in obj.data[name]. Errors are in obj.errors. Since the queries are stored in data[name], multiple queries
 * of different could be merged together into the data field. This also matches what Apollo components expect.
 * If you need the value in a Result.Ok or Result.Error to halt operations on error, use requestHelpers.mapQueryContainerToNamedResultAndInputs.
 */
export const makeCacheMutation = v(R.curry(
  (apolloConfig,
   {
     idField = 'id',
     name,
     outputParams,
     idPathLookup,
     mergeFromCacheFirst,
     force = false,
     singleton = false
   },
   props) => {

    // Use the apolloClient or store
    const apolloClientOrStore = R.propOr(R.prop('store', apolloConfig), 'apolloClient', apolloConfig);
    // The id to get use to get the right fragment
    const id = R.ifElse(
      R.identity,
      () => reqStrPathThrowing('__typename', props),
      () => `${reqStrPathThrowing('__typename', props)}:${
        R.ifElse(
          R.is(Function),
          idField => idField(props),
          idField => reqStrPathThrowing(idField, props)
        )(idField)}`
    )(singleton);

    const minimizedOutputParams = omitUnrepresentedOutputParams(props, outputParams);
    const outputParamsWithOmittedClientFields = omitClientFields(minimizedOutputParams);
    if (!force && R.equals(minimizedOutputParams, outputParamsWithOmittedClientFields)) {
      const info = `makeCacheMutation: For ${name}, outputParams do not contain any @client directives. Found ${
        inspect(minimizedOutputParams)
      }. No write to the cache will be performed`;
      log.info(info);
      return props;
    }

    // Optionally merge the existing cache data into the props before writing.
    // This shouldn't normally be need because writing the fragment triggers the cache's type policy merge functions
    const propsWithPossibleMerge = R.when(
      () => mergeFromCacheFirst,
      props => mergeExistingFromCache({
        apolloClient: apolloClientOrStore,
        idPathLookup,
        outputParamsWithOmittedClientFields,
        id
      }, props)
    )(props);

    // Write the fragment
    const writeFragment = gql`${makeFragmentQuery(
      `${name}WithClientFields`, 
      {}, 
      minimizedOutputParams, 
      R.pick(['__typename'], props))
    }`;

    log.debug(`Write Cache Fragment: ${
      print(writeFragment)
    } id: ${id} args: ${
      inspect(propsWithPossibleMerge, null, 2)
    }`);

    apolloClientOrStore.writeFragment({fragment: writeFragment, id, data: propsWithPossibleMerge});
    // Read to verify that the write succeeded.
    // If this throws then we did something wrong
    try {
      const test = apolloClientOrStore.readFragment({fragment: writeFragment, id});
    } catch (e) {
      log.error(`Could not read the fragment just written to the cache. Props ${inspect(props)}`);
      throw e;
    }
    return propsWithPossibleMerge;
  }),
  [
    ['apolloConfig', PropTypes.shape().isRequired],
    ['mutationOptions', PropTypes.shape({
      name: PropTypes.string.isRequired,
      outputParams: PropTypes.oneOfType([
        PropTypes.array,
        PropTypes.shape()
      ]).isRequired,
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
 * Reads from the cache and merges the results with props. Props values take precendence, and array items
 * are merged by the id path configured in idPathLookup
 * @param apolloClient
 * @param idPathLookup
 * @param outputParamsWithOmittedClientFields
 * @param id
 * @param props
 * @return {*}
 */
const mergeExistingFromCache = ({apolloClient, idPathLookup, outputParamsWithOmittedClientFields, id}, props) => {
  // TODO It would be ideal not to merge what's in the cache before writing our cache only values,
  // since the cache write will deep merge existing with incoming anyway. But unless we do this merge
  // here we don't see able to match what is already in the cache. It might be possible to only
  // write fragments with cache-only items here that would merge correctly. For now we do a single write
  // of pre-merged data that will be merged again by the cache

  // Create a fragment to fetch the existing data from the cache. Note that we only use props for the __typename
  const fragment = gql`${makeFragmentQuery(
      `${name}WithoutClientFields`, 
      {}, 
      // Don't output cache only fields where
      outputParamsWithOmittedClientFields, 
      R.pick(['__typename'], props)
    )}`;
  log.debug(`Query Fragment: ${print(fragment)} id: ${id}`);

  // Get the fragment
  const result = apolloClient.readFragment({fragment, id});

  return mergeCacheable({idPathLookup}, result, props);
};

/**
 * Merges an existing cache object with an incoming, merging array items by configured id
 * @param config
 * @param [config.idPathLookup] Optional id path look for array items needing to resolve and id
 * @param existing
 * @param incoming
 * @return {*}
 */
export const mergeCacheable = ({idPathLookup}, existing, incoming) => {
  // Merge the existing cache data with the full props, where the props are the cache-only data to write
  return mergeDeepWithRecurseArrayItemsByRight(
    (item, propKey) => R.when(
      R.is(Object),
      item => {
        // Use idPathLookup to identify an id for item[propKey]. idPathLookup is only needed if
        // item[propKey] does not have its own id.
        return firstMatchingPathLookup(idPathLookup, propKey, item);
      }
    )(item),
    existing,
    incoming
  );
};

/**
 * Like makeMutationContainer but creates a query from outputParams that contain at least one @client directive
 * to read existing values from the cache and write cache only values in props that match the @client directives
 * in the outpuParams
 *
 * Note that it's currently not possible to use this to without @client directives in the outputParams. If there
 * is a use case for writing to the cache based on a query without @client directives, then change the code to enable.
 *
 * @param {Object} apolloConfig The Apollo configuration with either an ApolloClient for server work or an
 * Apollo wrapped Component for browser work. The client is specified here and the component in the component argument
 * @param {Object} apolloConfig.apolloClient Optional Apollo client, authenticated for most calls
 * @params {String} name The lowercase name of the object matching the query name, e.g. 'regions' for regionsQuery
 * @params {Object} readInputTypeMapper maps object keys to complex input types from the Apollo schema. Hopefully this
 * will be automatically resolved soon. E.g. {data: 'DataTypeofLocationTypeRelatedReadInputType'}
 * @param {Array|Object} outputParams output parameters for the query in this style json format. See makeQueryContainer
 * outputParams must contain @client directives that match values in props. Otherwise this function will not write
 * anything to the cache that wasn't written by the mutation itself.
 * @param {Object} props The properties to pass to the query.
 * @param {Object} props.id The id property is required to do a cache mutation so we know what to update and how
 * to find it again
 * @returns {Object} Task that resolves to and object with the results of the query. Successful results
 * are in obj.data[name]. Errors are in obj.errors. Since the queries are stored in data[name], multiple queries
 * of different could be merged together into the data field. This also matches what Apollo components expect.
 * If you need the value in a Result.Ok or Result.Error to halt operations on error, use requestHelpers.mapQueryContainerToNamedResultAndInputs.
 */
export const makeMutationWithClientDirectiveContainer = v(R.curry(
  (apolloConfig,
   {
     name,
     outputParams,
     idPathLookup
   },
   props) => {

    const data = makeCacheMutation(
      apolloConfig,
      {
        name,
        outputParams,
        idPathLookup
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
      outputParams: PropTypes.oneOfType([
        PropTypes.array,
        PropTypes.shape()
      ]).isRequired,
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