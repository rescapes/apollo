/**
 * Created by Andy Likuski on 2018.07.02
 * Copyright (c) 2018 Andy Likuski
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 */

import {inspect} from 'util';
import ramdaLens from 'ramda-lens';
import pluralize from 'pluralize';
import {
  capitalize,
  compact,
  filterWithKeys,
  flattenObj,
  mapObjToValues,
  mergeDeepAll,
  omitDeepBy,
  pickDeepPaths,
  reqStrPath,
  strPathOr,
  strPathOrNullOk,
  unflattenObj,
  pathOr
} from '@rescapes/ramda';
import * as R from 'ramda';
import Result from 'folktale/result/index.js';

const {mapped, over} = ramdaLens;

// Many of our graphql classes implement versioning. Make sure these values are never submitted in mutations
// since they are managed by the server.
// TODO Such metadata should come by fetching a remote schema from the server and parsing it
export const VERSION_PROPS = ['createdAt', 'updatedAt', 'versionNumber', 'revisionId'];
/**
 * Version output params to add to objects that implement versioning
 */
export const versionOutputParamsMixin = R.fromPairs(R.map(key => [key, 1], VERSION_PROPS));

/**
 * TOOD Replace the input array format with objects since js objects are deterministic
 * Creates graphql output params from the given object.
 * @param {[String|List|Object]} outputParam List, Object, or Scalar containing strings or objects with keys pointing at strings or objects
 * for embedded values. Values should always be camelCased
 * Example
 * [
 * 'foo',
 * 'bar',
 * {
 *   boat: [
 *     'poopDeck',
 *     {
 *      cabin:
 *         [
 *          'galley'
 *        ]
 *    }
 *  ]
 *}
 *]
 * @returns {String} The output params in graphql format
 */
export const formatOutputParams = outputParam => {
  const v = R.cond([
    // Value is a string or number, just return it on one line
    [R.either(R.is(String), R.is(Number)),
      value => [
        `${value}`
      ]
    ],
    [R.is(Array),
      list => R.flatten([
        R.map(item => {
            return `${formatOutputParams(item)}`;
          }, list
        )
      ])
    ],
    [R.is(Object),
      obj => R.flatten(mapObjToValues(
        (value, key) => {
          // Recurse if value is an object. If not, just return key since value is simply truthy to indicate key
          // represent a primitive graphql property
          return R.ifElse(
            R.is(Object),
            v => [
              `${key} {`,
              `${formatOutputParams(v)}`,
              `}`
            ],
            () => [key]
          )(value);
        },
        obj
      ))
    ],
    // Convert null to .... null
    [R.isNil, () => [
      'null'
    ]],
    [R.T, () => {
      throw new Error(`Bad outputParam ${outputParam}`);
    }]
  ])(outputParam);

  return R.join(
    '\n',
    v
  );
};

/**
 * Creates graphql inputparams from the given object
 * @param {[String|List|Object]} inputParam List, Object, or Scalar containing strings or objects with keys pointing at strings or objects
 * for embedded values. Values should always be camelCased
 * @param {boolean} omitOuterBraces omit braces on the first level of recursion. Only needed for embedded input args,
 * not for variable args
 * @param {Number} indentLevel recursively increases
 * Example
 * {
 * foo: 1,
 * bar: 2,
 * {
 *   boat: [
 *     decks: [
 *      'poopDeck',
 *     ],
 *     {
 *      cabin: 'galley'
 *    }
 *  ]
 *}
 *}
 * @returns {String} The input params in graphql format
 */
