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
import Result from 'folktale/result';

/**
 * Returns a Result.Ok if data is loaded and a Result.Error if the response is loading or an error.
 * If loading the Result.Error has a loading: true key, if an error it has an error: true key
 * data, loading, error, and status are always in the Result object
 * @param apolloResponse
 * @return {*}
 */
export const apolloResult = apolloResponse => {
  const props = R.props(['data', 'loading', 'error', 'status'], apolloResponse);
  return R.ifElse(
    R.prop('data'),
    Result.Ok,
    Result.Error
  )(props);
};

/**
 * Returns the data value of the apolloResult if available or else null
 * @param apolloResult
 * @return {*}
 */
export const apolloResultDataOrNull = apolloResult => {
  return apolloResult.matchWith({
    Ok: ({value}) => value,
    Error: () => null
  });
};