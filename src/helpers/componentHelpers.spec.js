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

import {apolloHOC} from './componentHelpers';
import {makeMutationRequestContainer} from './mutationHelpers';
import {e} from 'rescape-helpers-component';
import * as R from 'ramda';
import {adopt} from 'react-adopt';
import {Component} from 'react';
import {apolloContainers} from './samples/sampleRegionStore';

describe('componentHelpers', () => {
  test('apolloHOC', () => {
    // This produces a component class that expects a props object keyed by the keys in apolloContainers
    // The value at each key is the result of the corresponding query container or the mutate function of the corresponding
    // mutation container
    const AdoptedApolloContainer = adopt(apolloContainers);
    // Wrap AdoptedApolloContainer in
    const apolloHoc = apolloHOC(AdoptedApolloContainer);

    class Sample extends Component {
      render() {
        return e(
          'div'
        );
      }
    }

    expect(apolloHoc(Sample)).toBeTruthy();
  });
});