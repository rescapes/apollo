import * as AC from '@apollo/client';
import * as R from 'ramda'
import {defaultNode} from "@rescapes/ramda";

const {useMutation, useQuery} = defaultNode(AC)

// Copied from the apollo Query HOC component definition that doesn't seem supported anymore
export function Query(props) {
  const children = props.children;
  const query = props.query
  const options = R.omit(["children", "query"], props);
  const result = useQuery(query, options);
  return result ? children(result) : null;
}}

// Copied from the apollo Mutation HOC component definition that doesn't seem supported anymore
export function Mutation(props) {
  const [runMutation, result] = useMutation(props.mutation, props)
  return props.children ? props.children(runMutation, result) : null;
}