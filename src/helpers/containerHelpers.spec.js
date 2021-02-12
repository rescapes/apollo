import {
  callMutationNTimesAndConcatResponses,
  containerForApolloType,
  mapTaskOrComponentToNamedResponseAndInputs
} from './containerHelpers';
import {composeWithComponentMaybeOrTaskChain, getRenderPropFunction} from './componentHelpersMonadic';
import moment from 'moment';
import {capitalize, composeWithChain, defaultRunConfig, mapToNamedResponseAndInputs} from '@rescapes/ramda';
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
      mapToNamedResponseAndInputs('unforcedItems',
        ({apolloConfig, items}) => {
          return callMutationNTimesAndConcatResponses(
            apolloConfig,
            {
              mutationContainer: sampleMutateRegionContainer,
              queryForExistingContainer: sampleQueryRegionsContainer, queryResponsePath: 'data.regions',
              // If we don't forceDelete, we can reuse existing items
              forceDelete: false,
              // Query to look for existing items
              existingMatchingProps: {
                region: {
                  nameIn: ['Enwandagon', 'Elbonia'],
                }
              },
              // Matches existing items so we don't have to recreate samples
              existingItemMatch: (item, existingItems) => R.find(
                existingItem => R.startsWith(item.key, existingItem.key), existingItems
              ),
              items: [{key: 'enwandagon'}, {key: 'elbonia'}],
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
        }),
      mapToNamedResponseAndInputs('items',
        ({apolloConfig}) => {
          return callMutationNTimesAndConcatResponses(
            apolloConfig,
            {
              forceDelete: true, existingMatchingProps: {region: {nameIn: ['Enwandagon', 'Elbonia']}},
              queryForExistingContainer: sampleQueryRegionsContainer, queryResponsePath: 'data.regions',
              propVariationFuncForDeleted: ({item}) => {
                return {region: {id: item.id, deleted: moment().toISOString(true)}};
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
        }
      ),
      mapToNamedResponseAndInputs('apolloConfig',
        () => {
          return localTestAuthTask();
        }
      )
    ])({}).run().listen(defaultRunConfig({
      onResolved: ({items, unforcedItems}) => {
        expect(R.map(R.prop('id'), items)).toEqual(R.map(R.prop('id'), unforcedItems))
      }
    }, errors, done));
  }, 1000000);
});