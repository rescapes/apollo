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

import {
  deleteRefreshTokenCookieMutationRequestContainer,
  deleteTokenCookieMutationRequestContainer
} from './stores/tokenAuthStore';

export {
  noLoginToAuthClientTask,
  authClientOrLoginTask,
  loginToAuthClientTask
} from './auth/login';
export {
  authApolloClientQueryContainer,
  authApolloClientMutationRequestContainer,
  getApolloClientTask,
  authApolloClientRequestTask,
  noAuthApolloClientTask,
  noAuthApolloClientMutationRequestTask,
  noAuthApolloClientQueryRequestTask,
  noAuthApolloClientRequestTask,
  authApolloComponentMutationContainer,
  authApolloComponentQueryContainer,
  authApolloQueryContainer,
  getOrCreateApolloClientTask
} from './client/apolloClient';
export {
  getOrCreateAuthApolloClientWithTokenTask,
  getOrCreateApolloClientTaskAndSetDefaults,
  getOrCreateNoAuthApolloClientTask
} from './client/apolloClientAuthentication';
export {
  makeQuery,
  makeQueryContainer,
  apolloQueryResponsesTask,
  createRequestVariables,
  composePropsFilterIntoApolloConfigOptionsVariables
} from './helpers/queryHelpers';
export {
  makeMutation,
  makeMutationRequestContainer,
  mutationParts,
  addMutateKeyToMutationResponse,
  filterOutReadOnlyVersionProps,
  filterOutNullDeleteProps
} from './helpers/mutationHelpers';
export {
  makeMutationWithClientDirectiveContainer, makeCacheMutation, createCacheOnlyProps, mergeCacheable
} from './helpers/mutationCacheHelpers';
export {
  formatOutputParams,
  resolveGraphQLType,
  formatInputParams,
  mapQueryContainerToNamedResultAndInputs,
  objIdToInt,
  pickGraphqlPaths,
  pickGraphqlPathsOver,
  omitClientFields,
  optionsWithWinnowedProps,
  omitUnrepresentedOutputParams,
  createReadInputTypeMapper,
  relatedObjectsToIdForm,
  VERSION_PROPS,
  versionOutputParamsMixin
} from './helpers/requestHelpers';

//export {remoteLinkedSchemaTask, remoteSchemaTask} from './schema/remoteSchema';

export {
  sampleInputParamTypeMapper,
  sampleResources,
  sampleResourceMutationOutputParams,
  sampleResourceOutputParams,
  sampleResourceProps
} from './helpers/samples/sampleData';
export {
  localTestConfig, localTestAuthTask, cacheOptions, expectKeys
} from './helpers/testHelpers';
export {mergeLocalTestValuesIntoConfig, defaultStateLinkResolvers} from './client/stateLink';
export {containerForApolloType} from './helpers/containerHelpers';
export {typePoliciesWithMergeObjects, createAuthTask, createNoAuthTask} from './helpers/clientHelpers';dd
export {
  writeDefaultSettingsToCache,
  defaultSettingsOutputParams,
  defaultSettingsCacheOnlyObjs,
  defaultSettingsCacheIdProps
} from './helpers/defaultSettingsStore';
export {
  makeSettingsMutationContainer,
  createCacheOnlyPropsForSettings,
  readInputTypeMapper,
  makeSettingsQueryContainer,
  writeConfigToServerAndCache
} from './helpers/settingsStore';
export {
  typePoliciesConfig
} from './config';
export {
  makeQueryFromCacheContainer, makeClientQuery, makeQueryWithClientDirectiveContainer
} from './helpers/queryCacheHelpers';
export {firstMatchingPathLookup} from './helpers/utilityHelpers';
export {
  componentRenderedWithChildrenRenderProp,
  componentRenderedWithChildrenRenderPropMaybe,
  componentAndChildRenderedWithRenderProp,
  componentAndChildRenderedWithChildrenRenderPropMaybe
} from './helpers/componentHelpers';

export {
  composeWithComponentMaybeOrTaskChain, nameComponent, getRenderProp, getRenderPropFunction
} from './helpers/componentHelpersMonadic';

export {
  apolloResult,
  resultOkOrNull,
  apolloResponseSingleValueOrNull,
  apolloResponseValueOrNull,
  apolloResponseFilterOrEmpty
} from './helpers/apolloMonadHelpers';

export {
  makeCurrentUserQueryContainer, userOutputParams, userReadInputTypeMapper, isAuthenticatedLocal, authenticatedUserLocal
} from './stores/userStore';

export {
  refreshTokenMutationRequestContainer,
  verifyTokenMutationRequestContainer,
  tokenAuthMutationContainer,
  deleteTokenCookieMutationRequestContainer,
  deleteRefreshTokenCookieMutationRequestContainer
} from './stores/tokenAuthStore';