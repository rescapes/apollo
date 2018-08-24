/**
 * Created by Andy Likuski on 2018.07.31
 * Copyright (c) 2018 Andy Likuski
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 */
import {createSelectorResolvedSchema} from '../schema/selectorResolvers';
import {createSampleConfig, createSchema} from 'rescape-sample-data';

/**
 * Schema using selectors for resolvers. TODO these will be changed to use apollo-link-state
 * @return {*}
 */
export const createTestSelectorResolvedSchema = () => {
  const sampleConfig = createSampleConfig();
  const schema = createSchema();
  return createSelectorResolvedSchema(schema, sampleConfig);
}

export const stateLinkResolvers = {
  Mutation: {
    updateNetworkStatus: (_, {isConnected}, {cache}) => {
      const data = {
        networkStatus: {
          __typename: 'NetworkStatus',
          isConnected
        }
      };
      cache.writeData({data});
      return null;
    }
  }
}

export const testLoginCredentials = {username: "test", password: "testpass"};

export const testConfig = {
  // Settings is merged into the overall application state
  settings: {
    domain: 'localhost',
    api: {
      protocol: 'http',
      host: 'localhost',
      port: '8000',
      path: '/graphql/'
    },
    /*
    // Graphcool configuration. This probably belongs in a graphcool config
    graphcool: {
      userId: 'graphcool-user-id',
      authTokenKey: 'graphcool-auth-token',
      serviceIdKey:'cjajyycub38710185wt87zsm8',
      // This is just from the tutorial code
      linksPerPage: 5,
    },
    */
    // Overpass API configuration to play nice with the server's strict throttling
    overpass: {
      cellSize: 100,
      sleepBetweenCalls: 1000
    },
    markers: {},
    mapbox: {
      mapboxApiAccessToken: 'pk.eyJ1IjoiY2Fsb2NhbiIsImEiOiJjaXl1aXkxZjkwMG15MndxbmkxMHczNG50In0.07Zu3XXYijL6GJMuxFtvQg',
      // This will probably not be used unless we need to cluster something on the map
      iconAtlas: 'data/location-icon-atlas.png',
      // ditto
      showCluster: true,
      showZoomControls: true,
      // Universal Mapbox parameters to apply to any mapbox instance
      preventStyleDiffing: false
    },
    cycle: {
      drivers: {
        api: 'HTTP'
      }
    }
  }
};

export const sampleConfig = createSampleConfig(testConfig);
