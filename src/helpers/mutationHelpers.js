/**
 * Created by Andy Likuski on 2018.07.02
 * Copyright (c) 2018 Andy Likuski
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the 'Software'), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED 'AS IS', WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 */

import {inspect} from 'util';
import * as R from 'ramda';
import {
  _winnowRequestProps,
  formatOutputParams,
  omitClientFields,
  resolveGraphQLType,
  VERSION_PROPS
} from './requestHelpers.js';
import {
  authApolloClientMutationRequestContainer,
  authApolloComponentMutationContainer
} from '../client/apolloClient.js';
import {
  capitalize,
  composeWithMapMDeep,
  duplicateKey,
  filterWithKeys, findOne,
  mapObjToValues,
  omitDeepBy, onlyOne, onlyOneThrowing, onlyOneValueThrowing,
  reqStrPathThrowing,
  retryTask
} from '@rescapes/ramda';
import * as AC from '@apollo/client';
import {defaultNode} from './utilityHelpers.js';

const {gql} = defaultNode(AC);
import {print} from 'graphql';
import {v} from '@rescapes/validate';
import PropTypes from 'prop-types';
import {loggers} from '@rescapes/log';

const log = loggers.get('rescapeDefault');

/**
 * Filters put the props whose keys match version props
 * @param props
 * @return {*}
 */
export const filterOutReadOnlyVersionProps = props => {
  const excludeKeys = k => R.complement(R.includes)(k, VERSION_PROPS);
  return filterWithKeys((v, k) => excludeKeys(k), props);
};

/**
 * Removed deleted prop if it is nil. We only want to pass it when it is set to a date,
 * indicating a delete is occuring
 * @param {Object} props The mutation props
 * @return {Object} Modified props with deleted=null, removed
 */
export const filterOutNullDeleteProps = props => {
  return filterWithKeys((v, k) => R.complement(R.and)(
    R.equals('deleted', k),
    R.isNil(v)
  ), props);
};


/**
 * Makes the location query based on the queryParams
 * @param {String} queryName
 * @param {Object} variablesAndTypes: Keyed by the variable name and valued by the variable type
 * graphql, then translated here to a graphql string
 * @param {Array|Object} outputParams
 */
export const makeMutation = R.curry((mutationName, variablesAndTypes, outputParams) => {
  const variableString = R.compose(
    str => R.when(R.length, str => `(${str})`)(str),
    variableStrings => R.join(', ', variableStrings),
    variablesAndTypes => mapObjToValues((type, name) => `$${name}: ${type}!`, variablesAndTypes)
  )(variablesAndTypes);
  const variableMappingString = R.compose(
    str => R.when(R.length, str => `(${str})`)(str),
    variableStrings => R.join(', ', variableStrings),
    variablesAndTypes => mapObjToValues((type, name) => `${name}: $${name}`, variablesAndTypes)
  )(variablesAndTypes);
  return `mutation ${mutationName}Mutation${variableString} { 
${mutationName}${variableMappingString} {
  ${formatOutputParams(outputParams)}
  }
}`;
});


/**
 * Makes a mutation task
 * @param {Object} apolloConfig The Apollo configuration with either an ApolloClient for server work or an
 * Apollo wrapped Component for browser work
 * @param {Boolean} [apolloConfig.skip] Default false, if true disable the mutation function and return
 * skip=true with the component render function along with the mutation function and result
 * @param {Object} apolloConfig.apolloClient Optional Apollo client, authenticated for most calls
 * @param {Object} apolloConfig.opts For apollo component
 * @param {Object} mutationOptions
 * @param {String} mutationOptions.name The lowercase name of the resource to mutate. E.g. 'region' for mutateRegion
 * Required unless variableNameOverride is specified
 * @param [Array|Object] mutationOptions.outputParams output parameters for the query in this style json format.
 * Note that you can pass @client directives here and they will be omitted in the mutation. That way you can
 * use the same outputParameters to create writeFragments to put client only values in the cache.
 *  ['id',
 *   {
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
 *  // The following params are only used for simple mutations where there is no complex input type:
 *  @param {Boolean} [mutationOptions.flattenVariables] Default false. Make the props listed variables, not
 *  a type
 *  @param {String} [mutationNameOverride]. Default ${crud}${capitalize(name)} Override the mutation name
 *  Creates need all required fields and updates need at minimum the id
 *  @param {Object} props The props for the mutation
 *  @return {Task|Object} A task for Apollo Client mutations or a component for Apollo component mutations
 *  The resolved value or object is {data: {create|update[capitalize(name)]: {name: {...obj...}}}} when the operation
 *  completes. For simplicity the middle key is duplicated to {data: mutate { name: {...obj...}}} sdo the caller
 *  doesn't need to know if the request was a create or update
 */
