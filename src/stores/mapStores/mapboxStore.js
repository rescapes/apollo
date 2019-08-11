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

import {graphql} from 'graphql';
import * as R from 'ramda';
import {makeMutationRequestContainer} from '../../helpers/mutationHelpers';
import {v} from 'rescape-validate';
import {makeQueryContainer} from '../../helpers/queryHelpers';
import PropTypes from 'prop-types';
import {of, waitAll} from 'folktale/concurrency/task';
import Result from 'folktale/result';
import {reqStrPathThrowing, resultToTaskNeedingResult, reqStrPath} from 'rescape-ramda';
import {makeRegionsQueryContainer} from '../scopeStores/regionStore';
import {makeUserStateQueryContainer} from '../userStores/userStore';
import {makeProjectsQueryContainer} from '../scopeStores/projectStore';

// Every complex input type needs a type specified in graphql. Our type names are
// always in the form [GrapheneFieldType]of[GrapheneModeType]RelatedReadInputType
// Following this location.data is represented as follows:
// TODO These value should be derived from the schema
export const readInputTypeMapper = {
  //'data': 'DataTypeofLocationTypeRelatedReadInputType'
  'geojson': 'FeatureCollectionDataTypeofRegionTypeRelatedReadInputType'
};

/**
 * Mapbox state of Global, UserGlobal, UserProjects
 * @type {*[]}
 */
export const mapboxOutputParamsFragment = [
  {
    mapbox: [{
      viewport: [
        'latitude',
        'longitude',
        'zoom'
      ]
    }]
  }
];


/**
 * Creates state output params
 * @param [Object] mapboxFragment The mapboxFragment of the params
 * @return {*[]}
 */
export const userStateMapboxOutputParamsCreator = mapboxFragment => [
  {
    data: [{
      userGlobal: mapboxFragment,
      userProjects: mapboxFragment
    }]
  }
];

export const projectMapboxOutputParamsCreator = mapboxFragment => [
  {
    projects: [{
      userStates: [{
        data: [{
          userGlobal: mapboxFragment,
          userRegions: mapboxFragment
        }]
      }]
    }]
  }
];

export const regionMapboxOutputParamsCreator = mapboxFragment => [
  {
    regions: [{
      userStates: [{
        data: [{
          userGlobal: mapboxFragment,
          userProjects: mapboxFragment
        }]
      }]
    }]
  }
];


export const scopeObjMapboxOutputParamsCreator = (scopeName, mapboxFragment) => [
  {
    [`${scopeName}s`]: [{
      data: [{
        mapbox: mapboxFragment,
        userGlobal: mapboxFragment,
        userProjects: mapboxFragment
      }]
    }]
  }
];

/**
 * @file
 * The state of Mapbox is determined in increasing priority by:
 * Global
 *  Queries:
 *      viewport, style
 *
 * Region that is specified
 *  Queries:
 *      geojson (bounds override Global viewport)
 *
 * Project that is specified
 *  Queries:
 *      locations (geojson and properties, combined geojson overrides Region viewport)
 *
 * User Global
 *  Queries:
 *      style (overrides global)
 *  Mutations:
 *      style
 *
 * User Project for specified Project
 *  Queries:
 *      viewport (user input overrides Project viewport)
 *      location selections
 *  Mutations
 *      viewport
 *      location selections
 */

/**
 * Given user and scope ids in the arguments (e.g. Region, Project, etc) resolves the mapbox state.
 * The merge precedence is documented above
 *
 * @params {Object} apolloClient The Apollo Client
 * @params {Object} outputParams OutputParams for the query such as regionOutputParams
 * @params {Object} component The Apollo component for component queries
 * @params {Object} propSets Arguments for each query as follows
 * @params {Object} propSets.users Arguments to limit the user to zero or one user. If unspecified no
 * user-specific queries are made, meaning no user state is merged into the result
 * @params {Object} propSets.regions Arguments to limit the region to zero or one region. If unspecified no
 * region queries are made
 * @params {Object} propSets.projects Arguments to limit the project to zero or one project. If unspecified no
 * project queries are made
 * @returns {Task} A Task containing the Regions in an object with obj.data.regions or errors in obj.errors
 */
export const makeMapboxesQueryResultTask = v(R.curry((apolloConfig, outputParams, component, propSets) => {
    return R.composeK(
      of(R.mergeAll),
      // Each Result.Ok is mapped to a Task. Result.Errors are mapped to a Task.of
      // [Result] -> [Task Object]
      ({propSets, component}) => R.map(
        values => R.complement(R.has)('error', values),
        waitAll([
          // The given Region's Mapbox state
          resultToTaskNeedingResult(
            props => {
              return R.map(
                value => R.mergeAll([
                  reqStrPathThrowing('data.userGlobal.mapbox', value),
                  reqStrPathThrowing('data.userRegion.mapbox', value)
                ]),
                // Query for the user state by id
                makeUserStateQueryContainer(
                  apolloConfig,
                  {outputParams: userStateMapboxOutputParamsCreator(outputParams)},
                  component,
                  props
                )
              );
            },
            // user arg is required
            reqStrPath('user', propSets)
          ),

          // The optional given Project's Mapbox state
          resultToTaskNeedingResult(
            args => R.map(
              value => reqStrPathThrowing('data.projects.mapbox', value),
              makeProjectsQueryContainer(
                apolloConfig,
                {name: 'regions', readInputTypeMapper, outputParams: projectMapboxOutputParamsCreator(outputParams)},
                component,
                args
              )
            ),
            reqStrPath('project', propSets)
          ),

          // The optional given Region's Mapbox state
          resultToTaskNeedingResult(
            args => R.map(
              value => reqStrPathThrowing('data.regions.mapbox', value),
              makeRegionsQueryContainer(
                apolloConfig,
                {name: 'regions', readInputTypeMapper, outputParams: regionMapboxOutputParamsCreator(outputParams)},
                component,
                args
              )
            ),
            reqStrPath('region', propSets)
          ),

          // Tht Global Mapbox state
          resultToTaskNeedingResult(
            () => R.map(
              value => reqStrPathThrowing('data.settings.mapbox', value),
              makeQueryContainer(
                apolloConfig,
                {name: 'settings', readInputTypeMapper, outputParams},
                component,
                // No args for global
                {}
              )
            )
          )(Result.Ok({}))
        ])
      )
    )({propSets, component});
  }),
  [
    ['apolloConfig', PropTypes.shape({apolloClient: PropTypes.shape()}).isRequired],
    ['outputParams', PropTypes.array.isRequired],
    ['component', PropTypes.shape()],
    ['propSets', PropTypes.shape({
      user: PropTypes.shape().isRequired,
      region: PropTypes.shape().isRequired,
      project: PropTypes.shape().isRequired
    }).isRequired]
  ], 'makeMapboxesQueryResultTask');

/**
 * Makes a Region mutation
 * @param {Object} apolloClient An authorized Apollo Client
 * @param [String|Object] outputParams output parameters for the query in this style json format:
 *  ['id',
 *   {
 *        data: [
 *         'foo',
 *         {
 *            properties: [
 *             'type',
 *            ]
 *         },
 *         'bar',
 *       ]
 *    }
 *  ]
 *  @param {Object} inputParams Object matching the shape of a region. E.g.
 *  {id: 1, city: "Stavanger", data: {foo: 2}}
 *  Creates need all required fields and updates need at minimum the id
 *  @param {Task} An apollo mutation task
 */
export const makeRegionMutationTask = R.curry((apolloConfig, outputParams, inputParams) => makeMutationRequestContainer(
  apolloConfig,
  {name: 'region'},
  outputParams,
  inputParams
));
