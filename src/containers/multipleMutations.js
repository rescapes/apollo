import {camelCase, capitalize, compact, reqStrPathThrowing, strPathOr} from "@rescapes/ramda";
import {
  containerForApolloType,
  mapTaskOrComponentToConcattedNamedResponseAndInputs,
  mapTaskOrComponentToNamedResponseAndInputs
} from "../helpers/containerHelpers";
import React from 'react';
import moment from 'moment';
import * as R from 'ramda';
import {
  composeWithComponentMaybeOrTaskChain,
  getRenderPropFunction,
  nameComponent
} from '../helpers/componentHelpersMonadic.js';
import {loggers} from '@rescapes/log';
import {e} from '../helpers/componentHelpers.js';
import {mutateOnceAndWaitContainer} from "./mutateOnceAndWait.js";

const log = loggers.get('rescapeDefault');


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
      nameComponent(`callMutationNTimesAndConcatResponses${componentName}`, ({
                                                                               existingItemResponses,
                                                                               responses,
                                                                               render
                                                                             }) => {
        if (R.any(R.prop('skip'), responses)) {
          throw new Error(`One or more mutation responses have skip=true, indicating that required properties were not supplied to the mutation(s): ${
            JSON.stringify(R.map(R.omit(['mutation']), responses))
          }`)
        }

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

