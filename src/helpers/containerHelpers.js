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

import T from 'folktale/concurrency/task/index.js';

const {of} = T;
import * as R from 'ramda';
import {compact, compactEmpty, reqStrPathThrowing} from '@rescapes/ramda';
import {composeWithComponentMaybeOrTaskChain, getRenderPropFunction} from './componentHelpersMonadic';

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
  // If 0 count or items return an empty array
  if (count === 0 || R.length(items) === 0) {
    return []
  }
  if (!count && !items) {
    throw new Error('Neither count nor items was given');
  }
  return composeWithComponentMaybeOrTaskChain(
    R.prepend(
      ({objects}) => {
        return containerForApolloType(
          apolloConfig,
          {
            render: getRenderPropFunction(props),
            response: objects
          }
        );
      },
      R.flatten(R.times(i => {
          // If count is defined we pass i+1 to the propVariationFunc as 'item'. Else pass current item as 'item'
          const item = count ? R.add(1, i) : items[i];
          return [
            objects => {
              return containerForApolloType(
                apolloConfig,
                {
                  render: getRenderPropFunction(props),
                  response: {objects}
                }
              );
            },
            ({objects}) => {
              return composeWithComponentMaybeOrTaskChain([
                response => {
                  return containerForApolloType(
                    apolloConfig,
                    {
                      render: getRenderPropFunction(props),
                      response: R.concat(objects, [reqStrPathThrowing(responsePath, response)])
                    }
                  );
                },
                props => {
                  return mutationContainer(
                    apolloConfig,
                    compact({outputParams, name}),
                    // Pass count to the propVariationFunc so it can be used, but don't let it through to the
                    // actual mutatino props
                    R.omit(['item'], propVariationFunc(R.merge(props, {item})))
                  );
                }
              ])(props);
            }
          ];
        },
        // Use count or the length of items. We mutate this many times
        count ? count : R.length(items)
        )
      )
    )
  )(R.merge({objects: []}, props));
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
export const mapTaskOrComponentToNamedResponseAndInputs = (apolloConfig, name, componentOrTaskFunc) => args => {
  return composeWithComponentMaybeOrTaskChain([
    response => {
      return containerForApolloType(
        apolloConfig,
        {
          render: getRenderPropFunction(args),
          response: R.merge(args, {[name]: response})
        }
      );
    },
    args => {
      return componentOrTaskFunc(args);
    }
  ])(args);
};