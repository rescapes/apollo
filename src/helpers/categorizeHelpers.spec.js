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


import {categorizeStreetviewUrl} from './categorizeHelpers';

describe('categorizeHelpers', () => {
  test('categorizeStreetviewUrl', () => {
    expect(categorizeStreetviewUrl(
      'sidewalk',
      'no',
      'http://maps.googleapis.com/maps/api/streetview?pitch=0&fov=90&key=AIzaSyD_M7p8y3-3PUMgodb-9SJ4TtoJFLKDj6U&size=640x640&location=30.28161,-97.72263&heading=169.94981544395256&y=0',
      {headingLabel: 'left'})
    ).toEqual('no_sidewalk_left');
  });
  // Expect yes to be omitted
  expect(categorizeStreetviewUrl(
    'sidewalk',
    'yes',
    'http://maps.googleapis.com/maps/api/streetview?pitch=0&fov=90&key=AIzaSyD_M7p8y3-3PUMgodb-9SJ4TtoJFLKDj6U&size=640x640&location=30.28161,-97.72263&heading=169.94981544395256&y=0',
    {headingLabel: 'left'})
  ).toEqual('sidewalk_left');
});
