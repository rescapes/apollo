/**
 * Created by Andy Likuski on 2020.06.09
 * Copyright (c) 2020 Andy Likuski
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 */

import * as R from 'ramda';
import Result from 'folktale/result/index.js';
import {reqStrPathThrowing, strPathOr} from '@rescapes/ramda'

/**
 * Returns a Result.Ok if data is loaded and a Result.Error if the response is loading or an error.
 * If loading the Result.Error has a loading: true key, if an error it has an error: true key
 * data, loading, error, and status are always in the Result object
 * @param apolloResponse
 * @return {*}
 */
export const apolloResult = apolloResponse => {
  return R.ifElse(
    R.prop('data'),
    Result.Ok,
    Result.Error
  )(apolloResponse);
};

/**
 * Returns the data value of the apolloResult if available or else null
 * @param apolloResult
 * @return {*}
 */
export const resultOkOrNull = apolloResult => {
  return apolloResult.matchWith({
    Ok: ({value}) => value,
    Error: () => null
  });
};

/**
 * Converts the Apollo query response with the given response name at response: {data: [responseName]: {}/[]}}
 * to the value at responseName or returns null if the response is loading or an error.
 * This method can be used to give Apollo request response values to components that just need
 * the value or null, and don't care if the value is loading or error. If the component needs to know,
 * the response should be given directly to the component so that it can process it
 * @param {String} responseName The string at {data: {[responseName]: [...]/{...}}
 * @param {Object} response An Apollo request response
 * @returns {Object|List<Objectd>} The single object or list of objects at responseName or null
 * for the loading/error case
 */
export const apolloResponseValueOrNull = (responseName, response) => {
  return R.compose(
    // Return null if status is loading or error
    apolloResult => resultOkOrNull(apolloResult),
    response => R.map(
      // Map the data response to the data value
      response => reqStrPathThrowing(`data.${responseName}`, response),
      apolloResult(response)
    )
  )(response);
};
/**
 * Same as apolloResponseValueOrNull, but takes the first item of the resolved value,
 * which is expected to be an array.
 * @param {String} responseName The string at {data: {[responseName]: [...]}}
 * @param {Object} response An Apollo request response
 * @returns {Object} The single value or null for the loading/error case
 */
export const apolloResponseSingleValueOrNull = (responseName, response) => {
  return R.compose(
    listOrNull => R.head(listOrNull || []),
    response => apolloResponseValueOrNull(responseName, response)
  )(response);
};

/**
 * Like apolloResponseValueOrNull but additionally filters each returned item if not null
 * @param {String} responseName The string at {data: {[responseName]: [...]}}
 * @param {Function} filterItem Unary filter to apply to each item
 * @param {Object} response An Apollo request response
 * @returns {[Object]} List of matching items or empty for no matches or loading/error case
 */
export const apolloResponseFilterOrEmpty = (responseName, filterItem, response) => {
  return R.compose(
    list => R.filter(
      itm => filterItem(itm),
      list
    ),
    R.defaultTo([]),
    response => apolloResponseValueOrNull(responseName, response)
  )(response);
};