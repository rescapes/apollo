/**
 * Created by Andy Likuski on 2020.03.17
 * Copyright (c) 2020 Andy Likuski
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 */
import R from 'ramda';
import {omitDeep} from 'rescape-ramda'

describe('clientHelpers', () => {
  test('typePoliciesWithMergeObjects', () => {
    expect(omitDeep(['merge'], typePoliciesWithMergeObjects([
        {
          type: 'SettingsType',
          fields: ['data']
        },
        {
          type: 'BettingType',
          fields: ['deck', 'tricks'],
        }
      ])
    )).toEqual(
      {
        SettingsType: {
          fields: {
            data: {
              // merge function
            }
          }
        },
        BettingType: {
          fields: {
            deck: {
              // merge function
            },
            tricks: {
              // merge function
            }
          }
        }
      }
    );
  });
});
/**
 * Create a typePolicies object that merges specified fields. This is needed so that non-normalized types
 * that are sub objects of normalized types property merge existing data with incoming. In our case this
 * is so that cache-only survives when data is loaded from the server. I produces typePolicies such as:
 * {
      SettingsType: {
        fields: {
          data: {
            merge(existing, incoming, { mergeObjects }) {
              // https://www.apollographql.com/docs/react/v3.0-beta/caching/cache-field-behavior/
              return mergeObjects(existing, incoming);
            },
          },
        },
      }
    }
 This is passed to InMemoryCache's typePolicies argument
 * @param {[Object]} typesWithFields list of objects with a type and field
 * @param {String} typesWithFields[].type The type, such as 'SettingsType'. Make sure this name matches
 * the __typename returned by the server,.
 * @param {[String]} typesWithFields[].fields List of fields to apply the merge function to
 */
export const typePoliciesWithMergeObjects = typesWithFields => {
  // Each type
  return R.mergeAll(
    R.map(
      ({type, fields}) => {
        return {
          [type]: {
            // Each field
            fields: R.mergeAll(
              R.map(
                field => {
                  return {
                    [field]: {
                      merge(existing, incoming, {mergeObjects}) {
                        // https://www.apollographql.com/docs/react/v3.0-beta/caching/cache-field-behavior/
                        return mergeObjects(existing, incoming);
                      }
                    }
                  };
                }, fields
              )
            )
          }
        };
      },
      typesWithFields
    )
  );
};