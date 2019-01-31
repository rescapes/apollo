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
import {formatOutputParams, formatInputParams} from './requestHelpers';
import {authApolloClientMutationRequestTask, authApolloComponentMutationRequestClass} from '../client/apolloClient';
import {debug} from './logHelpers';
import {
  replaceValuesWithCountAtDepthAndStringify,
  reqStrPathThrowing,
  reqPathThrowing,
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
  const variableString = R.join(', ', mapObjToValues((type, name) => `$${name}: ${type}!`));
  const variableMappingString = R.join(', ', mapObjToValues((type, name) => `${name}: $${name}`));
  return `mutation ${mutationName}Mutation(${variableString}) { 
${mutationName}(${variableMappingString})) {
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
 *  @param {Task} An apollo mutation task containing an object with the result of the outputParams query
 *  in an obj at obj.data.name or an errors at obj.errors. This matches what Apollo Components expect. If you need
 *  a Result.Ok or Result.Error to halt operations on error, use requestHelpers.mapQueryTaskToNamedResultAndInputs
 */
export const makeMutationTask = R.curry((apolloConfig, {name, outputParams, templateProps}, component) => {
  // Create|Update[Model Name]InputType]
  const variableName = `${name}Data`;
  const variableType = `${R.ifElse(R.prop('id'), R.always('update'), R.always('create'))(templateProps)}${capitalize(name)}InputType`;
  // create|update[Model Name]
  const createOrUpdateName = `${R.ifElse(R.prop('id'), R.always('update'), R.always('create'))(templateProps)}${capitalize(name)}`;
  const mutation = gql`${makeMutation(
    createOrUpdateName,
    {[variableName]: variableType},
    {[name]: outputParams}
  )}`;
  if (R.any(R.isNil, R.values(inputParams))) {
    throw new Error(`inputParams have null values ${inputParams}`);
  }

  console.debug(`Mutation: ${print(mutation)}`);

  return R.map(
    mutationResponse => {
      debug(`makeMutationTask for ${name} responded: ${replaceValuesWithCountAtDepthAndStringify(2, mutationResponse)}`);
      // Put the result in data[name] to match the style of queries
      return {
        data: {
          [name]: reqPathThrowing(['data', createOrUpdateName, name], mutationResponse)
        }
      };
    },
    R.cond([
      [R.has('apolloClient'),
        apolloConfig => authApolloClientMutationRequestTask(
          apolloConfig,
          {
            mutation,
            variableName
          }
        )],
      [apolloConfig => authApolloComponentMutationRequestClass(

      )
      ]])(apolloConfig)
  );
});
