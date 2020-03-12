/**
 * Created by Andy Likuski on 2018.04.28
 * Copyright (c) 2017 Andy Likuski
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 */

export {
  loginMutationTask, authClientOrLoginTask, refreshTokenContainer, verifyTokenRequestContainer, loginToAuthClientTask
} from './auth/login';
export {
  default as createApolloClient,
  authApolloClientQueryContainer,
  authApolloClientMutationRequestContainer,
  authApolloClientTask,
  authApolloClientRequestTask,
  authApolloClientWithTokenTask,
  getApolloAuthClientTask,
  noAuthApolloClientTask,
  noAuthApolloClientMutationRequestTask,
  noAuthApolloClientQueryRequestTask,
  noAuthApolloClientRequestTask
} from './client/apolloClient';
export {makeQuery, makeQueryContainer} from './helpers/queryHelpers';
export {makeMutation, makeMutationRequestContainer, mutationParts} from './helpers/mutationHelpers';
export {makeMutationWithClientDirectiveContainer, makeMutationWithClientDirective} from './helpers/mutationCacheHelpers'
export {
  formatOutputParams,
  resolveGraphQLType,
  formatInputParams,
  mapQueryTaskToNamedResultAndInputs,
  objIdToInt,
  pickGraphqlPaths,
  pickGraphqlPathsOver
} from './helpers/requestHelpers';
export {remoteLinkedSchemaTask, remoteSchemaTask} from './schema/remoteSchema';

export {
  sampleInputParamTypeMapper,
  sampleResources,
  sampleResourceMutationOutputParams,
  sampleResourceOutputParams,
  sampleResourceProps
} from './helpers/samples/sampleData';
export {
  testAuthTask, testStateLinkResolversAndDefaults, testConfig, localTestAuthTask
} from './helpers/testHelpers';
export {createStateLinkDefaults, defaultStateLinkResolvers} from './client/stateLink';
export {containerForApolloType} from './helpers/containerHelpers'
