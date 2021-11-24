import {useMutation, useQuery} from '@apollo/client';
import * as R from 'ramda'

// Copied from the apollo Query HOC component definition that doesn't seem supported anymore
export function Query(props) {
  const children = props.children;
  const query = props.query
  const options = R.pick(["children", "query"], props);
  const result = useQuery(query, options);
  return result ? children(result) : null;
}
// Copied from the apollo Mutation HOC component definition that doesn't seem supported anymore
export function Mutation(props) {
  const _a = useMutation(props.mutation, props)
  const runMutation = _a[0]
  const result = _a[1];
  return props.children ? props.children(runMutation, result) : null;
}