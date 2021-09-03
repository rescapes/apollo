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
import {
  capitalize,
  compact,
  defaultNode, lowercase,
  mapObjToValues,
  memoized,
  omitDeep,
  replaceValuesWithCountAtDepthAndStringify,
  reqStrPathThrowing,
  strPathOr
} from '@rescapes/ramda';
import * as R from 'ramda';
import {_winnowRequestProps, formatOutputParams, omitClientFields, resolveGraphQLType} from './requestHelpers.js';
import {v} from '@rescapes/validate';
import {loggers} from '@rescapes/log';
import {singularize} from 'inflected';
import PropTypes from 'prop-types';
import * as AC from '@apollo/client';
import {print} from 'graphql';
import {authApolloQueryContainer} from '../client/apolloClient.js';
import T from 'folktale/concurrency/task/index.js';
import {composeWithComponentMaybeOrTaskChain, getRenderPropFunction, nameComponent} from './componentHelpersMonadic.js';
import {containerForApolloType, mapTaskOrComponentToNamedResponseAndInputs} from './containerHelpers.js';

const {gql} = defaultNode(AC);

const {of} = T;

const log = loggers.get('rescapeDefault');


/**
 * Makes a graphql query based on the queryParams
 * @param {String} queryName
 * @param {Object} inputParamTypeMapper maps Object params paths to the correct input type for the query
 * e.g. { 'data': 'DataTypeRelatedReadInputType' }
 * @param {Array|Object} outputParams
 * @param {Object} queryArguments
 * @returns {String} The query in a string
 */
export const makeQuery = (queryName, inputParamTypeMapper, outputParams, queryArguments) => {
  // Hack here to omit client fields when using mocks since @apollo/react-testing errors because it removes
  // the @client directives in our mock queries even if we put them in
  // https://github.com/apollographql/react-apollo/issues/3316
  return _makeQuery({}, queryName, inputParamTypeMapper,  process.env.USE_MOCKS ? omitClientFields(outputParams) : outputParams, queryArguments);
};
export const makeWriteQuery = (queryName, typeName, inputParamTypeMapper, outputParams, queryArguments) => {
  return _makeQuery({queryRootName: lowercase(typeName)}, queryName, inputParamTypeMapper, outputParams, queryArguments);
};

/**
 * Creates a fragment query for fetching values from the cache
 * @param {String} queryName Unique query name
 * @param {Object} inputParamTypeMapper Used to generate the correct complex input types
 * @param {Array|Object} outputParams
 * @param props Only for __typename
 * @param {String} [props.__typename] Only required for fragment queries
 * I think fragments never need args so only queryArguments.__typename should be specified for fragment queries
 * @return {string} The query string, not gql
 * @type {any}
 */
export const makeFragmentQuery = R.curry((queryName, inputParamTypeMapper, outputParams, props) => {
  return _makeQuery({isFragment: true}, queryName, inputParamTypeMapper, outputParams, props);
});

/***
 *
 * Makes a query or fragment query.
 * Memoized so we don't give Apollo the same query twice
 * @param {Object} queryConfig
 * @param {Boolean} queryConfig.client If true adds a client directive
 * @param {Boolean} queryConfig.isFragment If true creates a fragment
 * @param {Boolean} queryConfig.queryRootName: Named for the root query for write queries
 * that must match the typename
 * @param queryName
 * @param inputParamTypeMapper
 * @param {Array|Object} outputParams
 * @param props
 * @param {String} [props.__typename] Only required for fragment queries
 * I think fragments never need args so only queryArguments.__typename should be specified for fragment queries
 * @return {string} The query string, not gql
 * @private
 */
