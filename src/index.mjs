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
} from './stores/tokenAuthStore.js';

export {
  authClientOrLoginTask,
  loginToAuthClientTask
} from './auth/login.js';
export {
  authApolloClientQueryContainer,
  authApolloClientMutationRequestContainer,
  getApolloClientTask,
  authApolloClientRequestTask,
  noAuthApolloClientMutationRequestTask,
  noAuthApolloClientQueryRequestTask,
  noAuthApolloClientRequestTask,
  authApolloComponentMutationContainer,
  authApolloComponentQueryContainer,
  authApolloQueryContainer,
  getOrCreateApolloClientTask
} from './client/apolloClient.js';
export {
  getOrCreateApolloClientAndDefaultsTask,
  writeDefaultsAndQueryCurrentUserContainer
} from './client/apolloClientAuthentication.js';
export {
  makeQuery,
  makeQueryContainer,
  apolloQueryResponsesContainer,
  queryResponsesContainer,
  createRequestVariables,
  composeFuncAtPathIntoApolloConfig,
  logicalOrValueAtPathIntoApolloConfig
} from './helpers/queryHelpers.js';
export {
  makeMutation,
  makeMutationRequestContainer,
  mutationParts,
  filterOutReadOnlyVersionProps,
  filterOutNullDeleteProps
} from './helpers/mutationHelpers.js';
export {
  makeCacheMutationContainer, makeCacheMutation, createCacheOnlyProps, mergeCacheable
} from './helpers/mutationCacheHelpers.js';
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
  VERSION_PROPS,
  versionOutputParamsMixin,
  getPathObjects,
  updateRelatedObjectsToIdForm
} from './helpers/requestHelpers.js';


export {
  sampleInputParamTypeMapper,
  sampleResources,
  sampleResourceMutationOutputParams,
  sampleResourceOutputParams,
  sampleResourceProps
} from './helpers/samples/sampleData.js';
export {
  localTestConfig, localTestAuthTask, localTestNoAuthTask, expectKeys, settingsConfig
} from './helpers/testHelpers.js';
export {
  initializeAuthorizedTask, initializeNoAuthTask
} from './helpers/initializationHelpers.js';

export {defaultStateLinkResolvers} from './client/stateLink.js';
export {
  containerForApolloType,
  mapTaskOrComponentToNamedResponseAndInputs, mapTaskOrComponentToMergedResponse,
  addMutateKeyToMutationResponse,

} from './helpers/containerHelpers.js';
export {callMutationNTimesAndConcatResponses} from './containers/multipleMutations.js'
export {mutationRequestWithMutateOnceAndWaitContainer, mutateOnceAndWaitContainer} from './containers/mutateOnceAndWait.js'
export {typePoliciesWithMergeObjects, createLocalStorageAuthContainer} from './helpers/clientHelpers.js';
export {
  writeDefaultSettingsToCacheContainer,
  defaultSettingsOutputParams,
  settingsTypeIdPathLookup,
  defaultSettingsCacheOnlyObjs,
  defaultSettingsCacheIdProps,
  defaultSettingsTypenames,
  writeConfigToServerAndCacheContainer
} from './helpers/defaultSettingsStore.js';
export {
  makeSettingsMutationContainer,
  createCacheOnlyPropsForSettings,
  readInputTypeMapper,
  settingsQueryContainer,
  settingsCacheFragmentContainer
} from './helpers/settingsStore.js';
export {
  typePoliciesConfig,
  typePolicies,
  cacheOptions
} from './config.js';
export {
  makeQueryFromCacheContainer, makeClientQuery, makeQueryWithClientDirectiveContainer
} from './helpers/queryCacheHelpers.js';
export {firstMatchingPathLookup} from './helpers/utilityHelpers.js';
export {
  componentRenderedWithChildrenRenderProp,
  componentRenderedWithChildrenRenderPropMaybe,
  componentAndChildRenderedWithRenderProp,
  componentAndChildRenderedWithChildrenRenderPropMaybe,
  e
} from './helpers/componentHelpers.js';

export {
  composeWithComponentMaybeOrTaskChain, nameComponent, getRenderProp, getRenderPropFunction
} from './helpers/componentHelpersMonadic.js';

export {
  apolloResult,
  resultOkOrNull,
  apolloResponseSingleValueOrNull,
  apolloQueryResponseValueOrNull,
  apolloResponseFilterOrEmpty
} from './helpers/apolloMonadHelpers.js';

export {
  currentUserQueryContainer,
  userOutputParams,
  userReadInputTypeMapper,
  authenticatedUserLocalContainer
} from './stores/userStore.js';

export {
  refreshTokenMutationRequestContainer,
  verifyTokenMutationRequestContainer,
  tokenAuthMutationContainer,
  deleteTokenCookieMutationRequestContainer,
  deleteRefreshTokenCookieMutationRequestContainer,
  queryLocalTokenAuthContainer,
  tokenAuthOutputParams
} from './stores/tokenAuthStore.js';

export {
  settingsQueryContainerDefault,
  settingsLocalQueryContainerDefault
} from './helpers/defaultContainers.js';
export {deleteItemsOfExistingResponses} from "./containers/multipleMutations.js";