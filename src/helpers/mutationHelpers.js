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
import {formatOutputParams} from './requestHelpers';
import {authApolloClientMutationRequestContainer, authApolloComponentMutationContainer} from '../client/apolloClient';
import {
  capitalize,
  mapObjToValues
} from 'rescape-ramda';
import gql from 'graphql-tag';
import {print} from 'graphql';

/**
 * Makes the location query based on the queryParams
 * @param {String} queryName
 * @param {Object} inputParams input object for the mutation. These are in javascript in a the same format as
 * graphql, then translated here to a graphql string
 * @param {Object} outputParams
 */
export const makeMutation = R.curry((mutationName, variables, outputParams) => {
  const variableString = R.join(', ', mapObjToValues((type, name) => `$${name}: ${type}!`, variables));
  const variableMappingString = R.join(', ', mapObjToValues((type, name) => `${name}: $${name}`, variables));
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
 * @param {Object} apolloConfig.apolloComponent Optional Apollo component
 * @param {String} name The lowercase name of the resource to mutate. E.g. 'region' for mutateRegion
 * @param [String|Object] outputParams output parameters for the query in this style json format:
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
 *  @param {Object} inputParams Object matching the shape of a region. E.g.
 *  {id: 1, city: "Stavanger", data: {foo: 2}}
 *  Creates need all required fields and updates need at minimum the id
 *  @param {Function} Unary function expecting props and returning
 *  a Mutation Component or a mutation task.
 *  If mutation task containing an object with the result of the outputParams query
 *  in an obj at obj.data.name or an errors at obj.errors.
 */
export const makeMutationRequestContainer = R.curry(
  (apolloConfig,
   {
     name, outputParams,
     // These are only used for simple mutations where there is no complex input type
     variableNameOverride = null, variableTypeOverride = null, mutationNameOverride = null
   },
   component,
   props) => {
    // Determine crud type from the presence of the id in the props
    const crud = R.ifElse(R.has('id'), R.always('update'), R.always('create'))(props);
    // Create|Update[Model Name]InputType]
    const variableName = R.when(R.isNil, () => `${name}Data`)(variableNameOverride);
    const variableType = R.when(R.isNil, () => `${capitalize(crud)}${capitalize(name)}InputType`)(variableTypeOverride);
    // In most cases, our outputParams are {[name]: outputParams} and props are {[variableNames]: props} to match the
    // name of the object class being mutated. If we don't specify name an instead use the overrides,
    // we don't need name here
    const namedOutputParams = R.ifElse(R.isNil, R.always(outputParams), name => ({[name]: outputParams}))(name);
    const namedProps = R.ifElse(R.isNil, R.always(props), ()=> ({[variableName]: props}))(name);

    // create|update[Model Name]
    const createOrUpdateName = R.when(R.isNil, () => `${crud}${capitalize(name)}`)(mutationNameOverride);

    const mutation = gql`${makeMutation(
      createOrUpdateName,
      {[variableName]: variableType},
      namedOutputParams
    )}`;

    console.debug(`Mutation: ${print(mutation)} Arguments: ${JSON.stringify(namedProps)}`);

    return R.cond([
      // If we have an ApolloClient
      [apolloConfig => R.has('apolloClient', apolloConfig),
        apolloConfig => authApolloClientMutationRequestContainer(
          apolloConfig,
          {
            mutation,
            name,
            variableName
          },
          namedProps
        )
      ],
      // If we have an Apollo Component
      [() => R.not(R.isNil(component)),
        () => authApolloComponentMutationContainer(
          mutation,
          apolloConfig,
          component,
          namedProps
        )
      ]
    ])(apolloConfig);
  });
