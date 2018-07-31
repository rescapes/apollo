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
import gql from 'graphql-tag';
import { printSchema } from 'graphql/utilities/schemaPrinter'
import {getCurrentConfig, createInitialState, createSimpleResolvedSchema, createSchema, createSampleConfig, privateConfig} from 'rescape-sample-data';
import {reqStrPath} from 'rescape-ramda';
import * as Result from 'folktale/result';
import {mockApolloClientWithSamples} from 'rescape-helpers-test'
const initialState = createInitialState(getCurrentConfig());
import createApolloClient from './apolloClient'
import {config} from 'rescape-sample-data'
const {graphql: {url}} = config;

describe('apolloClient', () => {
  test('apolloClient with sample data', async () => {
    const stateLinkResolvers
    const client = createApolloClient({url, stateLinkResolvers})
    const schema = createSchema();
    const sampleConfig = createSampleConfig(privateConfig);
    const response = await mockApolloClientWithSamples(initialState, createSimpleResolvedSchema(schema, sampleConfig)).query({
        query: gql`
    query region($regionId: String!) {
        store {
            region(id: $regionId) {
                id
                name
                mapbox {
                  viewport {
                    latitude
                    longitude
                    zoom
                  }
                }
            },
        }
    }`,
        variables: {regionId: "belgium"}
      }
    );
    expect(reqStrPath('data.store.region.id', response)).toEqual(Result.Ok('belgium'));
  });
});
