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

import moment from 'moment';
import RT from 'react';
import T from 'folktale/concurrency/task/index.js';
import * as R from 'ramda';
import {
  camelCase,
  capitalize,
  compact,
  duplicateKey,
  reqStrPathThrowing,
  strPathOr,
  toArrayIfNot
} from '@rescapes/ramda';
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
      if (render === response.render) {
        // Don't pass the above render prop through if the response.render is the same,
        // it means we at the end of a composition of components and the render function is
        // being applied, so we don't want to pass it as props again and risk calling it lower down
        // in the component tree
        return render(R.omit(['render'], response))
      }
      else {
        // If it's not the same pass it through since it is being used later in a composition of components.
        // It's currently required to pass render to ever component in a composition so that we know
        // that we are using Apollo components, not Tasks/Apollo Client
        return render(response);
      }
    }
  )(responseAndOptionalRender);
});

/**
 * Calls a mutationRequestContainer and then mutates once with the response and waits for the
 * mutation response. The mutationRequestContainer can return a single mutation response or multiple
 * (multiple if for instance using mutationRequestContainer)
 * @param {Object} apolloConfig The apolloConfig. Add options.variables if the mutation request needs
 * to limit the variables from props
 * @param {Object} options
 * @param {Object} [options.outputParams] Output params for the mutation request. May not be required
 * if defaults are built into the particular request
 * @param {String} options.responsePath Dot-separated return path for the mutate response, such as
 * 'result.data.mutateRegion.region'
 * @param {Function} mutationRequestContainer that expects apolloConfig, {outputParams}, props and returns
 * a task or apollo container that does what is described above
 * @param {Object} props Props for the mutation. Must contain a render prop for component calls
 * so that something can be done with the mutate response.
 * @returns {Task|Object} Task or apollo container that does what is described above
 */
export const mutationRequestWithMutateOnceAndWaitContainer = (apolloConfig, {
  outputParams,
  responsePath
}, mutationRequestContainer, props) => {
  return composeWithComponentMaybeOrTaskChain([
    mutationResponses => {
      return mutateOnceAndWaitContainer(
        apolloConfig,
        {responsePath},
        mutationResponses,
        R.propOr(null, 'render', props)
      );
    },
    props => {
      return mutationRequestContainer(apolloConfig, {outputParams}, props);
    }
  ])(props);
};

/**
 * Calls mutation on each this.props.responses that has a mutation function. Using this instead of effects
 * because this component is conditionally rendered, which messes up hooks/effects (sigh)
 */
class MutateResponsesOnce extends React.Component {
  constructor(props) {
    super(props);
    this.state = {mutatedOnce: false}
  }

  render() {
    // See if our responses are loaded (not relevant for tasks, only components)
    const objects = compact(
      R.map(response => {
        return R.compose(
          response => responsePath ? strPathOr(null, responsePath, response) : response,
          response => addMutateKeyToMutationResponse(
            {silent: true},
            response
          )
        )(response);
      }, this.props.responses)
    );

    // If not, wait
    if (R.length(objects) !== R.length(this.props.responses)) {
      return nameComponent('mutateOnceAndWaitContainer', e('div', {}, 'loading'));
    }

    // Do only once
    if (!this.state.mutatedOnce) {
      R.forEach(
        response => {
          // If the response does not have a mutation, it indicates that the response does not need to call
          // mutation because it represents data that has already been created. TODO this could cause
          // problems if response lacks mutation by accident
          if (R.has('mutation', response)) {
            response.mutation();
          }
        },
        this.props.responses
      );
      // Once we've iterated through our responses and called mutate, don't do it again
      this.state.setState({mutatedOnce: true})
    }

    // Make objects singular if mutationResponses was
    return getRenderPropFunction({render: this.props.render})({
      objects: R.ifElse(Array.isArray, () => objects, () => R.head(objects))(this.mutationResponses)
    });
  }
}
/**
 * Container to call mutate on mount for each mutationResponse. The container
 * then returns an empty div until the mutations have completed. For client queries
 * the mutation will have already happened so it returns a task that resolves
 * to the mutation responses. If a mutationResponse in mutationResponses, doesn't have a mutation method,
 * it is taken to mean that an existing item was found and that item doesn't need to call mutation
 * @param apolloConfig
 * @param {Object} options
 * @param {String} options.responsePath The stringPath into the mutation responses
 * of that object being mutated.
 * @param {Object|[Object]} mutationResponses A single or multiple mutation responses
 * to call the mutation function of once on mount
 * @param {Function} render The render prop
 * @returns {Object|Task} The div component when loading or a component
 * with the mutation response or responses. For client mutations resolves to the mutation responses
 */
