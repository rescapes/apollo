/**
 * Created by Andy Likuski on 2018.04.23
 * Copyright (c) 2018 Andy Likuski
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 */

import {
  apolloQueryResponsesTask,
  composePropsFilterIntoApolloConfigOptionsVariables,
  makeQuery,
  makeQueryContainer
} from './queryHelpers';

import {gql} from '@apollo/client';
import {print} from 'graphql';
import {sampleInputParamTypeMapper, sampleResourceOutputParams} from './samples/sampleData';
import {
  composeWithChain,
  defaultRunConfig,
  defaultRunToResultConfig,
  mapToNamedPathAndInputs,
  mapToNamedResponseAndInputs, strPathOr
} from 'rescape-ramda';
import {expectKeys, localTestAuthTask, localTestConfig} from './testHelpers';
import * as R from 'ramda';
import {makeMutationRequestContainer} from './mutationHelpers';
import moment from 'moment';
import {of} from 'folktale/concurrency/task';
import Result from 'folktale/result';

describe('queryHelpers', () => {

  test('makeQuery', () => {
    expect(
      print(
        gql`${makeQuery('sampleResourceQuery', sampleInputParamTypeMapper, sampleResourceOutputParams, {id: 0})}`
      )
    ).toMatchSnapshot();
  });

  test('makeQueryContainer', done => {
    expect.assertions(2);
    const {settings: {api}} = localTestConfig;
    const task = composeWithChain([
      // Test Skip
      mapToNamedResponseAndInputs('skippedResponse',
        ({apolloClient, createdRegion}) => makeQueryContainer(
          {
            apolloClient,
            options: {
              skip: true,
              variables: props => {
                return R.pick(['key'], props);
              }
            },
            fetchPolicy: 'cache-only'
          },
          {
            name: 'regions',
            readInputTypeMapper: {},
            outputParams: {id: 1, key: 1, name: 1, geojson: {features: {type: 1}}}
          },
          {key: createdRegion.key, sillyPropThatWontBeUsed: '11wasAraceHorse'}
        )
      ),
      // See if we can get the value from the cache
      mapToNamedPathAndInputs('region', 'data.regions.0',
        ({apolloClient, createdRegion}) => makeQueryContainer(
          {
            apolloClient,
            options: {
              variables: props => {
                return R.pick(['key'], props);
              }
            },
            fetchPolicy: 'cache-only'
          },
          {
            name: 'regions',
            readInputTypeMapper: {},
            outputParams: {id: 1, key: 1, name: 1, geojson: {features: {type: 1}}}
          },
          {key: createdRegion.key, sillyPropThatWontBeUsed: '11wasAraceHorse'}
        )
      ),
      mapToNamedPathAndInputs('region1', 'data.regions.0',
        ({apolloClient, createdRegion}) => makeQueryContainer(
          {
            apolloClient,
            options: {
              variables: props => {
                return R.pick(['key'], props);
              }
            }
          },
          {
            name: 'regions',
            readInputTypeMapper: {},
            outputParams: {id: 1, key: 1, name: 1, geojson: {features: {type: 1}}}
          },
          {key: createdRegion.key, sillyPropThatWontBeUsed: '11wasAraceHorse'}
        )
      ),
      mapToNamedPathAndInputs('createdRegion', 'data.createRegion.region',
        ({apolloClient}) => makeMutationRequestContainer(
          {apolloClient},
          {
            name: 'region',
            outputParams: {id: 1, key: 1}
          },
          {
            key: `test${moment().format('HH-mm-SS')}`,
            name: `Test${moment().format('HH-mm-SS')}`
          }
        )
      ),
      mapToNamedPathAndInputs('apolloClient', 'apolloClient',
        () => localTestAuthTask()
      )
    ])();
    const errors = [];
    task.run().listen(defaultRunConfig({
        onResolved:
          ({region, skippedResponse}) => {
            expectKeys(['id', 'key', 'name', 'geojson', '__typename'], region);
            expect(strPathOr(false, 'skip', skippedResponse)).toBe(true)
          }
      }, errors, done)
    );
  }, 100000);

  test('apolloQueryResponsesTask', done => {
    const errors = [];
    apolloQueryResponsesTask(of({key: 1, apple: 1, pear: 2, banana: 3}),
      {
        pacman: props => of(R.pick(['key', 'apple'], props)),
        mspacman: props => of(R.omit(['key'], props))
      }
    ).run().listen(defaultRunConfig({
      onResolved: responses => {
        expect(responses).toEqual({
          key: 1,
          apple: 1,
          pear: 2,
          banana: 3,
          pacman: {key: 1, apple: 1},
          mspacman: {apple: 1, pear: 2, banana: 3, pacman: {key: 1, apple: 1}}
        });
      }
    }, errors, done));
  });
  test('apolloQueryResponsesTaskEmpty', done => {
    const errors = [];
    apolloQueryResponsesTask(of({key: 1, apple: 1, pear: 2, banana: 3}), {}).run().listen(
      defaultRunConfig({
        onResolved: responses => {
          expect(responses).toEqual({
            key: 1,
            apple: 1,
            pear: 2,
            banana: 3
          });
        }
      }, errors, done));
  });

  test('composePropsFilterIntoApolloConfigOptionsVariables', done => {
    const task = composeWithChain([
      mapToNamedPathAndInputs('region', 'data.regions.0',
        ({apolloClient, createdRegion}) => {
          const apolloConfig = (
            {
              apolloClient,
              options: {
                variables: props => {
                  return R.pick(['key', 'sillyPropThatWontBeUsed'], props);
                }
              }
            }
          );
          return makeQueryContainer(
            composePropsFilterIntoApolloConfigOptionsVariables(
              apolloConfig,
              props => {
                return R.pick(['key'], props);
              }
            ),
            {
              name: 'regions',
              readInputTypeMapper: {},
              outputParams: {id: 1, key: 1, name: 1, geojson: {features: {type: 1}}}
            },
            {key: createdRegion.key, sillyPropThatWontBeUsed: '11wasAraceHorse'}
          );
        }
      ),
      mapToNamedPathAndInputs('createdRegion', 'data.createRegion.region',
        ({apolloClient}) => makeMutationRequestContainer(
          {apolloClient},
          {
            name: 'region',
            outputParams: {id: 1, key: 1}
          },
          {
            key: `test${moment().format('HH-mm-SS')}`,
            name: `Test${moment().format('HH-mm-SS')}`
          }
        )
      ),
      mapToNamedPathAndInputs('apolloClient', 'apolloClient',
        () => localTestAuthTask()
      )
    ])();
    const errors = [];
    task.run().listen(defaultRunConfig({
      onResolved:
        ({region}) => {
          expectKeys(['id', 'key', 'name', 'geojson', '__typename'], region);
        }
    }, errors, done));
  });
});
