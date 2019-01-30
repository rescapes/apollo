/**
 * Created by Andy Likuski on 2018.03.07
 * Copyright (c) 2018 Andy Likuski
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 */
import {parentPropsForContainerTask, makeApolloTestPropsTaskFunction} from 'rescape-helpers-test';
import {queries} from './SampleContainer';
import {of} from 'folktale/concurrency/task';
import {Ok} from 'folktale/result';

/**
 * @file Links sample props from a parent component to a Region component
 */

/**
 * Returns a function that expects state and parentProps for testing and returns a Task that resolves the props
 */
//export const samplePropsTaskMaker = makeApolloTestPropsTaskFunction(mapStateToProps, mapDispatchToProps, queries.samples);


/**
 * Task returning sample parent props from all the way up the view hierarchy
 */
export const chainedParentPropsTask = parentPropsForContainerTask(
  // Fake this for now until we have a parent
  of(Ok({
    currentRegion: {
      // This is needed so we can scale Mapbox based on absolute numbers
      style: {
        width: 500,
        height: 500
      },
      region: {
        // This matches a testConfig Region
        id: "1",
        mapbox: {
          viewport: {
            zoom: 10
          }
        }
      }
    },

  })),
  // Normally this is the parent views function
  props => ({views: props}),
  'currentRegion'
);

/**
 * Task returning sample props from all the way up the view hierarchy
 */
//export const chainedSamplePropsTask = propsFromParentPropsHelperTask(chainedParentPropsTask, samplePropsTaskMaker);
