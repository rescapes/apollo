import {composeWithChain, defaultRunConfig, mapToNamedResponseAndInputs, strPathOr} from '@rescapes/ramda';
import {localTestAuthTask} from '../helpers/testHelpers.js';
import {settingsCacheFragmentContainer} from './settingsStore';
import {defaultSettingsOutputParams} from './defaultSettingsStore';

describe('settingsStore', () => {
 test('settingsLocalQueryContainer', done => {
  const errors = [];
  composeWithChain([
   mapToNamedResponseAndInputs('settingsLocalResponse',
     ({apolloClient}) => {
      return settingsCacheFragmentContainer(
        {apolloClient},
        {outputParams: defaultSettingsOutputParams},
        {key: 'default', __typename: 'SettingsType'});
     }
   ),
   () => localTestAuthTask()
  ])().run().listen(defaultRunConfig(
    {
     onResolved:
       ({settingsLocalResponse}) => {
        expect(strPathOr(false, 'data', settingsLocalResponse)).toBeTruthy()
       }
    }, errors, done)
  );
 }, 200000);
})