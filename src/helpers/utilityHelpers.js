/**
 * Created by Andy Likuski on 2020.03.25
 * Copyright (c) 2020 Andy Likuski
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 */
import {findMapped, strPathOr, toArrayIfNot} from '@rescapes/ramda';
import * as R from 'ramda';
import {isNode} from "browser-or-node";

/**
 * Used to give an id to an item based on the id of a child object in that item. Example
 * item = {
 *   userRegions: {
 *     region: {id: 1},
 *     data: {}
 *   }
 * }
 * idPathLookup = {userRegions: ['region.id', 'region.__ref']}
 * propKey = 'userRegions'
 * This will return 1 since region.id is a path to a non-nul value in item.
 *
 * For a given object and propKey, look up the propKey in the idPathLookup to get the possible paths in item
 * that point to a unique id. Return the first non-null value in item mapped by one of the paths.
 * @param {Object} [idPathLookup] Object keyed by propKeys and valued by list of strings or a single string path.
 * If a key matching propKey exists then the first value in item[key] matching a path value will be returned.
 * The default path for any propKey is 'id', so idPathLookup can be null or missing propKeys
 * @param {String} propKey property key of item to find an id for
 * @param {Object} item Item to search
 * @return {*} The first found value representing an id or item[propKey]. Throws if no non null value is found
 */
export const firstMatchingPathLookup = (idPathLookup, propKey, item) => {
  // Find the matching id paths(s) or default to id
  const idPaths = toArrayIfNot(R.propOr('id', propKey, idPathLookup));
  const value = findMapped(idPath => {
      return strPathOr(
        null,
        idPath,
        item
      );
    },
    idPaths
  );
  // If we don't get an identifier, it's time to give up on merging objects. Return null.
  // This will cause mergeDeepWithRecurseArrayItemsByRight return right values of two arrays
  // being merged or the right value of two objects being merged
  if (R.isNil(value)) {
    return null;
  }
  return value;
};

export const defaultNode = module => {
  return isNode ? module.default : module;
};