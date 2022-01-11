import {composeWithChain, defaultRunConfig, mapToNamedResponseAndInputs, strPathOr} from '@rescapes/ramda';
import {localTestAuthTask, localTestNoAuthTask} from '../helpers/testHelpers.js';
import {settingsCacheContainer, settingsQueryContainer} from './settingsStore.js';
import {defaultSettingsOutputParams} from './defaultSettingsStore.js';

describe('settingsStore', () => {
  test('settingsLocalQueryContainer', done => {
    const errors = [];
    composeWithChain([
      mapToNamedResponseAndInputs('settingsAuthResponseAfterServer',
        ({apolloConfig}) => {
          return settingsCacheContainer(
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
          return settingsCacheContainer(
            apolloConfig,
            {outputParams: defaultSettingsOutputParams},
            {key: 'default', __typename: 'SettingsType'}
          );
        }
      ),
      mapToNamedResponseAndInputs('apolloConfig',
        () => localTestAuthTask(),
      ),
      mapToNamedResponseAndInputs('settingsNoAuthResponse',
        ({apolloConfig}) => {
          return settingsCacheContainer(
            apolloConfig,
            {outputParams: defaultSettingsOutputParams},
            {key: 'default', __typename: 'SettingsType'}
          );
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
            expect(strPathOr(false, 'data.settings.0.id', settingsNoAuthResponse)).toBeFalsy()
            expect(strPathOr(false, 'data', settingsAuthResponse)).toBeTruthy();
            expect(strPathOr(false, 'data.settings.0.id', settingsAuthResponse)).toBeTruthy();
          }
      }, errors, done)
    );
  }, 100000);
});