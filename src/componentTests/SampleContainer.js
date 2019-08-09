import {mergeDeep, taskToPromise, traverseReduce} from 'rescape-ramda';
import {v} from 'rescape-validate';
import {makeRegionsQueryContainer, regionOutputParams} from '../stores/scopeStores/regionStore';
import {of} from 'folktale/concurrency/task';
import Sample from './SampleComponent';
import {asyncComponent} from 'react-async-component';

export const graphqlRequests = {
  query: {
    // Creates a function expecting a component to wrap and props
    queryRegions: makeRegionsQueryContainer(
      {
        options: {
          variables: (props) => ({
            id: props.region.id
          }),
          // Pass through error so we can handle it in the component
          errorPolicy: 'all'
        }
      },
      {
        outputParams: regionOutputParams,
        propsStructure: {
          id: 0
        }
      }
    )
  }
};

export default (component, propsStructure) => graphqlTasks[0](component, propsStructure);

/*
// Create the GraphQL Container.
const ContainerWithData = child => asyncComponent({
  resolve: () => {
    return taskToPromise(composeGraphqlRequestsTaskMaker(child, {id: 0}));
  }
});

const asyncContainer = ContainerWithData(Sample);
*/

