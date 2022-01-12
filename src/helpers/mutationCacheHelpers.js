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
import hash from 'object-hash'
import {inspect} from 'util';
import * as R from 'ramda';
import * as AC from '@apollo/client';
import {print} from 'graphql';
import {v} from '@rescapes/validate';
import {
  capitalize,
  defaultNode, lowercase,
  mergeDeepWithRecurseArrayItemsByRight,
  pickDeepPaths,
  reqStrPathThrowing, toArrayIfNot, toNamedResponseAndInputs
} from '@rescapes/ramda';
import PropTypes from 'prop-types';
import {
  composeFuncAtPathIntoApolloConfig,
  makeFragmentQuery,
  makeQuery,
  makeWriteQuery,
  typeNameToQueryName
} from './queryHelpers.js';
import T from 'folktale/concurrency/task/index.js';
import {loggers} from '@rescapes/log';
import {winnowRequestProps, omitClientFields, omitUnrepresentedOutputParams} from './requestHelpers.js';
import {firstMatchingPathLookup} from './utilityHelpers.js';
import {containerForApolloType, mapTaskOrComponentToNamedResponseAndInputs} from './containerHelpers.js';
import {composeWithComponentMaybeOrTaskChain, getRenderPropFunction} from './componentHelpersMonadic.js';
import {e} from '../helpers/componentHelpers.js';
import {makeQueryFromCacheContainer} from "./queryCacheHelpers.js";
import {flattenObj} from "@rescapes/ramda/src/functions.js";
import pluralize from "pluralize";

const {gql, ApolloConsumer} = defaultNode(AC);

const {of} = T;

const log = loggers.get('rescapeDefault');

/**
 * Used to update the cache by directly or in response to a mutation.
 *
 * @param {Object} apolloConfig The Apollo configuration with either an ApolloClient for server work or an
 * Apollo wrapped Component for browser work. The client is specified here and the component in the component argument
 * @param {Object} apolloConfig.apolloClient Optional Apollo client, authenticated for most calls
 * @param {Object} [apolloConfig.options.variables] Defaults to the identity function.
 * Accepts the props and resolves to the props that should be cached
 * @params {Object} mutationConfig
 * @params {String|Number|Function} mutationConfig.idField Default 'id', alternative id field
 * If a function pass props to get the value
 * @params {String} mutationConfig.name The lowercase name of the object matching the query name, e.g. 'regions' for regionsQuery
 * @params {Object} mutationConfig.readInputTypeMapper maps object keys to complex input types from the Apollo schema. Hopefully this
 * will be automatically resolved soon. E.g. {data: 'DataTypeofLocationTypeRelatedReadInputType'}
 * @param {Array|Object} mutationConfig.outputParams output parameters for the query in this style json format. See makeQueryContainer.
 * @param {Array|Object} [mutationConfig.idPathLookup] Optional lookup for array items by the array's field key
 * @param {Boolean} [mutationConfig.mergeFromCacheFirst] Default false. If true do a deep merge with the existing
 * value in cache before writing. This usually isn't needed because the cache is configured with type policies that
 * do the merging.
 * @param {Boolean} [mutationConfig.requireClientFields] Default false. If true requires that at least one @client directive
 * is present in the outputParams. This is used for mutations whose update method writes additional data to
 * the cache. It ensures that there actually is additional data to write to the cache.
 * if true, outputParams must contain @client directives that match values in props. Otherwise this function will not write
 * anything to the cache that wasn't written by the mutation itself. Set false for cache-only mutations.
 * @param {Boolean} [mutationConfig.singleton] Default false. When true, don't use an id, but assume only on instance is being cached
 * @param {Boolean} [mutationConfig.singular] Default false. Indicates that the corresponding server query returns
 * a singular instance, not a list. Most queries return a list and must therefore be cached as a list when
 * caching explicitly with this function
 * @param {Object} props The properties to pass to the query.
 * @param {Object} props.id The id property is required to do a cache mutation so we know what to update and how
 * to find it again
 * @returns {Object} The cached data read from cache after writing to it. It's important to read the cache
 * after writing since the write often merges data already in the cache.
 **/
