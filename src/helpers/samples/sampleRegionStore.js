import {filterOutReadOnlyVersionProps, makeMutationRequestContainer} from '../mutationHelpers.js';
import * as R from 'ramda';
import {makeQueryContainer} from '../queryHelpers.js';
import {loggers} from '@rescapes/log';
import {getPathObjects} from '../requestHelpers.js';
import {reqStrPathThrowing, strPathOr} from '@rescapes/ramda';

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
    region => getPathObjects({relatedPropPaths: RELATED_PROPS}, region),
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

export const sampleQueryRegionsContainer = (apolloConfig, {}, props) => {
  return makeQueryContainer(
    R.merge(
      apolloConfig,
      {
        options: {
          variables: props => {
            // These don't need to be limited, just doing for simplicity
            return R.pick(
              ['id', 'key', 'keyIn', 'name', 'nameIn'],
              props.region
            );
          },
          // Pass through error so we can handle it in the component
          errorPolicy: 'all',
          partialRefetch: true
        }
      }
    ),
    {
      name: 'regions',
      outputParams: regionOutputParams
    },
    props
  );
};

export const sampleMutateRegionContainer = (apolloConfig, {}, props) => {
  return makeMutationRequestContainer(
    R.merge(
      apolloConfig,
      {
        options: {
          variables: (props) => {
            // Only allow the name to be updated
            return R.ifElse(
              R.prop('id'),
              region => R.pick(['id', 'name', 'deleted'], region),
              region => R.pick(['id', 'key', 'name'], region)
            )(normalizeSampleRegionPropsForMutating(props.region));
          },
          update: (store, {data, ...rest}) => {
            const region = strPathOr(null,  'updateRegion.region', data)
            if (R.propOr(false, 'deleted', region)) {
              // Evict all regions queries. It would be better to only
              // evict those that matched our object, but this isn't  possible
              store.evict({ fieldName: 'regions' });
            }
          },

          errorPolicy: 'all',
          partialRefetch: true
        }
      }
    ),
    {
      name: 'region',
      outputParams: regionOutputParams
    },
    props
  );
};

// Each query and mutation expects a container to compose then props
export const apolloContainers = {
  // Creates a function expecting a component to wrap and props
  queryRegions: sampleQueryRegionsContainer,
  mutateRegion: sampleMutateRegionContainer
};