export const formatInputParams = (inputParam, omitOuterBraces = false, indentLevel = 0) => {
  const indent = R.join('', R.repeat('\t', indentLevel));
  const v = R.cond([
    [R.is(Array),
      list => [
        `${indent}[`,
        R.join(',\n', R.map(item => {
            return [
              `${indent}${formatInputParams(item, omitOuterBraces, indentLevel + 1)}`
            ];
          }, list
        )),
        `${indent}]`
      ]
    ],
    [R.is(Object),
      obj => [
        // Omit bracets at outer level, since outer level is mutationName(inputVar1: {}, inputVar2, {}, etc)
        R.ifElse(R.both(R.equals(0), R.always(omitOuterBraces)), R.always(''), R.always(`${indent}{`))(indentLevel),
        R.join(',\n', mapObjToValues(
          (value, key) => {
            return [
              `${indent}${key}: ${indent}${formatInputParams(value, omitOuterBraces, indentLevel + 1)}`
            ];
          },
          obj
        )),
        R.ifElse(R.both(R.equals(0), R.always(omitOuterBraces)), R.always(''), R.always(`${indent}}`))(indentLevel)
      ]
    ],
    [R.is(String),
      // Value is string, just return it on one line
      value => [
        `${indent}"${value}"`
      ]
    ],
    [R.is(Number),
      // Value is number, just return it on one line
      value => [
        `${indent}${value}`
      ]
    ],
    // Convert null to .... null
    [R.isNil, () => [
      `${indent}null`
    ]],
    [R.T, () => {
      throw new Error(`Bad outputParam ${inputParam}`);
    }]
  ])(inputParam);

  return R.join(
    '\n',
    v
  );
};

/**
 * Resolve the GraphQL Type to pass to the query params.
 * TODO. This should be replaced with reading the schema from the server and using it to derive types
 * @param {String} key The param name. Mapped with inputParamTypeMapper. If a match is found it is used
 * @param {Object} value The param value used to guess the type. This can also be a type if the value isn't known
 * ahead of creating the query, such as Number of String
 * @return {String} The resolved string
 */
export const resolveGraphQLType = R.curry((inputParamTypeMapper, key, value) => {
  const mappedType = R.prop(key, inputParamTypeMapper);
  return R.cond([
    [R.always(mappedType), R.always(mappedType)],
    [Number.isInteger, R.always('Int')],
    [R.is(Number), R.always('Float')],
    // Assume functions are indicating types, e.g. Number, String
    // Construct the type and return it's type. Thus String => 'String', Number => 'Number'
    // There is currently no way to produce other types like Float.
    [R.is(Function), type => R.type(type())],
    // If we have an array look at the first item and resolve its type recursively and wrap it in [...]
    [R.is(Array), type => `[${resolveGraphQLType(inputParamTypeMapper, key, R.head(type))}]`],
    // Map directory anything else, for instance String to 'String'
    [R.T, R.type]
  ])(value);
});


/**
 * Resolves a query container to the query results {data: {[query|mutationName]: ...}} or {errors: []}. Then
 * process that to return a Result.Ok if there is a day and a Result.Error if there is an error. This
 * works on both task that run queries and Apollo Query components.
 * @param {Object} queryContainer Contains {data: ...} or {errors: ...}
 * @param {String|Function} stringPathOrResolver The path to the desired value within the response.data property.
 * If just response.data is desired, leave stringPath and queryName blank. If a function then it expects
 * response.data and returns a Result.Ok with the desired values or Result.Error if values aren't found where expected
 * @param {String} queryName The name of the query to use for the result data structure
 * @return {Task<Result>} Task with Result.Ok with value in {data: {[queryName]: value}} or Result.Error instance
 * If stringPath and queryName are omited, the result Result.Ok just wraps response
 */
export const mapQueryContainerToNamedResultAndInputs = (
  queryContainer, stringPathOrResolver = null, queryName = null
) => {
  return R.map(
    queryContainerResponse => {
      return R.ifElse(
        queryContainerResponse => R.has('errors', queryContainerResponse),
        queryContainerResponse => Result.Error(queryContainerResponse),
        queryContainerResponse => {
          return R.ifElse(
            response => R.isNil(stringPathOrResolver, response),
            // If stringPath is not specified just wrap response in Result.Ok
            response => Result.Ok(response),
            // Otherwise extract the desired value and put it in {data: [queryName]: ...}
            response => R.ifElse(
              () => {
                return R.is(Function, stringPathOrResolver);
              },
              // If stringPathOrResolver is a function call it on response.data, expect it to return a Result.Ok
              response => {
                return R.chain(r => stringPathOrResolver(r), response);
              },
              // If it's a string call reqStrPath, expecting a Result.Ok
              response => {
                return R.chain(
                  r => {
                    return R.ifElse(
                      v => typeof v === 'undefined',
                      // If the result is undefined then this will return a Result.Error
                      () => reqStrPath(stringPathOrResolver, r),
                      v => Result.Ok(v)
                    )(strPathOrNullOk(undefined, stringPathOrResolver, r));
                  },
                  response
                );
              }
            )(reqStrPath('data', response)).map(
              v => {
                return {data: {[queryName]: v}};
              }
            ).mapError(
              // If our path is incorrect, this is probably a coding error, but put it in errors
              error => {
                return {
                  errors: [
                    new Error(`Only resolved ${R.join('.', error.resolved)} of ${R.join('.', error.path)} for response ${inspect(response)}`)
                  ]
                };
              }
            )
          )(queryContainerResponse);
        }
      )(queryContainerResponse);
    },
    queryContainer
  );
};

