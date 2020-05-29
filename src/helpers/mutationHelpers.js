/**
 * Created by Andy Likuski on 2018.07.02
 * Copyright (c) 2018 Andy Likuski
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 */
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
import {_winnowRequestProps, formatOutputParams, omitClientFields} from './requestHelpers';
import {authApolloClientMutationRequestContainer, authApolloComponentMutationContainer} from '../client/apolloClient';
import {
  capitalize, composeWithMapMDeep,
  mapObjToValues,
  omitDeepBy,
  retryTask,
  duplicateKey, reqStrPathThrowing, composeWithChain
} from 'rescape-ramda';
import {gql} from '@apollo/client';
import {print} from 'graphql';
import {v} from 'rescape-validate';
import PropTypes from 'prop-types';
import {loggers} from 'rescape-log';

const log = loggers.get('rescapeDefault');

/**
 * Makes the location query based on the queryParams
 * @param {String} queryName
 * @param {Object} variablesAndTypes: Keyed by the variable name and valued by the variable type
 * graphql, then translated here to a graphql string
 * @param {Array|Object} outputParams
 */
export const makeMutation = R.curry((mutationName, variablesAndTypes, outputParams) => {
  const variableString = R.join(', ', mapObjToValues((type, name) => `$${name}: ${type}!`, variablesAndTypes));
  const variableMappingString = R.join(', ', mapObjToValues((type, name) => `${name}: $${name}`, variablesAndTypes));
  return `mutation ${mutationName}Mutation(${variableString}) { 
${mutationName}(${variableMappingString}) {
  ${formatOutputParams(outputParams)}
  }
}`;
});


/**
 * Makes a mutation task
 * @param {Object} apolloConfig The Apollo configuration with either an ApolloClient for server work or an
 * Apollo wrapped Component for browser work
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
 *  @param {String} mutationOptions.variableNameOverride
 *  @param {String} mutationOptions.variableTypeOverride
 *  @param {String} mutationNameOverride
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
     variableNameOverride = null, variableTypeOverride = null, mutationNameOverride = null
   },
   props) => {
    // Get the variable definition, arguments and outputParams
    const {variablesAndTypes, variableName, namedProps, namedOutputParams, crud} = mutationParts(
      apolloConfig,
      {name, outputParams: omitClientFields(outputParams), variableTypeOverride, variableNameOverride},
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
      log.error(`Unable to create mutation with the following properties: ${JSON.stringify({
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

    log.debug(`Creating Mutation:\n\n${print(mutation)}\nArguments:\n${JSON.stringify(namedProps)}\n\n`);

    return R.cond([
      // If we have an ApolloClient
      [apolloConfig => R.has('apolloClient', apolloConfig),
        apolloConfig => {
          return composeWithMapMDeep(1, [
            response => {
              return addMutateKeyToMutationResponse({name}, response);
            },
            () => {
              return retryTask(
                authApolloClientMutationRequestContainer(
                  apolloConfig,
                  {
                    mutation,
                    name,
                    variableName
                  },
                  namedProps
                ), 3
              );
            }
          ])();
        }
      ],
      // If we have an Apollo Component
      [R.T,
        // Since we're using a component unwrap the Just to get the underlying wrapped component for Apollo/React to use
        // Above we're using an Apollo client so we have a task and leave to the caller to run
        () => {
          return R.chain(
            component => {
              return component
              // TODO do we have to do this in the HOC?
              //return addMutateKeyToMutationResponse({name}, response);
            },
            authApolloComponentMutationContainer(
              apolloConfig,
              mutation,
              // Allow render through along with the namedProps
              R.merge(R.pick(['render'], props), namedProps)
            )
          );
        }
      ]
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
      if (!silent) {
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
 * @param {String} variableTypeOverride Used to override the variable type, normally it's (Update|Create){Name}InputType
 * @param {String} variableNameOverride Override the variableName, normally {name}Data
 * @param {Object} props Just used to determin if an update or create is needed by reading props.id. Passing just {id: true}
 * will force and update
 * @return {{variablesAndTypes: {}, variableName: *, namedOutputParams: *, namedProps: *, crud: *}}
 */