export const makeMutationRequestContainer = v(R.curry(
  (apolloConfig,
   {
     name, outputParams,
     // These are only used for simple mutations where there is no complex input type
     mutationNameOverride = null, flattenVariables = false
   },
   props) => {
    // Get the variable definition, arguments and outputParams
    const {variablesAndTypes, variableNames, namedProps, namedOutputParams, crud} = mutationParts(
      apolloConfig,
      {name, outputParams: omitClientFields(outputParams), flattenVariables},
      props
    );

    // create|update[Model Name]
    const createOrUpdateName = R.when(R.isNil, () => `${crud}${capitalize(name)}`)(mutationNameOverride);

    let mutation;
    try {
      mutation = gql`${makeMutation(
          createOrUpdateName,
          variablesAndTypes ,
          namedOutputParams
        )}`;
    } catch (e) {
      log.error(`Unable to create mutation with the following properties: ${inspect({
        createOrUpdateName,
        variablesAndTypes,
        namedOutputParams
      })}. Mutation string: ${
        makeMutation(
          createOrUpdateName,
          variablesAndTypes,
          namedOutputParams
        )
      }`);
      throw e;
    }

    return R.cond([
      // If we have an ApolloClient
      [apolloConfig => R.has('apolloClient', apolloConfig),
        apolloConfig => {
          log.debug(`Running Mutation Task:\n\n${print(mutation)}\nArguments:\n${inspect(namedProps, false, 10)}\n\n`);
          return composeWithMapMDeep(1, [
            response => {
              log.debug(`Successfully ran mutation: ${createOrUpdateName}`);
              // name is null if mutationNameOverride is used
              return addMutateKeyToMutationResponse({name}, response);
            },
            () => {
              return retryTask(
                authApolloClientMutationRequestContainer(
                  apolloConfig,
                  {
                    mutation,
                    name
                    //variableNames
                  },
                  namedProps
                ), 3
              );
            }
          ])();
        }
      ],
      // If we have an Apollo Component
      [() => R.has('render', props),
        // Since we're using a component unwrap the Just to get the underlying wrapped component for Apollo/React to use
        // Above we're using an Apollo client so we have a task and leave to the caller to run
        () => {
          log.debug(`\`Preparing Mutation Component (that can run with mutation()):\n\n${print(mutation)}\nArguments:\n${inspect(namedProps, false, 10)})}\n\n`);
          return R.chain(
            component => {
              // Remove the Just
              return component;
            },
            authApolloComponentMutationContainer(
              apolloConfig,
              mutation,
              // Allow render through along with the namedProps
              R.merge(R.pick(['render'], props), namedProps)
            )
          );
        }
      ],
      [R.T, () => {
        throw new Error(`apolloConfig doesn't have an Apollo client and props has no render function for a component query: Config: ${inspect(apolloConfig)} props: ${inspect(props, false, 10)}`);
      }]
    ])(apolloConfig);
  }),
  [
    ['apolloConfig', PropTypes.shape().isRequired],
    ['mutationOptions', PropTypes.shape({
      // Required unless variableNameOverride is specified
      name: PropTypes.string,
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
  'makeMutationRequestContainer'
);

/**
 *
 * Take whatever prop came back with data that begins with create/update and make a copy at mutate
 * It's a pain to check whether a dynamic query was a create or update when we don't care
 * @param {Object} config
 * @param {Object} [config.name] The name of the object foo in response.(update|create({Foo}.data.{foo}
 * Only used for logging. Not needed if silent if true
 * @param {Object} [config.silent] Default false. Supresses logging when updating after mutations
 * @param {Object} response has an object at response.(update|create){Foo}.data.{foo} where foo is the type name
 * @return {Object} response with duplicated mutate key
 * @private
 */
export const addMutateKeyToMutationResponse = ({name, silent}, response) => {
  // Find the response.data.[key] where key starts with update or create.
  // Otherwise take the one and only key in data.response (e.g. tokenAuth)
  const createOrUpdateKey = R.find(
    key => R.find(verb => R.startsWith(verb, key), ['create', 'update']),
    R.keys(R.propOr({}, 'data', response))
  );
  return R.ifElse(
    () => {
      return createOrUpdateKey;
    },
    response => {
      const updated = duplicateKey(R.lensProp('data'), createOrUpdateKey, ['mutate'], response);
      // Copy the return value at create... or update... to mutate
      if (!silent) {
        log.debug(`Mutation ${createOrUpdateKey} succeeded and returned id ${
          reqStrPathThrowing(`data.mutate.${name}.id`, updated)
        } for type ${
          reqStrPathThrowing(`data.mutate.${name}.__typename`, updated)
        }`);
      }
      return updated;
    },
    response => {
      if (!silent && !R.length(R.keys(R.propOr({}, 'data', response)))) {
        log.error(`Mutation response is null for mutation ${name}`);
      }
      return response;
    }
  )(response);
};

/**
 * Creates the parts needed for the mutation
 * @param {Object} apolloConfig The apolloConfig
 * @param {Object} [apolloConfig.options]
 * @param {Function|Object} [apolloConfig.options.variable] When a function, called with props to produce the variables
 * that will be used for the mutation. When an object overrides props. When undefined props is used
 * @param {String} name The name of the object type, e.g. region
 * @param {Array|Object} outputParams Output params for the mutation
 * @param {Boolean} [flattenVariables]. Default false, if true flatten the variables, don't put them
 * in an input object
 * @param {Object} props Just used to determin if an update or create is needed by reading props.id. Passing just {id: true}
 * will force and update
 * @return {{variablesAndTypes: {}, variableNames: [*], namedOutputParams: *, namedProps: *, crud: *}}
 */
export const mutationParts = (
  apolloConfig, {
    name,
    outputParams,
    flattenVariables = false
  },
  props
) => {
  // Limits the props with apolloConfig.options.variables if specified
  // This keeps extra variables out of the mutation when we are composing queries/mutations
  const winnowedProps = _winnowRequestProps(apolloConfig, props);
  // Determine crud type from the presence of the id in the props
  const crud = R.ifElse(R.has('id'), R.always('update'), R.always('create'))(winnowedProps);
  // Create|Update[Model Name]InputType]
  // If flattenVariables, then use the prop keys as variables
  const variableNames = flattenVariables ?
    R.keys(winnowedProps) :
    [`${name}Data`];

  // The default variable type is the name of the type given + InputType
  // We only expect mutations to have one input prop, the entire object being created or updated
  // If flattenVariables, then use the prop value types
  const variableTypes = flattenVariables ?
    mapObjToValues((v, k) => resolveGraphQLType({}, k, v), winnowedProps) :
    [`${capitalize(crud)}${capitalize(name)}InputType`];

  const variableValues = R.ifElse(() => flattenVariables, R.values, p => [p])(winnowedProps);
  const variablesAndTypes = R.zipObj(variableNames, variableTypes);
  const variablesAndValues = R.zipObj(variableNames, variableValues);

  // In most cases, our outputParams are {[name]: outputParams} and props are {[variableNames]: props} to match the
  // name of the object class being mutated. If we don't specify name an instead use the overrides,
  // we don't need name here
  const namedOutputParams = R.ifElse(R.isNil, R.always(outputParams), name => ({[name]: outputParams}))(name);


  // Filter out anything that begins with a _. This can happen if we are mutating with data we got back
  // from a query or other mutation
  const filteredNamedProps = omitDeepBy(R.startsWith('_'), variablesAndValues);

  return {variablesAndTypes, variableNames, namedOutputParams, namedProps: filteredNamedProps, crud};
};
