import * as RR from '@rescapes/ramda';
import {defaultNode, taskToPromise} from '@rescapes/ramda';
import {devConfigBuilder, prodConfigBuilder} from '@stateofplace/sop-config';

import {i18nTask} from '@rescapes/translation';
import {composeWithComponentMaybeOrTaskChain} from './componentHelpersMonadic';
import {createLocalStorageAuthContainer} from './clientHelpers';

const {mapToNamedResponseAndInputs} = RR;

Error.stackTraceLimit = Infinity;

export const initializeSampleStateContainer = ({config, stateContainer, createSampleLocationsContainer, apolloConfigContainer, render}) => {

  return composeWithComponentMaybeOrTaskChain([
    apolloConfig => {
      return stateContainer(apolloConfig, {forceDelete: false, createSampleLocationsContainer});
    },
    config => {
      return createLocalStorageAuthContainer(config);
    }
  ])(config);
};