export const mutationParts = (
  apolloConfig, {
    name,
    outputParams,
    variableTypeOverride,
    variableNameOverride
  },
  props
) => {
  // Limits the props with apolloConfig.options.variables if specified
  // This keeps extra variables out of the mutation when we are composing queries/mutations
  const winnowedProps = _winnowRequestProps(apolloConfig, props);
  // Determine crud type from the presence of the id in the props
  const crud = R.ifElse(R.has('id'), R.always('update'), R.always('create'))(winnowedProps);
  // Create|Update[Model Name]InputType]
  const variableName = R.when(R.isNil, () => `${name}Data`)(variableNameOverride);
  // The default variable type is the name of the type given + InputType
  // We only expect mutations to have one input prop, the entire object being created or updated
  const variableType = R.when(R.isNil, () => `${capitalize(crud)}${capitalize(name)}InputType`)(variableTypeOverride);
  const variablesAndTypes = {[variableName]: variableType};
  // In most cases, our outputParams are {[name]: outputParams} and props are {[variableNames]: props} to match the
  // name of the object class being mutated. If we don't specify name an instead use the overrides,
  // we don't need name here
  const namedOutputParams = R.ifElse(R.isNil, R.always(outputParams), name => ({[name]: outputParams}))(name);

  const namedProps = R.ifElse(
    R.isNil,
    R.always(winnowedProps),
    () => ({[variableName]: winnowedProps})
  )(name);
  // Filter out anything that begins with a _. This can happen if we are mutating with data we got back
  // from a query or other mutation
  const filteredNamedProps = omitDeepBy(R.startsWith('_'), namedProps);

  return {variablesAndTypes, variableName, namedOutputParams, namedProps: filteredNamedProps, crud};
};


/**
 * Runs the apollo mutations in mutationComponents
 * @param apolloConfigTask
 * @param resolvedPropsTask
 * @param {Function } apolloConfigToMutationTasks Expects an apolloConfig and returns and object keyed by mutation
 * name and valued by mutation tasks
 * @return {Task<[Object]>} A task resolving to a list of the mutation responses
 * @private
 */
export const apolloMutationResponsesTask = ({apolloConfigTask, resolvedPropsTask}, apolloConfigToMutationTasks) => {
  // Task Object -> Task
  return composeWithChain([
    // Wait for all the mutations to finish
    ({apolloConfigToMutationTasks, props, apolloClient}) => {
      return waitAll(
        mapObjToValues(
          mutation => {
            // Create variables for the current queryComponent by sending props to its configuration
            const propsWithRender = R.merge(
              props, {
                // Normally render is a container's render function that receives the apollo request results
                // and pass is as props to a child container
                render: props => null
              }
            );
            const mutationVariables = createRequestVariables(mutation, propsWithRender);
            log.debug(JSON.stringify(mutationVariables));
            const task = fromPromised(
              () => {
                return apolloClient.mutate({
                  mutation: reqStrPathThrowing('props.mutation', mutation(propsWithRender)),
                  // queryVariables are called with props to give us the variables for our mutation. This is just like Apollo
                  // does, accepting props to allow the container to form the variables for the mutation
                  variables: mutationVariables
                });
              }
            )();
            return task;
          },
          apolloConfigToMutationTasks({apolloClient})
        )
      );
    },
    // Resolve the apolloConfigTask
    mapToMergedResponseAndInputs(
      ({}) => {
        return apolloConfigTask;
      }
    ),
    // Resolve the props from the task
    mapToNamedResponseAndInputs('props',
      () => {
        return resolvedPropsTask;
      }
    )
  ])({apolloConfigTask, resolvedPropsTask, apolloConfigToMutationTasks});
};