import {mergeDeep, taskToPromise, traverseReduce} from 'rescape-ramda';
import {v} from 'rescape-validate';
import {makeRegionsQueryTask, regionOutputParams} from '../stores/scopeStores/regionStore';
import {of} from 'folktale/concurrency/task';
import Sample from './SampleComponent';

export const graphqlTasks = [
  makeRegionsQueryTask(
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

const composeGraphqlRequestsTaskMaker = component => graphqlTasks[0](component);

/*  traverseReduce(
  (prev, currentTaskMaker) => currentTaskMaker(prev),
  of(component),
  graphqlTasks
);*/

// Create the GraphQL Container.
const ContainerWithData = child => {
  const taskMaker = composeGraphqlRequestsTaskMaker(child);
  return function(props) {
    return taskMaker(props).matchWith({
      Just: ({value}) => value
    })
  }
};

export default ContainerWithData(Sample)