export const mutateOnceAndWaitContainer = (apolloConfig, {responsePath}, mutationResponses, render = null) => {
  const responses = toArrayIfNot(mutationResponses);
  return containerForApolloType(
    apolloConfig,
    {
      render: (responses) => {

        /*
        // This code causes erros because hooks can't stand conditional rendering
        useEffect(() => {
          // code to run on component mount
          R.forEach(
            response => {
              // If the response does not have a mutation, it indicates that the response does not need to call
              // mutation because it represents data that has already been created. TODO this could cause
              // problems if response lacks mutation by accident
              if (R.has('mutation', response)) {
                response.mutation();
              }
            },
            responses
          );
        }, []);
         */
        // Calls each responses' mutation function once and only once
        return e(MutateResponsesOnce, {responses, mutationResponses, render})
      },
      // For component queries, pass the full response so render can wait until they are loaded
      // client calls access the objects from the responses
      response: R.propOr(false, 'apolloClient', apolloConfig) ?
        R.compose(
          objects => R.ifElse(Array.isArray, () => objects, () => R.head(objects))(mutationResponses),
          responses => R.map(reqStrPathThrowing(responsePath), responses)
        )(responses) :
        responses
    }
  );
};

/**
 * @param {Object} apolloConfig
 * @param {Object} options
 * @param {String} options.queryResponsePath Path into existingItemResponses to get objects to delete
 * @param {Boolean} options.forceDelete Default true. If true and there are existingItemResponses delete, otherwise
 * return any empty response to indicate that nothing was deleted
 * @param {Function} options.mutationContainer The apollo mutation request function to call on each item
 * to update it to deleted
 * @param {String} options.responsePath The path to the deleted item once the mutation is called. The deleted
 * items are returned in the response, not the deleted item responses
 * @param {Function} [options.propVariationFuncForDeleted] Called on each item to modify it with values that
 * will indicate that it is now deleted, namely deleted. Default is
 * ({item: {id}}) => {
      return {id, deleted: moment().toISOString(true)}
    }
 * @param {Object} [options.outputParams] Output parameters for the mutationContainer, defaults to {id: 1, deleted: 1}
 * @param {String} [options.name] if defined, this is passed to the request as the second argument along with
 * the outputParams to each mutation call
 * @param {Object} props
 * @param {[Object]} props.existingItemResponses
 * @param {Object} props.render
 * @returns {[Object]} The list of deleted objects in the resolved task or component response
 */
export const deleteItemsOfExistingResponses = (
  apolloConfig, {
    queryResponsePath,
    forceDelete = true,
    mutationContainer,
    responsePath,
    propVariationFuncForDeleted = ({item: {id}}) => {
      return {id, deleted: moment().toISOString(true)};
    },
    outputParams = {id: 1, deleted: 1},
    name
  },
  {existingItemResponses, render}
) => {
  const items = queryResponsePath ? strPathOr([], queryResponsePath, existingItemResponses) : [];
  return forceDelete && R.length(items) ?
    // Recurse to use callMutationNTimesAndConcatResponses to delete existing instances
    callMutationNTimesAndConcatResponses(
      apolloConfig,
      {
        items,
        mutationContainer,
        responsePath,
        propVariationFunc: propVariationFuncForDeleted,
        outputParams,
        name
      },
      {render}) :
    containerForApolloType(
      apolloConfig,
      {
        render,
        response: {objects: []}
      }
    );
};

