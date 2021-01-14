import * as RR from '@rescapes/ramda';
import {composeWithComponentMaybeOrTaskChain} from './componentHelpersMonadic';
import {createLocalStorageAuthContainer} from './clientHelpers';
import {reqStrPathThrowing} from '@rescapes/ramda';

Error.stackTraceLimit = Infinity;

export const initializeSampleStateContainer = ({config, stateContainer, createSampleLocationsContainer}) => {

  return composeWithComponentMaybeOrTaskChain([
    currentUserResponse => {
      return stateContainer(reqStrPathThrowing('apolloConfig', config), {forceDelete: false, createSampleLocationsContainer});
    },
    config => {
      return createLocalStorageAuthContainer(config);
    }
  ])(config)
};