export const _makeQuery = memoized((queryConfig, queryName, inputParamTypeMapper, outputParams, props) => {
  const resolve = resolveGraphQLType(inputParamTypeMapper);

  // Never allow __typename. It might be in the queryArguments if the they come from the output of another query
  const cleanedQueryArguments = omitDeep(['__typename'], props);

  // These are the first line parameter definitions of the query, which list the name and type
  const params = R.join(
    ', ',
    mapObjToValues(
      (value, key) => {
        // Map the key to the inputParamTypeMapper value for that key if given
        // This is only needed when value is an Object since it needs to map to a custom graphql inputtype
        return `$${key}: ${resolve(key, value)}!`;
      },
      cleanedQueryArguments
    )
  );

  const parenWrapIfNotEmpty = str => R.unless(R.isEmpty, str => `(${str})`, str);

  // These are the second line arguments that map parameters to variables
  const args = R.join(
    ', ',
    mapObjToValues((value, key) => {
      return `${key}: $${key}`;
    }, cleanedQueryArguments)
  );

  // Only use parens if there are actually variables/arguments
  const variableString = R.ifElse(R.length, R.always(params), R.always(''))(R.keys(cleanedQueryArguments));

  const clientTokenIfClientQuery = R.ifElse(R.prop('client'), R.always('@client'), R.always(null))(queryConfig);

  // Either we have a query queryName or fragment queryName on queryArguments.__typename
  // I think fragments never need args so only queryArguments.__typename should be specified for fragment queryies
  const queryOrFragment = R.ifElse(
    R.prop('isFragment'),
    R.always(`fragment ${queryName}Fragment on ${R.prop('__typename', props)}`),
    R.always(`query ${queryName}`)
  )(queryConfig);

  // Unless we are creating a fragment, wrap the outputParams in the name of the type we are querying
  const unlessFragment = content => R.ifElse(
    R.prop('isFragment'),
    R.always(null),
    R.always(content)
  )(queryConfig);

  // If we pass in a query name based on a mutation, such as 'createSettings' or 'updateSettings',
  // we need to remove the verb from the outputParams and lowercase
  const removedCreateUpdateQueryName = R.compose(
    lowercase,
    n => R.replace(/^(create|update)/, '', n)
  )(queryName)
  const output = R.join('', compact([
    unlessFragment(R.join(' ', compact([strPathOr(removedCreateUpdateQueryName, 'queryRootName', queryConfig), parenWrapIfNotEmpty(args), clientTokenIfClientQuery, '{']))),
    formatOutputParams(outputParams),
    unlessFragment('}')
  ]));

  // We use the queryName as the label of the query and the name that matches the schema
  return `${queryOrFragment} ${parenWrapIfNotEmpty(variableString)} { 
  ${output}
}`;
});

/**
 * Composes normalizeProps onto options.variables function if already defined by the caller.
 * For components only, composes onSuccess and onError debug messages on to any such function defined by the caller
 * @param {Object} apolloConfig
 * @param {Object} config
 * @param {Function} config.normalizeProps Normalizes props produced by the callers options.variables function
 * @param {Object} query The graphql query object
 * @param {Boolean} skip A flag to aid the debugging messages if the query is being skipped
 * @param {Object} winnowedProps Used for the debugger messages to show what variables are being passed by the query
 * these props have been bootstrapped by passing through options.variables ahead of time
 * @returns {*}
 */