/**
 * Call the given container count times and concat the responses at the response path
 * @param {Object} apolloConfig
 * @param {Object} options
 * @param {Number} [options.count] Number of times to call mutationContainer. The current 1-based count
 * is passed to propVariationFunc as prop 'item' = 1,2,...
 * @param {[Object]} [options.items] Pass items to be passed to propVariationFunc for each call instead
 * @param {Boolean} [options.forceDelete] Default false, If true delete instances matching existingMatchingProps
 * @param {Object} [options.existingMatchingProps] If forceDelete is true this must be defined. Otherwise
 * this is used to look for existing items to use instead of creating new ones if forceDelete is false
 * to provide params to delete instances, such as {keysIn: [...], user: {id: x}}
 * of using options.count. Used for updates and deletion. Item is passed as prop 'item' = Object1, Object2, ...
 * @param {Task|Function} options.queryForExistingContainer Container that uses existingMatchingProps to find
 * instances to delete with mutationContainer or instances to use instead of creating new instances
 * @param {Function} options.existingItemMatch Used to match an existing item with and item from items
 * @param {Function} [options.propVariationFuncForDeleted] the props needed to delete the items from queryForExistingContainer,
 * Defaullts to ({item}) => ({id: item.id, deleted: moment().toISOString(true)}
 * @param {String} [options.queryResponsePath] Required if forceDelete is true to get the items from the respnose of queryForExistingContainer
 * @param {Function} options.mutationContainer Apollo mutation request to run count times
 * @param {Function} options.propVariationFunc Function receiving props and with a 1-based count proped merged in
 * returns an object that is the props to use for the container request
 * @param {Object} [options.outputParams] Defaults to null, mutation output params
 * @param {String} [options.name] if defined, this is passed to the request as the second argument along with
 * the outputParams
 * @param {String} options.responsePath e.g. 'result.data.mutate.location'
 * @param {Object} props
 * @param {Function} props.render Required for component calls, the render function to render the children
 * of this component
 * @returns {any}
 */
