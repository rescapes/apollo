import {readInputTypeMapper} from './mapStores/mapboxStore';
import {makeClientQueryTask} from '../helpers/queryHelpers';

/**
 * Created by Andy Likuski on 2018.12.31
 * Copyright (c) 2018 Andy Likuski
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 */

const x ={
  // Settings is merged into the overall application state
  settings: {
    domain: 'localhost',
      api: {
      protocol: 'http',
        host: 'localhost',
        port: '8008',
        path: '/graphql/'
    },
    // Used to authenticate with the API above in tests
    testAuthorization: {
      username: 'test',
        password: 'testpass'
    },
    // Overpass API configuration to play nice with the server's strict throttling
    overpass: {
      cellSize: 100,
        sleepBetweenCalls: 1000
    },
    markers: {},
    mapbox: {
      mapboxApiAccessToken: 'pk.eyJ1IjoiY2Fsb2NhbiIsImEiOiJjaXl1aXkxZjkwMG15MndxbmkxMHczNG50In0.07Zu3XXYijL6GJMuxFtvQg',
        // Initial viewport
        viewport: {

      },
      // This will probably not be used unless we need to cluster something on the map
      iconAtlas: 'data/location-icon-atlas.png',
        // ditto
        showCluster: true,
        showZoomControls: true,
        // Universal Mapbox parameters to apply to any mapbox instance
        preventStyleDiffing: false
    }
  },
  regions: {},
  users: {}
};

