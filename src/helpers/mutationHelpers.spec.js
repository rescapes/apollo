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

import {sampleResourceMutationOutputParams, sampleResourceProps} from './samples/sampleData.js';
import {
  filterOutNullAndEmptyDeep,
  makeMutation,
  makeMutationRequestContainer,
  mutationParts
} from './mutationHelpers.js';
import {localTestAuthTask} from './testHelpers.js';
import {capitalize, defaultRunConfig, mapToNamedPathAndInputs, reqStrPathThrowing, defaultNode} from '@rescapes/ramda'
import * as R from 'ramda';
import moment from 'moment';
import {print} from 'graphql';
import * as AC from '@apollo/client';
const {gql} = defaultNode(AC)

describe('mutationHelpers', () => {
  test('makeMutation', () => {
    const name = 'sampleResource';
    const {variablesAndTypes, namedOutputParams, crud} = mutationParts(
      {
        options: {
          variables:
            props => {
              // Filters out other props
              return R.prop('resourceData', props);
            }
        }
      },
      {
        name,
        outputParams: sampleResourceMutationOutputParams
      },
      // If we are composing with other queries/mutations, we might have extra props that we want to ignore
      R.merge(sampleResourceProps, {sillyPropWeDontUse: 1})
    );

    // create|update[Model Name]
    const createOrUpdateName = `${crud}${capitalize(name)}`;

    const mutation = gql`${makeMutation(
      createOrUpdateName,
      variablesAndTypes ,
      namedOutputParams
    )}`;

    expect(print(mutation)).toMatchSnapshot();
  });

  test('makeMutationRequestContainer', done => {
    const task = R.composeK(
      ({apolloClient}) => makeMutationRequestContainer(
        {apolloClient},
        {
          name: 'region',
          outputParams: {
            id: 1,
            key: 1,
            name: 1,
            geojson: {
              features: {
                type: 1
              }
            }
          }
        },
        {
          key: `test${moment().format('HH-mm-SS')}`,
          name: `Test${moment().format('HH-mm-SS')}`
        }
      ),
      mapToNamedPathAndInputs('apolloClient', 'apolloClient',
        () => localTestAuthTask()
      )
    )();
    const errors = [];
    task.run().listen(defaultRunConfig({
      onResolved:
        response => {
          expect(R.keys(reqStrPathThrowing('result.data.createRegion.region', response))).toEqual(['id', 'key', 'name', 'geojson', '__typename']);
          // Expect he same value copied to the mutate key
          expect(R.keys(reqStrPathThrowing('result.data.mutate.region', response))).toEqual(['id', 'key', 'name', 'geojson', '__typename']);
        }
    }, errors, done));
  }, 10000);
  test('filterOutNullAndEmptyDeep', () => {
    // All null keys are removed and smacky is removed because it ends up being an empty dict
    // semi isn't removed because we don't remove empty arrays
    const obj = {x: null, y: [1, {aa:1, bb:null}, 'quack'], z: {smith: {some: ['times', 'is', { semi: [], moo: {}}, {wrong: null, smacky: {bill: null}}]}}}
    expect(filterOutNullAndEmptyDeep({}, obj)).toEqual(
      {y: [1, {aa:1}, 'quack'], z: {smith: {some: ['times', 'is', {semi: []}, {}]}}}
    )
  })
});
