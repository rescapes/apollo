import {mergeDeep, taskToPromise, traverseReduce} from 'rescape-ramda';
import {v} from 'rescape-validate';
import {makeRegionsQueryContainer, regionOutputParams} from '../stores/scopeStores/regionStore';
import {of} from 'folktale/concurrency/task';
import Sample from './SampleComponent';
import {asyncComponent} from 'react-async-component';

export const graphqlTasks = [
  makeRegionsQueryContainer(
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
];

const composeGraphqlRequestsTaskMaker = (component, propsStructure) => graphqlTasks[0](component, propsStructure);

/*  traverseReduce(
  (prev, currentTaskMaker) => currentTaskMaker(prev),
  of(component),
  graphqlTasks
);*/

// Create the GraphQL Container.
const ContainerWithData = child => asyncComponent({
  resolve: () => {
    return taskToPromise(composeGraphqlRequestsTaskMaker(child, {id: 0}));
  }
});

const asyncContainer = ContainerWithData(Sample);
export default asyncContainer