/**
 * Converts string ids to int. This is needed because Apollo returns strings but expects ints
 * @param {Object} obj The object with a string id
 * @returns {Object} obj The object with an int id
 */
export const objIdToInt = obj => R.over(R.lensProp('id'), parseInt, obj);


/***
 * Picks attributes out of a graphqlListStructure
 * @param {[String]} paths Dot-separated paths that point at the desired attributes. If the path ends
 * at a non-node it will capture everything at the path.
 * @param {[Object|String]} graphqlListStructure
 * @returns {[Object|String]} The pruned graphqlListStructure
 */
export const pickGraphqlPaths = (paths, graphqlListStructure) => {
  return pickDeepPaths(
    paths,
    graphqlListStructure
  );
};

/**
 * Like pickGraphqlPaths put starts at the level of lensPath so only values at a certain key are considered for
 * picking. All other values not matching the lens are left alone and returned
 * @param {Function} lens The lens to the part of the data structure that you want to pick values out of
 * @param {[String]} paths Dot-separated paths that point at the desired attributes. If the path ends
 * at a non-node it will capture everything at the path.
 * @param {[Object|String]} graphqlListStructure
 * @returns {[Object|String]} The pruned graphqlListStructure
 */
export const pickGraphqlPathsOver = (lens, paths, graphqlListStructure) => {
  return R.over(
    lens,
    data => {
      const minimumData = pickDeepPaths(paths, data);
      if (R.compose(R.equals(0), R.length, R.keys)(minimumData)) {
        throw new Error(`dataPaths: ${inspect(paths)} didn't match anything`);
      }
      return minimumData;
    }
  )(graphqlListStructure);
};

/**
 * Uses apolloConfig.options.variables to winnow the given props.
 * @param {Object} apolloConfig
 * @param {Object} apolloConfig.options
 * @param {Function|Object} apolloConfig.options.variables
 * @param props
 * @return {Object} The options with variables transformed from a function to the winnowed props. If apolloConfig.options
 * is not given then {variables: props} is returned. If apolloConfig.options.variables is not given then
 * {other options, variables: props} is returned
 */
export const optionsWithWinnowedProps = (apolloConfig, props) => {
  // If options.variables is specified return options with variables set to variables(props) if variables is a function
  // Else return {..., variables: props}
  return R.over(
    R.lensProp('variables'),
    funcObjOrNull => {
      if (strPathOr(false, 'options.skip', apolloConfig)) {
        // We can't winnow the props if the component doesn't have the props it needs, as indicated by options.skip
        return {};
      }
      return R.ifElse(
        R.is(Function),
        func => func(props),
        // Return the object if it's an object or else the props
        maybeObj => maybeObj || props
      )(funcObjOrNull);
    },
    R.propOr({}, 'options', apolloConfig)
  );
};

/**
 * Given an apolloConfig with options.variables, where variables is a function, this runs
 * the props through the variables function to deliver the props that the query will be built upon.
 * @param {Object} apolloConfig Apollo config
 * @param {Object} apolloConfig.options
 * @param {Function|Object} apolloConfig.options.variables A unary function that expects props and returns the winnowed props
 * If an object then props are ignored and these values are returned. This would only occur if the variables were constant,
 * which seems unlikely, but matches Apollo's possible configuration
 * @param {Object} props Props to winnow
 * @returns {Object} The winnowed props
 */
