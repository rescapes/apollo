import {mergeDeep, taskToPromise, traverseReduce} from 'rescape-ramda';
import {v} from 'rescape-validate';
import {makeRegionsQueryTaskMaker, regionOutputParams} from '../stores/scopeStores/regionStore';
import {of} from 'folktale/concurrency/task';
import Sample from './SampleComponent';
import {asyncComponent} from 'react-async-component';
import {eMap} from 'rescape-helpers-component';

export const graphqlTasks = [
  makeRegionsQueryTaskMaker(
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

const composeGraphqlRequestsTaskMaker = (component, templateProps) => graphqlTasks[0](component, templateProps);

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
