import {initializeSampleStateContainer} from './appIndexInitialization';

describe('appIndex', () => {
  test('initializeSampleStateContainer', async done => {
    const {i18n, apolloConfig, props} = await initializeSampleStateContainer();
    expect(i18n).toBeTruthy();
    expect(apolloConfig).toBeTruthy();
    expect(props).toBeTruthy();
    done()
  });
});