/**
 * Given an apolloConfig with options.variables, where variables is a function, this runs
 * the props through the variables function to deliver the props that the query will be built upon.
 * @param {Object} apolloConfig Apollo config
 * @param {Object} apolloConfig.options
 * @param {Function|Object} apolloConfig.options.variables A unary function that expects props and returns the winnowed props
 * @param {Object} [apolloConfig.options.preserveNulls] Default false. Used only by caching initial values of singletons
 * If an object then props are ignored and these values are returned. This would only occur if the variables were constant,
 * which seems unlikely, but matches Apollo's possible configuration
 * @param {Object} props Props to winnow
 * @returns {Object} The winnowed props
 */
export const _winnowRequestProps = (apolloConfig, props) => {
  const func = strPathOr(R.identity, 'options.variables', apolloConfig);
  const resolvedProps = R.when(R.is(Function), R.applyTo(props))(func);
  // Remove _typename props that might be left from the result of previous Apollo requests from response props such
  // as queryFoo or mutateFoo.
  // Also remove the render and children prop if not done by options.variables. We never want these is our request
  return (strPathOr('options.preserveNulls', apolloConfig) ? R.identity : compact)(R.mapObjIndexed((value, prop) => {
    return R.ifElse(
      prop => R.startsWith('query', prop) || R.startsWith('mutate', prop),
      () => {
        // Deep omit __typename
        return R.compose(
          ...R.map(path => {
            return value => R.when(
              v => pathOr(false, path, v),
              v => {
                return R.over(
                  R.lensPath(path),
                  data => {
                    return data && omitDeepBy(_prop => {
                        return R.startsWith('__typename', _prop);
                      },
                      data
                    );
                  },
                  v
                );
              }
            )(value);
            // Look for __typename here in the queries/mutations
          }, [['data'], ['result', 'data']])
        )(value);
      },
      prop => {
        // Remove render and children
        return R.when(
          () => {
            return R.includes(prop, ['render', 'children']);
          },
          () => null
        )(value);
      }
    )(prop);
  }, resolvedProps));
};

/**
 * Removes @client fields from the outputParams
 * @param {Array|Object} outputParams
 * @return {*}
 */
export const omitClientFields = outputParams => {
  return omitDeepBy(
    value => {
      return R.both(R.is(String), R.includes('@client'))(value);
    },
    outputParams
  );
};

const func = obj => {
  return R.when(Array.isArray,
    R.compose(
      h => {
        return R.when(
          R.is(Object),
          // Recurse if we have an object
          hh => R.mergeDeepWith(func, hh, hh)
        )(h);
      },
      items => {
        // If the first item is an object, they must all be so merge them together deeply
        // The only reason we don't take R.head here is the off chance that one item has a property
        // that the others don't. We want to get every possible property that might be in the array item
        return R.ifElse(
          items => R.compose(R.is(Object), R.head)(items),
          items => mergeDeepAll(items),
          R.head
        )(items);
      }
    )
  )(obj);
};

/**
 * Removes outputParams that are not represented in the given props.
 * This is used for cache writing as we want to write a fragment using output props that match
 * the props being written, and nothing more. Since props have arrays and outputParams do not (because
 * they match graphql syntax). the props are deep converted so that arrays because scalar items
 * that marge all the props of each array item into a single object. Then these modified props can
 * be compared
 * @param {Object} props Props
 * @param outputParams
 * @return {*}
 */
export const omitUnrepresentedOutputParams = (props, outputParams) => {
  const propsWithScalarizedArrays = R.mergeDeepWith(
    func,
    props,
    props
  );
  return R.compose(
    flattenedOutputParams => unflattenObj(flattenedOutputParams),
    flattenedOutputParams => {
      return filterWithKeys(
        (v, path) => {
          const pathWithDirectives = R.replace(/ @client/g, '', path);
          return typeof strPathOrNullOk(undefined, pathWithDirectives, propsWithScalarizedArrays) !== 'undefined';
        },
        flattenedOutputParams
      );
    },
    flattenObj
  )(outputParams);
};


/**
 * Generates RelatedReadInputType names for a class based on the given keys
 * These are needed for querying related types so we know what related graphene types to use for the variable
 * declaration. These are based on conventions in rescape-graphene.
 * TODO it would be much better to generate these by reading the remote schema
 * @param {String} className Lower case class name, such as 'location'
 * @param [{String}] keys Related types and json types that the query might need to filtered by
 * @return {Object} And object with a key matching each of keys and each value in the form
 * ${capitalizedClassName}${capitalize(key)}Typeof${capitalizedClassName}TypeRelatedReadInputType`,
 * which matches the way rescape-graphene dynamically creates read input types
 * Exceptions are for geojson keys, which result in `FeatureCollectionDataTypeof${capitalizedClassName}TypeRelatedReadInputType`
 */
