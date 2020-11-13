/**
 * Created by Andy Likuski on 2018.05.09
 * Copyright (c} 2018 Andy Likuski
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"}, to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 */
import {mergeDeep} from 'rescape-ramda'
import R from 'ramda';

/**
 * Example of a sankey setting data structure that can be defined on resource.data
 * @type {{settings: {value_key: string, default_location: number[], columns: [string, string, string, string, string], stages: ({name: string, targets: [string], key: string}|{name: string, targets: [string], key: string}|{name: string, targets: [string], key: string}|{name: string, targets: [string, string], key: string}|{name: string, targets: [string], key: string})[], node_name_key: string, location_key: string, stage_key: string}}}
 */
const sample_resource_data = {
  settings: {
    default_location: [4.3517, 50.8503],
    columns: [
      'siteName',
      'location',
      'coordinates',
      'junctionStage',
      'annualTonnage'
    ],
    stage_key: 'junctionStage',
    value_key: 'annualTonnage',
    location_key: 'coordinates',
    node_name_key: 'siteName',
    stages: [
      {key: 'source', name: 'Source', targets: ['conversion']},
      {key: 'conversion', name: 'Conversion', targets: ['distribution']},
      {key: 'distribution', name: 'Distribution', targets: ['demand']},
      {key: 'demand', name: 'Demand', targets: ['reconversion', 'sink']},
      {key: 'reconversion', name: 'Reconversion', targets: ['demand']},
      {key: 'sink', name: 'Sink', targets: []}
    ]
  }
};

export const sampleResources = R.map(
  resource => mergeDeep(
    resource,
    {
      data: sample_resource_data
    }
  ),
  [
    {
      name: 'Minerals',
      data: {
        material: 'Minerals',
        raw_data: [
          'Other Global Imports;Shipments, location generalized;51.309933, 3.055030;Source;22,469,843',
          'Knauf (Danilith} BE;Waregemseweg 156-142 9790 Wortegem-Petegem, Belgium;50.864762, 3.479308;Conversion;657,245',
          "MPRO Bruxelles;Avenue du Port 67 1000 Bruxelles, Belgium;50.867486, 4.352543;Distribution;18,632",
          'Residential Buildings (all typologies};Everywhere in Brussels;NA;Demand;3,882,735',
          'Duplex House Typology;Everywhere in Brussels;NA;Demand;13,544',
          'Apartment Building Typology;Everywhere in Brussels;NA;Demand;34,643',
          'New West Gypsum Recycling;9130 Beveren, Sint-Jansweg 9 Haven 1602, Kallo, Belgium;51.270229, 4.261048;Reconversion;87,565',
          'Residential Buildings (all typologies};Everywhere in Brussels;NA;Sink;120,000',
          'RecyPark South;1190 Forest, Belgium;50.810799, 4.314789;Sink;3,130',
          'RecyPark Nord;Rue du Rupel, 1000 Bruxelles, Belgium;50.880181, 4.377136;Sink;1,162'
        ]
      }
    },
    {
      name: 'Metals',
      data: {
        material: 'Metals',
        raw_data: [
          'Other Global Imports;Shipments, location generalized;51.309933, 3.055030;Source;367,689',
          'Arcelor Steel Belgium;Lammerdries 10, 2440 Geel, Belgium;51.145051, 4.939373;Conversion;27,872',
          'Duplex House Typology;Everywhere in Brussels;NA;Demand;3,048',
          'Apartment Building Typology;Everywhere in Brussels;NA;Demand;18,548',
          'Residential Buildings (all typologies};Everywhere in Brussels;NA;Demand;75,404',
          'Metallo Belgium;Nieuwe Dreef 33, 2340 Beerse, Belgium;51.318025, 4.817432;Reconversion;54,000',
          'Private Sector Collection;Everywhere in Brussels;NA;Sink;96,316',
          'RecyPark South;1190 Forest, Belgium;50.810799, 4.314789;Sink;101',
          'RecyPark Nord;Rue du Rupel, 1000 Bruxelles, Belgium;50.880181, 4.377136;Sink;67'
        ]
      }
    },
    {
      name: 'Wood',
      data: {
        material: 'Wood',
        raw_data: [
          'Forêt de Soignes;Watermael-Boitsfort Belgium ;50.777072, 4.409960;Source;6,288',
          'Germany Imports;Germany, nearest point;50.786952, 6.102697;Source;66,812',
          'Netherlands Imports;Netherlans, nearest point;51.467197, 4.609125;Source;52,352',
          'Other Global Imports;Shipments, location generalized;51.309933, 3.055030;Source;323,384',
          'Barthel Pauls Sawmill;Pôle Ardenne Bois 1, 6671 Bovigny, Belgium;50.259872, 5.933474;Conversion;200,430',
          "Lochten & Germeau;Bd de l’Humanité, 51, 1190 Vorst, Belgium;50.820974, 4.314469;Distribution; NA, only for directional/path",
          'Duplex House Typology;Everywhere in Brussels;NA;Demand;1,955',
          'Apartment Building Typology;Everywhere in Brussels;NA;Demand;11,250',
          'Residential Buildings (all typologies};Everywhere in Brussels;NA;Demand;45,659',
          'Rotor Deconstruction;Prévinairestraat / Rue Prévinaire 58 1070 Anderlecht;50.839714, 4.352730;Reconversion;15,462',
          'PAC Uccle;Boulevard de la Deuxième Armée Britannique 625-667 1190 Forest, Belgium;50.801647, 4.305641;Sink;189',
          'PAC Saint-Josse;Rue Verboeckhaven 39-17 1210 Saint-Josse-ten-Noode, Belgium;50.854094, 4.375173;Sink;126',
          'PAC Woluwe-Saint-Pierre;Avenue du Parc de Woluwe 86-44 1160 Auderghem, Belgium;50.823228, 4.427453;Sink;63.08',
          "PAC d’Auderghem/Watermael-Boitsfort;1860 chaussée de Wavre, 1160 Auderghem;50.809948, 4.445271;Sink;252.32",
          "RecyPark South;1190 Forest, Belgium;50.810799, 4.314789;Sink;668",
          "RecyPark Nord;Rue du Rupel, 1000 Bruxelles, Belgium;50.880181, 4.377136;Sink;445"
        ]
      }
    }
  ]
);


