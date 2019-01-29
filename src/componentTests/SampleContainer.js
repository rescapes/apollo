import {mergeDeep, taskToPromise, traverseReduce} from 'rescape-ramda';
import {v} from 'rescape-validate';
import Sample from './SampleComponent';
import {makeRegionsQueryTask, regionOutputParams} from '../stores/scopeStores/regionStore';
import {of} from 'folktale/concurrency/task'

const graphqlTasks = [
  makeRegionsQueryTask(
    {
      options: ({data: {sample}}) => ({
        variables: {
          id: sample.id
        },
        // Pass through error so we can handle it in the component
        errorPolicy: 'all'
      }),
      props: ({data, ownProps}) => {
        return mergeDeep(
          ownProps,
          {data}
        );
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
const composeGraphqlRequestsTask = tasks => traverseReduce(
  (prev, currentTaskMaker) => currentTaskMaker(prev),
  of(Sample),
  tasks
);

// Create the GraphQL Container.
export default ContainerWithData = composeGraphqlRequestsTask(graphqlTasks);

