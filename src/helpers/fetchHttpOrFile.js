/**
 * Created by Andy Likuski on 2018.03.30
 * Copyright (c) 2018 Andy Likuski
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 */

//https://gist.github.com/joshua-gould/58e1b114a67127273eef239ec0af8989
const fs = require('fs');
const path = require('path');
const nodeFetch = require('node-fetch');
const Request = nodeFetch.Request;
const Response = nodeFetch.Response;

export const fetch = function (url, options) {
  const request = new Request(url, options);
  if (request.url.substring(0, 5) === 'file:') {
    return new Promise((resolve, reject) => {
      const filePath = path.normalize(url.substring('file://'.length));
      if (!fs.existsSync(filePath)) {
        reject(`File not found: ${filePath}`);
      }
      const readStream = fs.createReadStream(filePath);
      readStream.on('open', function () {
        resolve(new Response(readStream, {
          url: request.url,
          status: 200,
          statusText: 'OK',
          size: fs.statSync(filePath).size,
          timeout: request.timeout
        }));
      });
    });
  } else {
    return nodeFetch(url, options);
  }
};