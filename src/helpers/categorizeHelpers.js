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

import * as R from 'ramda';
import {compact} from 'rescape-ramda';

/**
 * Creates a categorization for the given variable name and value
 * in the form [variableValue]_[variableName]_[headingType]
 * where value proceeds to match the VML category convention of yes_something, no_something and headingType
 * is extracting from the Steetview parameters to indicate which way the camera is looking (e.g. 'left', 'right', 'center'
 * The heading might not matter for some variables, like vehicle lanes, but matters for variables like sidewalks
 * @param {String} variableName e.g. sidewalk
 * @param {String} variableValue e.g. sidewalk value. Presumably this needs to be 'yes' or 'no' since that is
 * what VML categorization expects
 * @param {String} The streetview url
 * @param {Object} The param object representing the streetview params. Only headingLabel is used, which actually
 * isn't passed to streetview but is used to calculate the absolute heading
 * @returns {String} The category name, e.g. no_sidewalk_left
 */
export const categorizeStreetviewUrl = R.curry((variableName, variableValue, url, params) => {
  // Convert yest to ''
  const value = R.cond([
    [R.equals('yes'), R.always(null)],
    [R.T, R.identity]
  ])(variableValue);
  return R.join('_', compact([value, variableName, R.prop('headingLabel', params)]));
});