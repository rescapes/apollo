import * as RR from '@rescapes/ramda';
import {composeWithComponentMaybeOrTaskChain} from './componentHelpersMonadic';
import {createLocalStorageAuthContainer} from './clientHelpers';

Error.stackTraceLimit = Infinity;

export const initializeSampleStateContainer = ({config, stateContainer, createSampleLocationsContainer, apolloConfigContainer, render}) => {

  return composeWithComponentMaybeOrTaskChain([
    apolloConfig => {
      return stateContainer(apolloConfig, {forceDelete: false, createSampleLocationsContainer});
    },
    config => {
      return createLocalStorageAuthContainer(config);
    }
  ])({config, stateContainer, createSampleLocationsContainer, apolloConfigContainer, render});
};
