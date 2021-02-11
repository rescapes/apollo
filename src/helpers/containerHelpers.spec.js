import {
  callMutationNTimesAndConcatResponses,
  containerForApolloType,
  mapTaskOrComponentToNamedResponseAndInputs
} from './containerHelpers';
import {composeWithComponentMaybeOrTaskChain, getRenderPropFunction} from './componentHelpersMonadic';
import moment from 'moment';
import {capitalize, composeWithChain, defaultRunConfig} from '@rescapes/ramda';
import {localTestAuthTask} from './testHelpers';
import {sampleMutateRegionContainer, sampleQueryRegionsContainer} from './samples/sampleRegionStore';
import * as R from 'ramda';

describe('containerHelpers', () => {
  test('mapTaskOrComponentToNamedResponseAndInputs', done => {
    const errors = [];
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

  test('callMutationNTimesAndConcatResponses', done => {
    const errors = [];
    composeWithChain([
      apolloConfig => {
        return callMutationNTimesAndConcatResponses(
          apolloConfig,
          {
            forceDelete: true, forceDeleteMatchingProps: {region: {nameIn: ['Enwandagon', 'Elbonia']}},
            queryToDeleteContainer: sampleQueryRegionsContainer, queryResponsePath: 'data.regions',
            propVariationFuncForDeleted: ({item}) => {
              return {region: {id: item.id, deleted: moment().toISOString(true)}}
            },
            items: [{key: 'enwandagon'}, {key: 'elbonia'}],
            mutationContainer: sampleMutateRegionContainer,
            responsePath: 'result.data.mutate.region',
            propVariationFunc: ({item: {key}}) => {
              return {
                region: {
                  key,
                  name: capitalize(key)
                }
              };
            }
          },
          {}
        );
      },
      () => localTestAuthTask()
    ])().run().listen(defaultRunConfig({
      onResolved: objects => {
        expect(R.length(objects)).toEqual(2);
      }
    }, errors, done));
  }, 100000);

});