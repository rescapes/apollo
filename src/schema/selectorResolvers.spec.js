/**
 * Created by Andy Likuski on 2017.11.29
 * Copyright (c) 2017 Andy Likuski
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 */

import {makeGeojsonSelector} from '../selectors/geojsonSelectors';
import {createSelectorResolvedSchema} from './selectorResolvers';
import {createSampleConfig} from 'rescape-sample-data';
import makeSchema from './schema';
import {graphql} from 'graphql';
import * as R from 'ramda';
import {mapped} from 'ramda-lens';
import {activeUserSelectedRegionsSelector, regionSelector} from '../selectors/regionSelectors';
import {mergeDeep} from 'rescape-ramda';

const sampleConfig = createSampleConfig();
const resolvedSchema = createSelectorResolvedSchema(makeSchema(), sampleConfig);

describe('mockExecutableSchema', () => {

  test('queryRegionsSelector', async () => {
    const query = `
        query activeUsersSelectedRegions {
            store {
                regions {
                    id
                    mapbox {
                      viewport {
                        zoom
                      }
                    }
                },
            }
        }`;

    // We expect the resolver to resolve the selected regions for the active user, not all regions
    const regionsFromSelector = activeUserSelectedRegionsSelector(sampleConfig);
    const schemaRegionLens = R.compose(R.lensPath(['data', 'store', 'regions']), mapped, R.lensProp('id'));
    // Here's what we expect back
    const expected = R.view(schemaRegionLens,
      ({
        data: {
          store: {
            regions: regionsFromSelector
          }
        }
      })
    );
    // graphql params are schema, query, rootValue, context, variables
    const regions = await graphql(resolvedSchema, query, {}, {options: {dataSource: sampleConfig}}).then(
      result => R.ifElse(
        R.view(R.lensPath(['data', 'store'])),
        R.view(schemaRegionLens),
        result => {
          throw new Error(`Query error ${result.errors}`);
        }
      )(result)
    );
    expect(regions).toEqual(expected);
  });

  test('query region', async () => {
    const query = `
        query region($id: String!) {
        store {
          region(id: $id) {
            id
            name
          },
        }
      }
    `;
    // We expect the resolver to resolve the selected regions for the active user, not all regions
    const region = R.head(R.values(sampleConfig.regions));
    //const regionFromSelector = regionSelector(sampleConfig, {params: R.pick(['id'], region)});
    const schemaRegionLens = R.lensPath(['data', 'store', 'region']);
    // Here's what we expect back
    const expected =
      ({
        id: region.id,
        name: region.name
      });
    // graphql params are schema, query, rootValue, context, variables
    const result = await graphql(resolvedSchema, query, {}, {options: {dataSource: sampleConfig}}, R.pick(['id'], region)).then(
      result => R.ifElse(
        R.prop('data'),
        R.view(schemaRegionLens),
        (result) => {
          throw new Error(`Query error ${result.errors}`);
        }
      )(result)
    );
    expect(result).toEqual(expected);
  });


  test('query region with children', async () => {
    const query = `
        query regionWithChildren($id: String!) {
        store {
          region(id: $id) {
            id
            name
            mapbox {
              viewport {
                zoom
              }
            }
            geojson {
              osm {
                features {
                  id
                  type
                  geometry {
                    type
                    coordinates
                  }
                  properties
                }
              }
            }
          },
        }
      }
    `;
    // We expect the resolver to resolve the selected regions for the active user, not all regions
    const region = R.head(R.values(sampleConfig.regions));
    const schemaRegionLens = R.lensPath(['data', 'store', 'region']);

    // graphql params are schema, query, rootValue, context, variables
    const result = await graphql(resolvedSchema, query, {}, {options: {dataSource: sampleConfig}}, R.pick(['id'], region)).then(
      result => R.ifElse(
        R.prop('data'),
        R.view(schemaRegionLens),
        (result) => {
          throw new Error(`Query error ${result.errors}`);
        }
      )(result)
    );

    // Here's what we expect back. This is a little messy to account for various resolvers that graphql calls
    const expected = mergeDeep(
      // I want just these properties from the Region
      R.compose(
        // I just want mapbox.viewport.zoom
        R.over(
          R.lensPath(['mapbox', 'viewport']),
          R.pick(['zoom'])
        ),
        // I just want mapbox.viewport
        R.over(
          R.lensProp('mapbox'),
          R.pick(['viewport'])
        ),
        // I just want these from the region.[id|name|mapbox|geojson] geojson is selected below
        R.pick(['id', 'name', 'mapbox'])
      )(regionSelector(sampleConfig, {params: R.pick(['id'], region)})),
      {
        geojson: R.over(
          R.lensProp('osm'),
          // I want just features from region.geojson.osm
          R.pick(['features']),
          // I want just osm from region.geojson
          R.pick(['osm'], makeGeojsonSelector()(sampleConfig, {region}))
        )
      }
    );

    expect(result).toEqual(expected);
  });
});

