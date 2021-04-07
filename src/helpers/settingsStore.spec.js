import {composeWithChain, defaultRunConfig, mapToNamedResponseAndInputs, strPathOr} from '@rescapes/ramda';
import {localTestAuthTask} from '../helpers/testHelpers.js';
import {settingsLocalQueryContainer} from './settingsStore';
import {defaultSettingsOutputParams} from './defaultSettingsStore';

describe('settingsStore', () => {
 test('settingsLocalQueryContainer', done => {
  const errors = [];
  composeWithChain([
   mapToNamedResponseAndInputs('settingsLocalResponse',
     ({apolloClient}) => {
      return settingsLocalQueryContainer(
        {apolloClient},
        {outputParams: defaultSettingsOutputParams},
        {key: 'default'});
     }
   ),
   () => localTestAuthTask()
  ])().run().listen(defaultRunConfig(
    {
     onResolved:
       ({settingsLocalResponse}) => {
        expect(strPathOr(false, 'data.settings.0', settingsLocalResponse)).toBeTruthy()
       }
    }, errors, done)
  );
 }, 200000);
})