export const callMutationNTimesAndConcatResponses = (
  apolloConfig,
  {
    count,
    items,
    forceDelete = false,
    existingMatchingProps,
    existingItemMatch,
    queryForExistingContainer,
    queryResponsePath,
    propVariationFuncForDeleted = ({item: {id}}) => {
      return {id, deleted: moment().toISOString(true)};
    },
    mutationContainer,
    responsePath,
    propVariationFunc,
    outputParams,
    name
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
        response: {objects: []}
      }
    );
  }
  return composeWithComponentMaybeOrTaskChain([
      nameComponent(`callMutationNTimesAndConcatResponses${componentName}`, ({existingItemResponses, responses, render}) => {
        return mutateOnceAndWaitContainer(apolloConfig, {responsePath}, responses, render);
      }),
      ...R.reverse(R.times(i => {
          // If count is defined we pass i+1 to the propVariationFunc as 'item'. Else pass current item as 'item'
          const item = count ? R.add(1, i) : items[i];
          return mapTaskOrComponentToConcattedNamedResponseAndInputs(apolloConfig, 'responses',
            ({existingItemResponses, deletedItems, ...props}) => {
              if (R.prop('loading', existingItemResponses)) {
                // For component requests, return loading until existingItems finish loading
                return nameComponent('callMutationNTimesAndConcatResponses', e('div', {}, 'loading'));
              }

              // If we didn't force delete and we have an existing item, use it
              const existingItem = !forceDelete &&
                queryResponsePath &&
                existingItemMatch(item, reqStrPathThrowing(queryResponsePath, existingItemResponses));
              if (existingItem) {
                return containerForApolloType(
                  apolloConfig,
                  {
                    render: getRenderPropFunction(props),
                    response: R.set(R.lensPath(R.split('.', responsePath)), existingItem, {})
                  }
                );
              }
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
      )),
      mapTaskOrComponentToNamedResponseAndInputs(apolloConfig, 'deletedItems',
        nameComponent(`deletedInstances`,
          ({existingItemResponses, render}) => {
            return deleteItemsOfExistingResponses(
              apolloConfig, {
                queryResponsePath,
                forceDelete,
                mutationContainer,
                responsePath,
                propVariationFuncForDeleted,
                outputParams,
                name
              },
              {existingItemResponses, render}
            );
          })
      ),
      mapTaskOrComponentToNamedResponseAndInputs(apolloConfig, 'existingItemResponses',
        nameComponent(`queryExistingItems`, ({responses, render}) => {
          return queryForExistingContainer ?
            queryForExistingContainer(
              apolloConfig,
              {outputParams: outputParams || {id: true}},
              R.merge(existingMatchingProps, {render})
            ) :
            containerForApolloType(
              apolloConfig,
              {
                render,
                response: {objects: []}
              }
            );
        })
      )
    ]
  )(props);
};


/**
 * Like mapToMergedResponse but supports apollo component chaining using composeWithComponentMaybeOrTaskChain
 * @param {Object} apolloConfig
 * @param {Object} [apolloConfig.apolloClient[ Required to indicate tasks
 * @param {Function} componentOrTaskFunc Function accepting args and returning an task or apollo component response
 * @param {Object} args Props/Response from the previous function in the chain
 * @returns {Object|Task} Component response or task resolving to response object merged with the input args.
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
 *
 * If the response only has a property objects, it indicates that the desired response for
 * key name is an array, so return response.objects here and it will be assigned a key
 * by mapTaskOrComponentToNamedResponseAndInputs
 * @param response
 * @returns {[]|*}
 * @private
 */
const _convertObjectsResponseToArray = response => {
  const _responseWithoutRender = R.omit(['render', 'children'], response);
  return R.equals(1, R.length(R.keys(_responseWithoutRender))) &&
  R.has('objects', _responseWithoutRender) ?
    response.objects : response;
};

/**
 * Like mapToNamedResponse but supports apollo component chaining using composeWithComponentMaybeOrTaskChain
 * @param {Object} apolloConfig
 * @param {Object} [apolloConfig.apolloClient[ Required to indicate tasks
 * @param {String} name The object key to merge with args
 * @param {Function} componentOrTaskFunc Function accepting args and returning an task or apollo component response
 * @param {Object} args Props/Response from the previous function in the chain
 * @returns {Object|Task} Component response or task resolving to response, where the response is assigned
 * to the key named and merged with the inputs. If the response is {objects: [], [render]} it
 * will be converted to [] before being assigned to the name key. This allows returning an empty array when we know
 * the value is going to be assigned to the key name and merged with the other input key/values. A response can't
 * be an array initially because the response must be merged with the render prop
 */
export const mapTaskOrComponentToNamedResponseAndInputs = (apolloConfig, name, componentOrTaskFunc) => {
  return nameComponent(`${name}`, args => {
    return composeWithComponentMaybeOrTaskChain([
      nameComponent(`${name}`, response => {
        const _response = _convertObjectsResponseToArray(response);
        // Name the container after name since we don't have anything better
        return containerForApolloType(
          apolloConfig,
          {
            render: getRenderPropFunction(args),
            response: R.merge(args, {[name]: _response})
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
 * @returns {Object|Task} Component response or task resolving to response, where the response values are assigned
 * to name and merged with the inputs.
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
  // If skipped there is no mutation response to process
  if (R.propOr(false, 'skip', response)) {
    return response;
  }
  // Find the response.data.[key] where key starts with update or create.
  // Otherwise take the one and only key in data.response (e.g. tokenAuth)
  const createOrUpdateKey = R.find(
    key => R.find(verb => R.startsWith(verb, key), ['create', 'update']),
    R.keys(strPathOr({}, 'result.data', response))
  );
  return R.ifElse(
    () => {
      return createOrUpdateKey;
    },
    response => {
      const updated = duplicateKey(R.lensPath(['result', 'data']), createOrUpdateKey, ['mutate'], response);
      const name = R.head(R.keys(updated.result.data.mutate));
      const obj = strPathOr(null, `result.data.mutate.${name}`, updated);
      // Copy the return value at create... or update... to mutate
      const deleted = R.when(R.identity, () => '(DELETE)')(strPathOr('', 'deleted', obj));
      if (!silent) {
        log.debug(`Mutation ${deleted} ${createOrUpdateKey} succeeded and returned id ${
          reqStrPathThrowing(`result.data.mutate.${name}.id`, updated)
        } for type ${
          reqStrPathThrowing(`result.data.mutate.${name}.__typename`, updated)
        }`);
      }
      return updated;
    },
    response => {
      if (!silent && !R.length(R.keys(strPathOr({}, 'result.data', response)))) {
        log.error('Mutation response is null for mutation');
      }
      return response;
    }
  )(response);
};


