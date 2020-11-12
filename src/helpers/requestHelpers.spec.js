/**
 * Created by Andy Likuski on 2018.04.23
 * Copyright (c) 2018 Andy Likuski
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the 'Software'), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED 'AS IS', WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 */

import {
  resolveGraphQLType,
  formatOutputParams,
  formatInputParams,
  mapQueryContainerToNamedResultAndInputs,
  pickGraphqlPaths,
  pickGraphqlPathsOver,
  omitClientFields,
  omitUnrepresentedOutputParams,
  createReadInputTypeMapper,
  relatedObjectsToIdForm
} from './requestHelpers';
import Result from 'folktale/result';
import T from 'folktale/concurrency/task'
const {of} = T;
import R from 'ramda';
import {reqStrPathThrowing, reqStrPath, taskToPromise, pickDeepPaths} from 'rescape-ramda';
import {defaultSettingsOutputParams} from './defaultSettingsStore';
import {print} from 'graphql';
import AC from '@apollo/client';
const {gql} = AC

describe('requestHelpers', () => {

  const outputParams = {
    id: 1,
    name: 1,
    data: {
      settings: {
        defaultLocation: 1,
        stages: {
          key: 1,
          target: 1
        }
      }
    }
  };

  test('formatOutputParameters', () => {
    const output = formatOutputParams(
      outputParams
    );
    expect(print(gql`query fooQuery { foo ${output} }`)).toEqual(
      `query fooQuery {
  foo
  id
  name
  data {
    settings {
      defaultLocation
      stages {
        key
        target
      }
    }
  }
}
`);
  });

  test('pickPaths', () => {
    const output = pickGraphqlPaths(['id', 'name', 'data.settings.stages.key'], outputParams);
    expect(output).toEqual({
      data: {
        settings: {
          stages: {
            key: 1
          }
        }
      },
      id: 1,
      name: 1
    });
  });

  test('pickGraphqlPathsOver', () => {
    const output = pickGraphqlPathsOver(R.lensProp('data'), ['settings.stages.key'], outputParams);
    expect(output).toEqual(
      {
        data: {
          settings: {
            stages: {
              key: 1
            }
          }
        },
        id: 1,
        name: 1
      }
    );
  });

  test('formInputParameters', () => {
    const inputParams = {
      id: 1,
      name: 'Bo',
      data: {
        settings: [
          'defaultLocation',
          {
            'stages': [
              'key',
              'targets'
            ]
          }
        ]
      }
    };
    const input = formatInputParams(inputParams);
    expect(input).toMatchSnapshot();
  });

  test('resolveGraphQLType', () => {
    const inputParamTypeMapper = {
      'data': 'DataTypeRelatedReadInputType'
    };
    const resolve = resolveGraphQLType(inputParamTypeMapper);
    expect(resolve('data', {})).toEqual('DataTypeRelatedReadInputType');
    expect(resolve('foo', 23)).toEqual('Int');
    expect(resolve('foo', 'goo')).toEqual('String');
    expect(resolve('foo', 23.1)).toEqual('Float');
    expect(resolve('foo', Number)).toEqual('Number');
  });

  test('mapQueryContainerToNamedResultAndInputs', async () => {
    const result = await taskToPromise(mapQueryContainerToNamedResultAndInputs(
      of({data: 'superduper'}))
    );
    expect(result).toEqual(Result.Ok({data: 'superduper'}));
    const result1 = await taskToPromise(mapQueryContainerToNamedResultAndInputs(
      of({data: {flowing: {nose: 'superduper'}}}),
      'flowing.nose',
      'nose'
    ));
    expect(result1).toEqual(Result.Ok({data: {nose: 'superduper'}}));
    const responsePathError = await taskToPromise(mapQueryContainerToNamedResultAndInputs(
      of({data: {flowing: {nose: 'superduper'}}}),
      'flowing.tooth',
      'nose'
    ));
    expect(R.length(reqStrPathThrowing('errors', responsePathError.merge()))).toEqual(1);
    const responseError = await taskToPromise(mapQueryContainerToNamedResultAndInputs(
      of({errors: [new Error('What the heck?')]}))
    );
    expect(R.length(reqStrPathThrowing('errors', responseError.merge()))).toEqual(1);

    // If we have a custom resolver
    const customResult = await taskToPromise(mapQueryContainerToNamedResultAndInputs(
      of({data: {flowings: [{nose: {wipe: 'superduper'}}, {nose: {wipe: 'cavity'}}]}}),
      // This demonstrates extracting an embedded array of noses from results
      // Note that it has to return a single Result.Ok
      R.compose(
        R.sequence(Result.Ok),
        result => result.chain(R.map(reqStrPath('nose'))),
        reqStrPath('flowings')
      ),
      'noses'
    ));
    expect(customResult).toEqual(Result.Ok({data: {noses: [{wipe: 'superduper'}, {wipe: 'cavity'}]}}));
  });

  test('omitClientFields', () => {
    expect(omitClientFields(defaultSettingsOutputParams)).toEqual(
      {
        id: 1,
        key: 1,
        data: {
          domain: 1,
          api: {
            protocol: 1,
            host: 1,
            port: 1,
            path: 1
          },
          // Overpass API configuration to play nice with the server's strict throttling
          overpass: {
            cellSize: 1,
            sleepBetweenCalls: 1
          },
          mapbox:
            {
              viewport: {
                zoom: 1,
                latitude: 1,
                longitude: 1
              }
            }
        }
      }
    );
  });

  test('omitNonMatchingOutputParams', () => {
    const outputParams = {
      id: 1,
      deleted: 1,
      key: 1,
      name: 1,
      createdAt: 1,
      updatedAt: 1,
      'selection @client': {
        isSelected: 1
      },
      geojson: {
        type: 1,
        features: {
          type: 1,
          id: 1,
          geometry: {
            type: 1,
            coordinates: 1
          },
          properties: 1
        },
        generator: 1,
        copyright: 1
      },
      data: {
        locations: {
          params: 1
        },
        mapbox: {
          viewport: {
            latitude: 1,
            longitude: 1,
            zoom: 1
          }
        }
      }
    };
    const props = {
      name: 'Joe',
      key: 'piddlypoe',
      selection: {
        isSelected: true
      },
      geojson: {
        type: 'FeatureCollection',
        features: [
          {
            type: 'circle',
            geometry: {
              type: 'point',
              coordinates: [0, 0]
            }
          },
          {
            type: 'rotary',
            geometry: {
              type: 'point',
              coordinates: [0, 0]
            },
            properties: {whoopy: 'doo'}
          }
        ]
      }
    };

    const actual = omitUnrepresentedOutputParams(props, outputParams);

    expect(actual).toEqual(
      {
        key: 1,
        name: 1,
        'selection @client': {
          isSelected: 1
        },
        geojson: {
          type: 1,
          features: {
            type: 1,
            geometry: {
              type: 1,
              coordinates: 1
            },
            properties: 1
          }
        }
      }
    );
  });

  test('createReadInputTypeMapper', () => {
    expect(createReadInputTypeMapper(
      'location', ['data', 'geojson', 'intersections']
    )).toEqual({
      'data': 'LocationDataTypeofLocationTypeRelatedReadInputType',
      'geojson': 'FeatureCollectionDataTypeofLocationTypeRelatedReadInputType',
      'intersections': '[IntersectionTypeofLocationTypeRelatedReadInputType]'
    });
  });

  test('relatedObjectsToIdForm', () => {
    expect(relatedObjectsToIdForm([
      'drooling.moose',
      'scapegoats',
      'elks.slow',
      'elks.poke.jams',
      'billy',
      'smacky'
    ], {
      drooling: {
        moose: {
          type: 'Canadian',
          id: 1
        }
      },
      scapegoats: [
        {type: 'shepherd', id: 1},
        {type: 'collie', id: 2}
      ],
      elks: [
        {slow: {id: 1, type: 'whoah'}, poke: {jams: []}, id: 1},
        {slow: {id: 2, type: 'begone'}, poke: {jams: [{id: 1, mel: true}, {id: 2, barry: true}]}, id: 2}
      ],
      id: 1,
      name: 'Missoula'
    })).toEqual({
      drooling: {
        moose: {
          id: 1
        }
      },
      scapegoats: [
        {id: 1},
        {id: 2}
      ],
      elks: [
        {slow: {id: 1}, poke: {jams: []}, id: 1},
        {slow: {id: 2}, poke: {jams: [{id: 1}, {id: 2}]}, id: 2}
      ],
      id: 1,
      name: 'Missoula'
    });
  });
});


