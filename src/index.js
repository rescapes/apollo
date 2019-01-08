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

export {loginTask, authClientOrLoginTask, refreshToken, verifyToken} from './auth/login';
export {
  default as createApolloClient,
  authApolloClientQueryRequestTask,
  authApolloClientMutationRequestTask,
  authApolloClient,
  authApolloClientRequestTask,
  authApolloClientTask,
  getApolloAuthClient,
  noAuthApolloClient,
  noAuthApolloClientMutationRequestTask,
  noAuthApolloClientQueryRequestTask,
  noAuthApolloClientRequestTask
} from './client/apolloClient';
export {categorizeStreetviewUrl} from './helpers/categorizeHelpers';
export {makeQuery, makeQueryTask} from './helpers/queryHelpers';
export {makeMutation, makeMutationTask} from './helpers/mutationHelpers';
export {formatOutputParams, resolveGraphQLType, formatInputParams, responseAsResult} from './helpers/requestHelpers';
export {makeFeaturesByTypeSelector, makeGeojsonSelector, makeMarkersByTypeSelector} from './selectors/geojsonSelectors';
export {mapboxSelector, viewportSelector} from './selectors/mapboxSelectors';
export {
  activeUserRegionsSelector,
  activeUserSelectedRegionsSelector,
  regionIdsSelector,
  regionSelector,
  regionsSelector
} from './selectors/regionSelectors';
export {mapboxSettingsSelector, settingsSelector} from './selectors/settingsSelectors';
export {
  makeActiveUserAndSettingsSelector,
  makeActiveUserRegionsAndSettingsSelector,
  makeActiveUserSelectedRegionAndSettingsSelector
} from './selectors/storeSelectors';
export {
  mergeAndApplyMatchingStyles,
  applyMatchingStyles,
  browserDimensionsSelector,
  makeBrowserProportionalDimensionsSelector,
  makeMergeDefaultStyleWithProps
} from './selectors/styleSelectors';
export {
  activeUsersSelector,
  activeUserSelectedRegionSelector,
  activeUserValueSelector,
  userRegionsSelector,
  userResolvedRegionsSelector,
  userSelectedRegionSelector,
  userSelector,
  usersSelector
} from './selectors/userSelectors';
export {createSelectorResolvedSchema} from './schema/selectorResolvers';
export {remoteLinkedSchemaTask, remoteSchemaTask} from './schema/remoteSchema';