// data would default to Object, so we need to map it to the right type
export const sampleInputParamTypeMapper = {
  'resourceData': 'ResourceRelatedReadInputType'
};
// Default output params for query. Just add more to these as needed.
// Later we'll let the user specify
export const sampleResourceOutputParams = {
  id: 1,
  name: 1,
  data: {
    settings: {
      defaultLocation: 1,
      stages: {
        key: 1,
        targets: 1
      }
    },
    rawData: 1,
    material: 1,
    graph: {
      'nodes': {
        name: 1,
        type: 1,
        value: 1,
        geometry: {
          type: 1,
          coordinates: 1
        },
        properties: 1,
        propertyValues: 1
      },
      links: {
        value: 1,
        source: 1,
        target: 1
      }
    }
  }
};

export const sampleResourceProps = {
  resourceData: {
    name: "Candy",
    data: {
      settings: {
        defaultLocation: [
          4.3517,
          50.8503
        ],
        columns: {
          siteName: 1,
          location: 1,
          coordinates: 1,
          junctionStage: 1,
          annualTonnage: 1
        },
        stageKey: "junctionStage",
        valueKey: "annualTonnage",
        locationKey: "coordinates",
        nodeNameKey: "siteName",
        stages: [
          {
            key: "source",
            name: "Source",
            targets: [
              "conversion"
            ]
          },
          {
            key: "conversion",
            name: "Conversion",
            targets: [
              "distribution"
            ]
          },
          {
            key: "distribution",
            name: "Distribution",
            targets: [
              "demand"
            ]
          },
          {
            key: "demand",
            name: "Demand",
            targets: [
              "reconversion",
              "sink"
            ]
          },
          {
            key: "reconversion",
            name: "Reconversion",
            targets: [
              "demand"
            ]
          },
          {
            key: "sink",
            name: "Sink",
            targets: []
          }
        ]
      },
      material: "Candy",
      rawData: [
        "Other Global Imports;Shipments, location generalized;51.309933, 3.055030;Source;22,469,843",
        "Knauf (Danilith) BE;Waregemseweg 156-142 9790 Wortegem-Petegem, Belgium;50.864762, 3.479308;Conversion;657,245",
        "MPRO Bruxelles;Avenue du Port 67 1000 Bruxelles, Belgium;50.867486, 4.352543;Distribution;18,632",
        "Residential Buildings (all typologies);Everywhere in Brussels;NA;Demand;3,882,735",
        "Duplex House Typology;Everywhere in Brussels;NA;Demand;13,544",
        "Apartment Building Typology;Everywhere in Brussels;NA;Demand;34,643",
        "New West Gypsum Recycling;9130 Beveren, Sint-Jansweg 9 Haven 1602, Kallo, Belgium;51.270229, 4.261048;Reconversion;87,565",
        "Residential Buildings (all typologies);Everywhere in Brussels;NA;Sink;120,000",
        "RecyPark South;1190 Forest, Belgium;50.810799, 4.314789;Sink;3,130",
        "RecyPark Nord;Rue du Rupel, 1000 Bruxelles, Belgium;50.880181, 4.377136;Sink;1,162"
      ]
    }
  }
};
export const sampleResourceMutationOutputParams = {resource: sampleResourceOutputParams};
