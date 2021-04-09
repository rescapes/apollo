import {composeWithChain, defaultRunConfig, mapToNamedResponseAndInputs, strPathOr} from '@rescapes/ramda';
import {localTestAuthTask, localTestNoAuthTask} from '../helpers/testHelpers.js';
import {settingsCacheFragmentContainer, settingsQueryContainer} from './settingsStore';
import {defaultSettingsOutputParams} from './defaultSettingsStore';
import {queryLocalTokenAuthContainer} from '../stores/tokenAuthStore';

describe('settingsStore', () => {
  test('settingsLocalQueryContainer', done => {
    const errors = [];
    composeWithChain([
      mapToNamedResponseAndInputs('settingsAuthResponseAfterServer',
        ({apolloConfig}) => {
          return settingsCacheFragmentContainer(
            apolloConfig,
            {outputParams: defaultSettingsOutputParams},
            {key: 'default', __typename: 'SettingsType'});
        }
      ),
      mapToNamedResponseAndInputs('settingsFromServer',
        ({apolloConfig}) => {
          // Make sure this doesn't override cache-only values
          return settingsQueryContainer(
            apolloConfig,
            {outputParams: defaultSettingsOutputParams},
            {key: 'default', __typename: 'SettingsType'});
        }
      ),
      mapToNamedResponseAndInputs('settingsAuthResponse',
        ({apolloConfig}) => {
          return settingsCacheFragmentContainer(
            apolloConfig,
            {outputParams: defaultSettingsOutputParams},
            {key: 'default', __typename: 'SettingsType'});
        }
      ),
      mapToNamedResponseAndInputs('apolloConfig',
      () => localTestAuthTask(),
      ),
      mapToNamedResponseAndInputs('settingsNoAuthResponse',
        ({apolloConfig}) => {
          return settingsCacheFragmentContainer(
            apolloConfig,
            {outputParams: defaultSettingsOutputParams},
            {key: 'default', __typename: 'SettingsType'});
        }
      ),
      mapToNamedResponseAndInputs('apolloConfig',
      () => localTestNoAuthTask()
      )
    ])({}).run().listen(defaultRunConfig(
      {
        onResolved:
          ({settingsNoAuthResponse, settingsAuthResponse, settingsAuthResponseAfterServer}) => {
            expect(strPathOr(false, 'data', settingsNoAuthResponse)).toBeTruthy();
            expect(strPathOr(false, 'data', settingsAuthResponse)).toBeTruthy();
          }
      }, errors, done)
    );
  }, 200000);
});