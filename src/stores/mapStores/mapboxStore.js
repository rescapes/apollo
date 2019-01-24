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
import {makeMutationTask} from '../../helpers/mutationHelpers';
import {v} from 'rescape-validate';
import {makeClientQueryTask, makeQueryTask} from '../../helpers/queryHelpers';
import PropTypes from 'prop-types';
import {of, waitAll} from 'folktale/concurrency/task';
import Result from 'folktale/result';
import {reqStrPathThrowing, resultToTaskNeedingResult, reqStrPath} from 'rescape-ramda';
import {makeRegionsQueryTask} from '../scopeStores/regionStore';
import {makeUserStateMutationTask} from '../userStores/userStore';

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
    userStates: [{
      data: [{
        userGlobal: mapboxFragment,
        userProjects: mapboxFragment
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

export const nullUnless = R.curry((condition, onTrue) => R.ifElse(condition, onTrue, R.always(null)));

/**
 * Given user and scope ids in the arguments (e.g. Region, Project, etc) resolves the mapbox state.
 * The merge precedence is documented above
 *
 * @params {Object} apolloClient The Apollo Client
 * @params {Object} outputParams OutputParams for the query such as regionOutputParams
 * @params {Object} argumentSets Arguments for each query as follows
 * @params {Object} argumentSets.users Arguments to limit the user to zero or one user. If unspecified no
 * user-specific queries are made, meaning no user state is merged into the result
 * @params {Object} argumentSets.regions Arguments to limit the region to zero or one region. If unspecified no
 * region queries are made
 * @params {Object} argumentSets.projects Arguments to limit the project to zero or one project. If unspecified no
 * project queries are made
 * @returns {Task} A Task containing the Regions in an object with obj.data.regions or errors in obj.errors
 */
export const makeMapboxesQueryTask = v(R.curry((apolloClient, outputParams, args) => {
    return R.composeK(
      of(R.mergeAll),
      // Each Result.Ok is mapped to a Task. Result.Errors are mapped to a Task.of
      // [Result] -> [Task Object]
      args => R.map(
        values => R.complement(R.has)('error', values),
        waitAll([

          // The given Region's Mapbox state
          resultToTaskNeedingResult(
            args => R.map(
              value => R.mergeAll([
                reqStrPathThrowing('data.userGlobal.mapbox', value),
                reqStrPathThrowing('data.userRegion.mapbox', value),
              ]),
              makeUserStateQueryTask(
                apolloClient,
                {name: 'userState', readInputTypeMapper},
                userStateMapboxOutputParamsCreator(outputParams),
                args
              )
            ),
            reqStrPath('regions', args)
          ),

          // The given Region's Mapbox state
          resultToTaskNeedingResult(
            args => R.map(
              value => reqStrPathThrowing('data.regions.mapbox', value),
              makeRegionsQueryTask(
                apolloClient,
                {name: 'regions', readInputTypeMapper},
                regionMapboxOutputParamsCreator(outputParams),
                args
              )
            ),
            reqStrPath('regions', args)
          ),

          // Tht Global Mapbox state
          resultToTaskNeedingResult(
            () => R.map(
              value => reqStrPathThrowing('data.settings.mapbox', value),
              makeClientQueryTask(
                apolloClient,
                {name: 'settings', readInputTypeMapper},
                outputParams,
                // No args for global
                {}
              )
            )
          )(Result.Ok({}))
        ])
      )
    )(args);
  }),
  [
    ['apolloClient', PropTypes.shape().isRequired],
    ['outputParams', PropTypes.array.isRequired],
    ['arguments', PropTypes.shape({
      users: PropTypes.shape().isRequired,
      regions: PropTypes.shape().isRequired,
      projects: PropTypes.shape().isRequired
    }).isRequired]
  ], 'makeMapboxesQueryTask');

/**
 * Makes a Region mutation
 * @param {Object} authClient An authorized Apollo Client
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
export const makeRegionMutationTask = R.curry((apolloClient, outputParams, inputParams) => makeMutationTask(
  apolloClient,
  {name: 'region'},
  outputParams,
  inputParams
));