export const makeCacheMutation = v(R.curry(
    (apolloConfig,
     {
       idField = 'id',
       name,
       outputParams,
       idPathLookup,
       mergeFromCacheFirst,
       requireClientFields = false,
       singleton = false,
       singular = false
     },
     props) => {

      // If apolloConfig.options.variables is specified, this winnows the props to whatever we want to cache
      // If can also resolve the props to an array of items if we are concatting with existing cache array or empty array
      const resolvedProps = winnowRequestProps(apolloConfig, {preserveTypeNames: true}, props)

      // Use the apolloClient or store
      const apolloClientOrStore = R.propOr(R.prop('store', apolloConfig), 'apolloClient', apolloConfig);
      const resolvedIdField = R.when(
        R.is(Function),
        // If already a function, call it to resolve the field. This would probably never be needed
        idField => idField(resolvedProps),
      )(idField)
      // The id for the cache query
      const id = !singleton ? R.prop(resolvedIdField, props) : null;

      const minimizedOutputParams = omitUnrepresentedOutputParams(resolvedProps, outputParams);
      const outputParamsWithOmittedClientFields = omitClientFields(minimizedOutputParams);
      if (requireClientFields && R.equals(minimizedOutputParams, outputParamsWithOmittedClientFields)) {
        const info = `makeCacheMutation: For ${name}, outputParams do not contain any @client directives. Found ${
          inspect(minimizedOutputParams)
        }. No write to the cache will be performed`;
        log.info(info);
        return resolvedProps;
      }

      // Optionally merge the existing cache data into the props before writing.
      // This shouldn't normally be need because writing the fragment triggers the cache's type policy merge functions
      const propsWithPossibleMerge = R.when(
        () => mergeFromCacheFirst,
        props => mergeExistingFromCache({
          apolloClient: apolloClientOrStore,
        }, {
          idField: resolvedIdField,
          idPathLookup,
          outputParamsWithOmittedClientFields,
          singleton
        }, props)
      )(resolvedProps);

      const writeQuery = gql`${makeWriteQuery({
          queryName: `write${capitalize(name)}`,
          typeName: props.__typename,
          inputParamTypeMapper: {},
          outputParams: minimizedOutputParams
        },
        id ? {[idField]: id} : {}
      )
      }`;

      // Most of our queries comes back from the API as a list, even if they are for a single id. The exception
      // are built in ones like JSONAuthToken. Thus we need to cache as a list to match what the server returns.
      const data = {
        // We have to wrap the data in the query (e.g. settings) which comes from the typename (e.g. SettingsType)
        [typeNameToQueryName({singular}, props.__typename)]: R.unless(
          // Unless singular is passed as true, wrap the queried instances in a list
          R.always(singular),
          // Put the dat in a list if the queryContainerName is plural
          toArrayIfNot
        )(propsWithPossibleMerge)
      }
      log.debug(`Write Cache Query: ${
        print(writeQuery)
      }\ndata ${
        inspect(data, null, 10)
      }`);

      apolloClientOrStore.writeQuery({query: writeQuery, variables: id ? {[idField]: id} : {}, data});
      // Read to verify that the write succeeded.
      // If this throws then we did something wrong
      try {
        const test = apolloClientOrStore.readQuery({query: writeQuery, variables: id ? {[idField]: id} : {}});
        if (!test) {
          throw new Error('null readQuery result. Check Apollo logged error about missing fields');
        }
        return test
      } catch (e) {
        log.error(`Could not read the query just written to the cache. Props ${inspect(propsWithPossibleMerge)}`);
        throw e;
      }
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
 * TODO It would be ideal not to merge what's in the cache before writing our cache only values,
 * since the cache write will deep merge existing with incoming anyway. But unless we do this merge
 * here we don't see able to match what is already in the cache. It might be possible to only
 * write fragments with cache-only items here that would merge correctly. For now we do a single write
 * of pre-merged data that will be merged again by the cache
 * @param apolloClient
 * @param config
 * @param config.idField. Normally 'id' but might be 'key' or similar
 * @param {Array|Object} [config.idPathLookup] Optional lookup for array items by the array's field key
 * @param {Object} config.outputParamsWithOmittedClientFields Output params
 * @param {Boolean} config.singleton True if the query is for a singleton like ObtainJSONTOken is
 * @param props
 * @return {*}
 */
const mergeExistingFromCache = (apolloClient, {
  idField,
  idPathLookup,
  outputParamsWithOmittedClientFields,
  singleton
}, props) => {
  return R.compose(
    ({cacheId, props}) => {
      // Create a fragment to fetch the existing data from the cache. Note that we only use props for the __typename
      const fragment = makeFragmentQuery(
        `${name}WithoutClientFields`,
        {},
        // Don't output cache only fields where
        outputParamsWithOmittedClientFields,
        R.pick(['__typename'], props)
      );
      log.debug(`Query Fragment: ${print(fragment)} id: ${cacheId}`);

      // Get the fragment
      const result = apolloClient.readFragment({fragment, cacheId});
      return mergeCacheable({idPathLookup}, result, props);
    },
    // The cacheId if we need to merge what is already in the cache
    toNamedResponseAndInputs('cacheId',
      ({props, idField, singleton}) => {
        return R.ifElse(
          R.identity,
          () => reqStrPathThrowing('__typename', props),
          () => `${reqStrPathThrowing('__typename', props)}:${
            // The apollo cache stores non-ids as {"key":"value"} as the cache key.
            R.unless(
              () => R.equals('id', idField),
              resolvedIdField => `{"${resolvedIdField}":"${id}"}`
            )(idField)
          }`
        )(singleton)
      }
    )
  )({props, idField, singleton})
}

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
const _mergeExistingFromCache = (apolloClient, {idPathLookup, outputParamsWithOmittedClientFields, id}, props) => {


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
 * @param {Object} apolloConfig.apolloClient.options.variables Default identity. Accepts the props and resolves to
 * the props that should be cached
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
export const makeCacheMutationContainer = v(R.curry(
    (apolloConfig,
     {
       idField = 'id',
       name,
       outputParams,
       idPathLookup,
       mergeFromCacheFirst,
       requireClientFields = false,
       singleton = false
     },
     props) => {

      const _makeCacheMutation = apolloConfig => {
        return makeCacheMutation(
          apolloConfig,
          {
            idField,
            name,
            outputParams,
            idPathLookup,
            mergeFromCacheFirst,
            requireClientFields,
            singleton
          },
          R.omit(['render'], props)
        );
      };

      // Put the new cache value in a Task or component, depending on if we have an Apollo Client or Container
      return R.cond([
        // If we have an ApolloClient
        [apolloConfig => R.has('apolloClient', apolloConfig),
          () => of(_makeCacheMutation(apolloConfig))
        ],
        // If we have an Apollo Component
        [R.T,
          // Since we aren't using a Query component, use an ApolloConsumer to get access to the
          // apollo client from the react context
          apolloConfig => {
            return e(
              ApolloConsumer,
              {},
              apolloClient => {
                const _apolloConfig = R.merge(apolloConfig, {apolloClient});
                const data = _makeCacheMutation(_apolloConfig);
                return containerForApolloType(
                  apolloClient,
                  {
                    render: getRenderPropFunction(props),
                    response: data
                  }
                );
              }
            );
          }
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
  'makeCacheMutationContainer'
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