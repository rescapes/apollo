import {containerForApolloType, mapTaskOrComponentToNamedResponseAndInputs} from './containerHelpers';
import {composeWithComponentMaybeOrTaskChain, getRenderPropFunction} from './componentHelpersMonadic';
import {composeWithChain, defaultRunConfig} from '@rescapes/ramda';
import {localTestAuthTask} from './testHelpers';

describe('containerHelpers', () => {
  test('mapTaskOrComponentToNamedResponseAndInputs', done => {
    const errors = []
    composeWithChain([
      (apolloConfig) => composeWithComponentMaybeOrTaskChain([
        mapTaskOrComponentToNamedResponseAndInputs(apolloConfig, 'chip',
          props => {
            return containerForApolloType(
              apolloConfig,
              {
                render: getRenderPropFunction(props),
                response: 'block'
              }
            );
          }
        ),
        mapTaskOrComponentToNamedResponseAndInputs(apolloConfig, 'pickle',
          props => {
            return containerForApolloType(
              apolloConfig,
              {
                render: getRenderPropFunction(props),
                response: 'dill'
              }
            );
          }
        )
      ])({x: 1, y: 2}),
      () => localTestAuthTask()
    ])().run().listen(defaultRunConfig({
      onResolved: obj => {
        expect(obj).toEqual({x: 1, y: 2, pickle: 'dill', chip: 'block'});
      }
    }, errors, done));
  });
});