const modifyApolloConfigFuncsForQuery = (apolloConfig, {normalizeProps, query, skip, winnowedProps}) => {
  return R.compose(
    // Merge the caller's optional  'onSuccess' function with the debug info
    apolloConfig => {
      return composeFuncAtPathIntoApolloConfig(
        apolloConfig,
        'onError',
        error => {
          log.warning(`Query Erred: ${inspect(error, false, 10)}\n${
            print(query)
          }\nArguments:\n${
            R.ifElse(
              () => skip,
              () => 'Props are not ready',
              (winnowedProps) => inspect(winnowedProps, false, 10)
            )(winnowedProps)
          }\n`);
        }
      );
    },
    // For component queries merge the caller's optional  'onSuccess' function with the debug info
    apolloConfig => {
      return composeFuncAtPathIntoApolloConfig(
        apolloConfig,
        'onSuccess',
        data => {
          log.debug(`Queried Responded: \n${
            print(query)
          }\nArguments:\n${
            R.ifElse(
              () => skip,
              () => 'Props are not ready',
              (winnowedProps) => inspect(winnowedProps, false, 10)
            )(winnowedProps)
          }\nWith Data:${replaceValuesWithCountAtDepthAndStringify(2, data)}}`);
        }
      );
    },
    // Merge the caller's optional  'options.variables' function with normalizeProps
    apolloConfig => {
      return R.when(
        () => normalizeProps,
        apolloConfig => {
          return composeFuncAtPathIntoApolloConfig(
            apolloConfig,
            'options.variables',
            normalizeProps
          );
        }
      )(apolloConfig);
    }
  )(apolloConfig);
};
/**
 * Creates a query task for any type
 * @param {Object} apolloConfig The Apollo configuration with either an ApolloClient for server work or an
 * Apollo wrapped Component for browser work
 * @param {Object} apolloConfig.apolloClient Optional Apollo client, authenticated for most calls
 * @param {Object} apolloConfig.apolloComponent Optional Apollo component
 * @param {Function} apolloConfig.apolloComponent.options Required for ApolloComponent container queries.
 * A unary function expecting components from the parent component or container
 * @param {Object} apolloConfig.apolloComponent.options.variables Variables for the ApolloComponent container
 * @param {Object} apolloConfig.apolloComponent.options.errorPolicy Optional errorPolicy string for the ApolloComponent
 * container
 * @param {String} name The lowercase name of the object matching the query name, e.g. 'regions' for regionsQuery
 * @param {Object} readInputTypeMapper maps object keys to complex input types from the Apollo schema. Hopefully this
 * will be automatically resolved soon. E.g. {data: 'DataTypeofLocationTypeRelatedReadInputType'}
 * @param {Function} [normalizeProps] Optional function to normalize props after calling
 * apolloConfig.options.variables if defined.
 * @param {Array|Object} outputParams output parameters for the query in this style json format:
 *  [
 *    'id',
 *    {
 *        data: [
 *         'foo',
 *         {
 *            properties: [
 *             'type',
 *            ]
 *         },
 *         'bar',
 *       ]
 *    }
 *  ]
 *
 *  In other words, start every type as a list and embed object types using {objectTypeKey: [...]}
 *  props ahead of time with the container. It should be the expected prop names and
 *  example value types (e.g. 0 for Number) TODO we could use types instead of numbers, if we can figure out a type
 *  to identify primitives
 *  @param {Object} props. The props for the query or an Apollo container that will supply the props
 *  @param {Task} An apollo query task that resolves to and object with the results of the query. Successful results
 *  are in obj.data[name]. Errors are in obj.errors. Since the queries are stored in data[name], multiple queries
 *  of different could be merged together into the data field. This also matches what Apollo components expect.
 *  If you need the value in a Result.Ok or Result.Error to halt operations on error, use requestHelpers.mapQueryContainerToNamedResultAndInputs
 */
export const makeQueryContainer = v(R.curry(
  (apolloConfig,
   {name, readInputTypeMapper, outputParams, normalizeProps},
   props
  ) => {
    // Limits the arguments the query uses based on apolloConfig.options.variables(props) if specified
    const nameTitle = R.compose(capitalize, singularize)(name);
    const readInputTypeMapperOrDefault = R.defaultTo(
      {
        'data': `${nameTitle}DataTypeof${nameTitle}TypeRelatedReadInputType`
      },
      readInputTypeMapper
    );

    // See if the query is ready to run
    const skip = strPathOr(false, 'options.skip', apolloConfig);
    // If not skip, process the props
    const winnowedProps = R.ifElse(
      () => skip,
      () => ({}),
      props => R.compose(
        // Normalize the props if needed. This removes top-level key/values that might be in the object that
        // aren't expected/needed by the API
        props => {
          return (normalizeProps || R.identity)(props);
        },
        props => {
          // Use apolloConfig.options.variables function to filter if specified.
          // This extracts the needed props for the query
          return _winnowRequestProps(apolloConfig, props);
        }
      )(props)
    )(props);
    const query = gql`${makeQuery(
      name, 
      readInputTypeMapperOrDefault, 
      outputParams, 
      winnowedProps
    )}`;
    // Compose in options.variables: normalizeProps and compose in a debug onSuccess and onError log message
    const modifiedApolloConfig = modifyApolloConfigFuncsForQuery(apolloConfig, {
      normalizeProps,
      query,
      skip,
      winnowedProps
    });
    const componentOrTask = authApolloQueryContainer(
      modifiedApolloConfig,
      query,
      // Non-winnowed props because the component does calls its options.variables function
      props
    );
    /*
    TODO how do we log only when the query is actually run? Is there something on the Query component we can use?
    log.debug(`Creating Query:\n${
      print(query)
    }\nArguments:\n${
      R.ifElse(
        () => skip,
        () => 'Props are not ready',
        (winnowedProps) => JSON.stringify(winnowedProps)
      )(winnowedProps)
    }\n`);
     */
    return R.when(
      componentOrTask => 'run' in componentOrTask,
      // If it's a task report the result. Components have to run their query
      componentOrTask => {
        log.debug(`makeQueryContainer Attempting query task:\n${
          print(query)
        }\nArguments:\n${
          inspect(winnowedProps, false, 10)
        }\n`);
        return R.map(
          queryResponse => {
            log.debug(`makeQueryContainer for ${name} succeeded with response: ${replaceValuesWithCountAtDepthAndStringify(2, queryResponse)}`);
            return queryResponse;
          },
          componentOrTask
        );
      }
    )(componentOrTask);
  }),
  [
    ['apolloConfig', PropTypes.shape().isRequired],
    ['queryOptions', PropTypes.shape({
      name: PropTypes.string.isRequired,
      readInputTypeMapper: PropTypes.shape(),
      outputParams: PropTypes.oneOfType([
        PropTypes.array,
        PropTypes.shape()
      ]).isRequired
    })],
    ['props', PropTypes.shape().isRequired]
  ], 'makeQueryContainer'
);