export const createReadInputTypeMapper = (className, keys) => {
  const capitalizedClassName = capitalize(className);
  return R.fromPairs(
    R.map(key => {
      return [key,
        R.cond(
          [
            [
              R.equals('geojson'), key => {
              // Geojson case, key becomes FeatureCollectionData
              return `FeatureCollectionDataTypeof${capitalizedClassName}TypeRelatedReadInputType`;
            }
            ],
            [
              R.equals('data'), key => {
              // Put the class name at the start, since the data's type name is LocationDataType, etc
              return `${capitalizedClassName}${capitalize(key)}Typeof${capitalizedClassName}TypeRelatedReadInputType`;
            }
            ],
            [
              key => pluralize.isPlural(key),
              key => {
                // Remove the plural ending for to-manys and put in an array
                const depluralizedKey = pluralize.singular(key);
                return `[${capitalize(depluralizedKey)}Typeof${capitalizedClassName}TypeRelatedReadInputType]`;
              }
            ],
            [
              R.T,
              key => {
                return `${capitalize(key)}Typeof${capitalizedClassName}TypeRelatedReadInputType`;
              }
            ]
          ]
        )(key)
      ];
    }, keys)
  );
};

/**
 * Converts the objects specified by relatedPropPaths within props to their id form.
 * Works for toOne and toMany relations. This prevents passing values to the API that it neither expects
 * nor needs. The only time this should be used is for dependent objects that can be created at the
 * same time as the main object. For instance, a type Scenario might have ScenarioLocations that can
 * be created by specifying {location: {id: ...}} in the ScenarioLocation object. So in that case we wouldn't
 * want to strip out location
 * @param {[String]} relatedPropPaths list of paths toOne and toMany objects. If they aren't at the the top level,
 * use dot syntax: 'foo.bars'. Note that toMany objects must be detected as plural by pluralize.isPlural
 * so the correct lens can be created to handle arrays
 * @param {Object} [relatedPropPathsToAllowedFields] Optional lookup to allow a related prop path to reduce
 * to something more than id. For instance is a related prop path points to an object that is allowed to be
 * mutated when the main object is mutated, this might be {'some.replaced.path': {'name', 'geojson', 'data'}}
 * (id is always included). In this case the object at someReplacedPath would be reduced to keys name, geojson, data, id
 * instead of down to just id
 * @param {Object} props The props to process
 * @returns {Object} The modified props
 */
export const relatedObjectsToIdForm = ({relatedPropPaths, relatedPropPathsToAllowedFields={}}, props) => {
  const updatedProps = R.reduce((props, propPath) => {
      const propsPathList = R.split('.', propPath);
      const lens = R.compose(...R.chain(
        R.ifElse(
          // E.g. moose is both plural and singular, so is treated as singular
          // Also don't treat 'data' as plural. This is a special case
          key => R.complement(R.or)(
            pluralize.isSingular(key),
            R.equals('data', key)
          ),
          // Array property. Used mapped to create a lens into each item
          str => [R.lensProp(str), mapped],
          str => [R.lensProp(str)]
        ),
        propsPathList
      ));
      try {
        return over(
          lens,
          obj => {
            return R.when(
              R.identity,
              // If relatedPropPathsToAllowedFields contains an entry for propPath, do a custom pick. Otherwise
              // just pick id
              obj => R.pick(
                R.concat(['id'], R.propOr([], propPath, relatedPropPathsToAllowedFields)),
                obj
              )
            )(obj);
          },
          props
        );
      } catch (e) {
        // ramdaLens' over isn't written correctly, so it throws when props are undefined. Ignore it.
        if (R.is(TypeError, e)) {
          return props;
        } else {
          throw e;
        }
      }
    },
    props,
    relatedPropPaths
  );
  // Omit anything that didn't exist
  return omitDeepBy((k, v) => typeof (v) === 'undefined', updatedProps);
};