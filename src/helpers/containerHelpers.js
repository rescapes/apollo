/**
 * Created by Andy Likuski on 2019.06.05
 * Copyright (c) 2019 Andy Likuski
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 */

import RT from 'react';
import T from 'folktale/concurrency/task/index.js';
import * as R from 'ramda';
import {camelCase, capitalize, compact, duplicateKey, reqStrPathThrowing, strPathOr} from '@rescapes/ramda';
import {composeWithComponentMaybeOrTaskChain, getRenderPropFunction, nameComponent} from './componentHelpersMonadic';
import {loggers} from '@rescapes/log';
import {e} from '@rescapes/helpers-component';

const {useEffect} = RT;
const {of} = T;

const log = loggers.get('rescapeDefault');

/**
 * Returns a Task.of if we are doing an ApolloClient request.
 * For components return a component expecting a render prop that is called with obj: children => children(obj)
 * @param {Object} apolloConfig
 * @param {Object} apolloConfig.apolloClient If present then of is returned
 * @param {Object} responseAndOptionalRender
 * @param {Function} render The render function to call. Required only for components
 * @param {Object} the response. This must match the Apollo response format {loading, data, etc.}
 * @returns {Task|Function} a task that resolves to the props or a component that when called
 * finds the render props and calls that with the props
 */
export const containerForApolloType = R.curry((apolloConfig, responseAndOptionalRender) => {
  return R.ifElse(
    R.always(R.propOr(false, 'apolloClient', apolloConfig)),
    responseAndOptionalRender => {
      // If responseAndOptionalRender is {response, render}, extract response
      return of(R.when(R.has('response'), R.prop('response'))(responseAndOptionalRender));
    },
    responseAndOptionalRender => {
      const {render, response} = responseAndOptionalRender;
      return render(response);
    }
  )(responseAndOptionalRender);
});


/**
 * Call the given container count times and concat the responses at the response path
 * @param apolloConfig
 * @param {Object} config
 * @param {Number} [config.count] Number of times to call mutationContainer. The current 1-based count
 * is passed to propVariationFunc as prop 'item' = 1,2,...
 * @param {[Object]} [config.items] Pass items to be passed to propVariationFunc for each call instead
 * of using config.count. Used for updates and deletion. Item is passed as prop 'item' = Object1, Object2, ...
 * @param {Function} config.mutationContainer Apollo mutation request to run count times
 * @param {Function} config.propVariationFunc Function receiving props and with a 1-based count proped merged in
 * returns an object that is the props to use for the container request
 * @param {Object} [config.outputParams] Defaults to null, mutation output params
 * @param {String} [config.name] if defined, this is passed to the request as the second argument along with
 * the outputParams
 * @param {String} responsePath e.g. 'data.mutate.location'
 * @param props
 * @returns {any}
 */
export const callMutationNTimesAndConcatResponses = (
  apolloConfig,
  {
    count, items, mutationContainer, responsePath, propVariationFunc,
    outputParams, name
  },
  props
) => {
  if (!count && !items) {
    throw new Error('Neither count nor items was given');
  }

  const componentName = `${capitalize(camelCase(responsePath.replace('.', '_')))}Resolver`;
  const length = items ? R.length(items) : count;

  // If 0 count or items return an empty array
  if (length === 0) {
    return containerForApolloType(
      apolloConfig,
      {
        render: getRenderPropFunction(props),
        response: []
      }
    );
  }
  return composeWithComponentMaybeOrTaskChain([
      nameComponent(`callMutationNTimesAndConcatResponses${componentName}`, ({responses, render}) => {
        return containerForApolloType(
          apolloConfig,
          {
            render: responses => {
              useEffect(() => {
                // code to run on component mount
                R.forEach(
                  response => {
                    response.mutation();
                  },
                  responses
                );
              }, []);
              const objects = compact(
                R.map(response => {
                  return R.compose(
                    response => strPathOr(null, responsePath, response),
                    response => addMutateKeyToMutationResponse(
                      {silent: true},
                      response
                    )
                  )(response.result);
                }, responses)
              );
              if (R.length(objects) !== R.length(responses)) {
                return e('div', {}, 'loading');
              }
              return getRenderPropFunction({render})({objects});
            },
            // For component queries, pass the full response so render can wait until they are loaded
            // client calls access the objects from the responses
            response: R.propOr(false, 'apolloClient', apolloConfig) ?
              R.map(reqStrPathThrowing(responsePath), responses) :
              responses
          }
        );
      }),
      ...R.reverse(R.times(i => {
          // If count is defined we pass i+1 to the propVariationFunc as 'item'. Else pass current item as 'item'
          const item = count ? R.add(1, i) : items[i];
          return mapTaskOrComponentToConcattedNamedResponseAndInputs(apolloConfig, 'responses',
            props => {
              return mutationContainer(
                apolloConfig,
                compact({outputParams, name, i}),
                // Pass count to the propVariationFunc so it can be used, but don't let it through to the
                // actual mutation props
                R.omit(['item'],
                  R.merge(
                    R.pick(['render'], props),
                    propVariationFunc(R.merge(R.omit(['responses'], props), {item}))
                  )
                )
              );
            });
        },
        // Use count or the length of items. We mutate this many times
        count ? count : R.length(items)
      ))
    ]
  )(props);
};

