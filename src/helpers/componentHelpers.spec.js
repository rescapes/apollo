/**
 * Created by Andy Likuski on 2020.04.01
 * Copyright (c) 2020 Andy Likuski
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 */

import {apolloDependentHOC, apolloHOC} from './componentHelpers';
import {e} from 'rescape-helpers-component';
import {adopt} from 'react-adopt';
import {Component} from 'react';
import {apolloContainers, dependentApolloContainers} from './samples/sampleRegionStore';
import {mount} from 'enzyme';
import {fromPromised, of} from 'folktale/concurrency/task';
import {
  composeWithChain,
  composeWithMap,
  defaultRunConfig,
  mapToNamedResponseAndInputs,
  reqStrPathThrowing
} from 'rescape-ramda';
import PropTypes from 'prop-types';
import {localTestAuthTask} from './testHelpers';
import {act} from 'react-dom/test-utils';
import {v} from 'rescape-validate';
import {ApolloProvider} from '@apollo/react-hooks';

/**
 * Wraps a component in an Apollo Provider for testing
 * @param apolloConfig
 * @param apolloConfig.apolloClient
 * @param component
 * @param props for the component
 * @return {*}
 */
const mountWithApolloClient = v((apolloConfig, component) => {
  let c;
  act(() => {
    c = mount(
      e(
        ApolloProvider,
        {client: reqStrPathThrowing('apolloClient', apolloConfig)},
        component
      )
    );
  });
  return c;
}, [
  ['apolloConfig', PropTypes.shape({
    apolloClient: PropTypes.shape().isRequired
  }).isRequired],
  ['component', PropTypes.oneOfType([PropTypes.shape(), PropTypes.func]).isRequired]
], 'mountWithApolloClient');


describe('componentHelpers', () => {

  test('apolloHOC', done => {
    // This produces a component class that expects a props object keyed by the keys in apolloContainers
    // The value at each key is the result of the corresponding query container or the mutate function of the corresponding
    // mutation container
    const AdoptedApolloContainer = adopt(apolloContainers);
    const errors = [];

    class Sample extends Component {
      render() {
        return e(
          'div'
        );
      }
    }

    // why is this needed?
    Sample.displayName = 'Sample';

    composeWithChain([
        mapToNamedResponseAndInputs('mounted',
        ({apolloConfig}) => {
          return of(mountWithApolloClient(
            apolloConfig,
            e(
              // Wrap AdoptedApolloContainer in
              // Creates an HOC component whose child is AdoptedApolloContainer whose child is Sample
              apolloHOC({}, AdoptedApolloContainer, Sample),
              {region: {id: 1}, _testApolloRenderProps: true}
            )
          ));
        }),
        mapToNamedResponseAndInputs('apolloConfig',
          () => localTestAuthTask()
        )
      ]
    )().run().listen(defaultRunConfig({
      onResolved: ({mounted}) => {
        const hoc = mounted.find('ApolloHOC').instance();
        expect(hoc).toBeTruthy()
        // This is a function so I guess I can't use instance()
        const adoptedContainer = mounted.find(AdoptedApolloContainer.displayName)
        expect(adoptedContainer.length).toBeTruthy()
        const sample = mounted.find(Sample.displayName).instance();
        expect(sample).toBeTruthy()
      }
    }, errors, done));
  });
});