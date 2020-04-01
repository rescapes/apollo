import {makeMutationRequestContainer} from '../mutationHelpers';

/**
 * Created by Andy Likuski on 2020.04.01
 * Copyright (c) 2020 Andy Likuski
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 */


// Every complex input type needs a type specified in graphql. Our type names are
// always in the form [GrapheneFieldType]of[GrapheneModeType]RelatedReadInputType
// Following this location.data is represented as follows:
// TODO These value should be derived from the schema
export const readInputTypeMapper = {
  //'data': 'DataTypeofLocationTypeRelatedReadInputType'
  'geojson': 'FeatureCollectionDataTypeofRegionTypeRelatedReadInputType'
};

export const regionOutputParams = {
  id: 1,
  deleted: 1,
  key: 1,
  name: 1,
  createdAt: 1,
  updatedAt: 1,
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
    }
  }
};

// Each query and mutation expects a container to compose then props
export const apolloContainers = {
  // Creates a function expecting a component to wrap and props
  queryRegions: props => makeMutationRequestContainer(
    {
      options: {
        variables: (props) => {
          return {
            id: parseInt(props.region.id)
          };
        },
        // Pass through error so we can handle it in the component
        errorPolicy: 'all'
      }
    },
    {
      name: 'region',
      outputParams: regionOutputParams
    },
    props
  ),
  mutateRegion: props => makeMutationRequestContainer(
    {
      options: {
        variables: (props) => {
          return R.propOr({}, 'region', props);
        },
        errorPolicy: 'all'
      }
    },
    {
      name: 'region',
      outputParams: regionOutputParams
    },
    props
  )
};