/**
 * Like mapToMergedResponse but supports apollo component chaining using composeWithComponentMaybeOrTaskChain
 * @param {Object} apolloConfig
 * @param {Object} [apolloConfig.apolloClient[ Required to indicate tasks
 * @param {Function} componentOrTaskFunc Function accepting args and returning an task or apollo component response
 * @param {Object} args Props/Response from the previous function in the chain
 * @returns {Object|Task} Component response or task resolving to response object merged with args
 */
export const mapTaskOrComponentToMergedResponse = (apolloConfig, componentOrTaskFunc) => args => {
  return composeWithComponentMaybeOrTaskChain([
    response => {
      return containerForApolloType(
        apolloConfig,
        {
          render: getRenderPropFunction(args),
          response: R.merge(args, response)
        }
      );
    },
    args => {
      return componentOrTaskFunc(args);
    }
  ])(args);
};

/**
 * Like mapToNamedResponse but supports apollo component chaining using composeWithComponentMaybeOrTaskChain
 * @param {Object} apolloConfig
 * @param {Object} [apolloConfig.apolloClient[ Required to indicate tasks
 * @param {String} name The object key to merge with args
 * @param {Function} componentOrTaskFunc Function accepting args and returning an task or apollo component response
 * @param {Object} args Props/Response from the previous function in the chain
 * @returns {Object|Task} Component response or task resolving to response
 */
export const mapTaskOrComponentToNamedResponseAndInputs = (apolloConfig, name, componentOrTaskFunc) => {
  return nameComponent(`${name}`, args => {
    return composeWithComponentMaybeOrTaskChain([
      nameComponent(`${name}`, response => {
        // Name the container after name since we don't have anything better
        return containerForApolloType(
          apolloConfig,
          {
            render: getRenderPropFunction(args),
            response: R.merge(args, {[name]: response})
          }
        );
      }),
      args => {
        return componentOrTaskFunc(args);
      }
    ])(args);
  });
};

/**
 * Like mapTaskOrComponentToNamedResponseAndInputs but concats the response to args[name] and
 * returns it at name
 * @param apolloConfig
 * @param name
 * @param componentOrTaskFunc
 * @returns {function(*=): *}
 */
export const mapTaskOrComponentToConcattedNamedResponseAndInputs = (apolloConfig, name, componentOrTaskFunc) => {
  return nameComponent(`${name}Resolver`, args => {
    return composeWithComponentMaybeOrTaskChain([
      ({myResponse, ...rest}) => {
        // Name the container after name since we don't have anything better
        return nameComponent(`${name}Resolver`, containerForApolloType(
          apolloConfig,
          {
            render: getRenderPropFunction(args),
            response: R.over(
              R.lensProp(name),
              v => {
                return R.concat(v, [myResponse]);
              },
              rest
            )
          }
        ));
      },
      mapTaskOrComponentToNamedResponseAndInputs(apolloConfig, 'myResponse',
        args => {
          log.debug(name);
          return componentOrTaskFunc(args);
        })
    ])(R.over(R.lensProp(name), v => v || [], args));
  });
};

/**
 *
 * Take whatever prop came back with data that begins with create/update and make a copy at mutate
 * It's a pain to check whether a dynamic query was a create or update when we don't care
 * @param {Object} config
 * @param {Object} [config.silent] Default false. Supresses logging when updating after mutations
 * @param {Object} response has an object at response.(update|create){Foo}.data.{foo} where foo is the type name
 * @return {Object} response with duplicated mutate key
 * @private
 */
export const addMutateKeyToMutationResponse = ({silent}, response) => {
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
      const name = R.head(R.keys(updated.data.mutate));
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


