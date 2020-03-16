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

import {formatOutputParams} from './queryHelpers';
import {sampleResourceMutationOutputParams, sampleResourceProps} from './samples/sampleData';
import {makeMutation, makeMutationRequestContainer, mutationParts} from './mutationHelpers';
import {localTestAuthTask} from './testHelpers';
import {capitalize, defaultRunConfig, mapToNamedPathAndInputs, reqStrPathThrowing} from 'rescape-ramda';
import * as R from 'ramda';
import moment from 'moment';
import {print} from 'graphql';
import {gql} from '@apollo/client'

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
          outputParams: ['id', 'key', 'name', {geojson: [{features: ['type']}]}]
        },
        {
          key: `test${moment().format('HH-mm-SS')}`,
          name: `Test${moment().format('HH-mm-SS')}`
        }
      ),
      mapToNamedPathAndInputs('apolloClient', 'apolloClient',
        () => localTestAuthTask
      )
    )();
    const errors = [];
    task.run().listen(defaultRunConfig({
      onResolved:
        response => {
          expect(R.keys(reqStrPathThrowing('data.createRegion.region', response))).toEqual(['id', 'key', 'name', 'geojson', '__typename']);
        }
    }, errors, done));
  }, 10000);
});