/**
 *
 * Use given props to call the function at requests.arg.options, and then get the .variables of the returned value
 * @param {Function} apolloComponent Expects props and returns an Apollo Component
 * @param {Object} props
 * @returns {Object} variables to use for the query
 */
export const createRequestVariables = (apolloComponent, props) => {
  return reqStrPathThrowing('props.variables', apolloComponent(props));
};


/**
 * Runs the apollo queries in queryComponents as tasks if runContainerQueries is true. If true,
 * resolvedPropsTask are resolved and set to the queries. props are also returned independent of the queries
 * If runContainerQueries is false, just resolves resolvedPropsTask and return the props
 * @param {Object} apolloConfig The apolloConfig
 * @param {Object} config
 * @param {String} config.containerName For debugging only. Labels the container with this name
 * @param {Function} config.resolvedPropsContainer A no-arg function that returns a task that resolves the props
 * or for component queries, a function that returns the props
 * @param {Object} config.queryContainers Keyed by name, valued by a queryTask that expects the props.
 * Each queryTask resolves to a response. Responses are combined and keyed by the name
 * The responses are combined
 * @param {boolean} [config.runContainerQueries] Default true. When true run the container queries
 * @param {Object} props
 * @param {Function} props.render
 * @return {Task|Function} A task or component function that resolves to the props of resolvedPropsTask merged with the query results if there
 * are any queries and runContainerQueries is true
 */
export const apolloQueryResponsesContainer = (
  apolloConfig,
  {
    containerName='apolloQueryResponsesContainer',
    resolvedPropsContainer,
    queryContainers,
    runContainerQueries = true
  },
  {render}
) => {
  return composeWithComponentMaybeOrTaskChain([
    // Wait for all the queries to finish
    nameComponent(containerName, props => {
      const queryContainersOrNone = runContainerQueries && queryContainers ? queryContainers : {};
      // Each query resolves and the values are assigned to the key and merged with the props
      // This is similar to how react-adopt calls our Apollo request components
      return composeWithComponentMaybeOrTaskChain([
          ...R.reverse(
            mapObjToValues(
              (container, key) => {
                return mapTaskOrComponentToNamedResponseAndInputs(apolloConfig, key,
                  props => container(props)
                );
              },
              queryContainersOrNone
            )
          ),
          // Just resolve to the props if there are no query containers
          props => containerForApolloType(
            apolloConfig,
            {
              render: getRenderPropFunction(props),
              response: props
            }
          )
        ]
      )(props);
    }),
    // Resolve the props the container
    () => {
      return resolvedPropsContainer(apolloConfig, {render});
    }
  ])({render});
};

/**
 * Modifies apolloConfig's 'options.variables', 'onComplete', 'onError', or other function, composing the given
 * func with any existing one. Useful when a caller and the underlying call each have a function that need to be
 * @param {Object} apolloConfig The apolloConfig
 * @param {String} strPath dot-separated path relative to apolloConfig
 * @param {Function} func Expects props and returns filtered props
 * @returns {*}
 */
export const composeFuncAtPathIntoApolloConfig = (apolloConfig, strPath, func) => {
  return R.over(
    R.lensPath(R.split('.', strPath)),
    variables => {
      return props => R.compose(
        props => func(props),
        props => R.when(() => R.is(Function, variables), variables)(props)
      )(props);
    },
    apolloConfig
  );
};

/**
 * For combining various booleans at 'options.skip' so that if any is true skip is true
 * @param apolloConfig
 * @param strPath
 * @param value
 * @returns {*}
 */
export const logicalOrValueAtPathIntoApolloConfig = (apolloConfig, strPath, value) => {
  return R.over(
    R.lensPath(R.split('.', strPath)),
    existingValue => R.or(existingValue, value),
    apolloConfig
  )
}

