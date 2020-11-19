import {filterOutReadOnlyVersionProps, makeMutationRequestContainer} from '../mutationHelpers.js';
import * as R from 'ramda';
import {makeQueryContainer} from '../queryHelpers.js';
import {loggers} from '@rescapes/log';
import {relatedObjectsToIdForm} from '../requestHelpers.js';

export const userStateReadInputTypeMapper = {
  'user': 'UserTypeofUserStateTypeRelatedReadInputType',
  'data': 'UserStateDataTypeofUserStateTypeRelatedReadInputType'
};

const log = loggers.get('rescapeDefault');

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

const RELATED_PROPS = [];

// Every complex input type needs a type specified in graphql. Our type names are
// always in the form [GrapheneFieldType]of[GrapheneModeType]RelatedReadInputType
// Following this location.data is represented as follows:
// TODO These value should be derived from the schema
export const readInputTypeMapper = {
  //'data': 'DataTypeofLocationTypeRelatedReadInputType'
  'geojson': 'FeatureCollectionDataTypeofRegionTypeRelatedReadInputType'
};

/**
 * Normalized region props for for mutation
 * @param {Object} region
 * @return {Object} the props modified
 */
export const normalizeSampleRegionPropsForMutating = region => {
  return R.compose(
    // Make sure related objects only have an id
    region => relatedObjectsToIdForm(RELATED_PROPS, region),
    region => filterOutReadOnlyVersionProps(region)
  )(region);
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
  queryRegions: props => makeQueryContainer(
    {
      options: {
        variables: (props) => {
          return {
            id: parseInt(props.region.id)
          };
        },
        // Pass through error so we can handle it in the component
        errorPolicy: 'all',
        partialRefetch: true
      }
    },
    {
      name: 'region',
      outputParams: regionOutputParams
    },
    normalizeSampleRegionPropsForMutating(props)
  ),
  mutateRegion: props => makeMutationRequestContainer(
    {
      options: {
        variables: (props) => {
          // Only allow the name to be updated
          return R.pick(['id', 'name'], props.region);
        },
        options: {
          update: (store, response) => {
            log.debug(response);
          }
        },
        errorPolicy: 'all',
        partialRefetch: true
      }
    },
    {
      name: 'region',
      outputParams: regionOutputParams
    },
    normalizeSampleRegionPropsForMutating(props)
  )
};

