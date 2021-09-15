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

import React from 'react';
import T from 'folktale/concurrency/task/index.js';
import * as R from 'ramda';
import {duplicateKey, reqStrPathThrowing, strPathOr} from '@rescapes/ramda';
import {composeWithComponentMaybeOrTaskChain, getRenderPropFunction, nameComponent} from './componentHelpersMonadic.js';
import {loggers} from '@rescapes/log';

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
      } else {
        // If it's not the same pass it through since it is being used later in a composition of components.
        // It's currently required to pass render to ever component in a composition so that we know
        // that we are using Apollo components, not Tasks/Apollo Client
        return render(response);
      }
    }
  )(responseAndOptionalRender);
});

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
      const name = R.head(R.keys(R.omit(['__typename'], updated.result.data.mutate)));
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


