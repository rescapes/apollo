import {
  composeWithComponentMaybeOrTaskChain,
  getRenderPropFunction,
  nameComponent
} from "../helpers/componentHelpersMonadic.js";
import {compact, reqStrPathThrowing, strPathOr, toArrayIfNot} from "@rescapes/ramda";
import {addMutateKeyToMutationResponse, containerForApolloType} from "../helpers/containerHelpers.js";
import {loggers} from '@rescapes/log';
import * as R from 'ramda'
import React from 'react';
import {e} from '../helpers/componentHelpers.js';
import PropTypes from 'prop-types';

const log = loggers.get('rescapeDefault');

/**
 * Calls a mutationRequestContainer and then mutates once with the response and waits for the
 * mutation response. The mutationRequestContainer can return a single mutation response or multiple
 * (multiple if for instance using mutationRequestContainer)
 * @param {Object} apolloConfig The apolloConfig. Add options.variables if the mutation request needs
 * to limit the variables from props
 * @param {Object} options
 * @param {Object} [options.outputParams] Output params for the mutation request. May not be required
 * if defaults are built into the particular request
 * @param {String} options.responsePath Dot-separated return path for the mutate response, such as
 * 'result.data.mutateRegion.region'
 * @param {Function} mutationRequestContainer that expects apolloConfig, {outputParams}, props and returns
 * a task or apollo container that does what is described above
 * @param {Object} props Props for the mutation. Must contain a render prop for component calls
 * so that something can be done with the mutate response.
 * @returns {Task|Object} Task or apollo container that does what is described above
 */
export const mutationRequestWithMutateOnceAndWaitContainer = (apolloConfig, {
  outputParams,
  responsePath
}, mutationRequestContainer, props) => {
  return composeWithComponentMaybeOrTaskChain([
    mutationResponses => {
      return mutateOnceAndWaitContainer(
        apolloConfig,
        {responsePath},
        mutationResponses,
        R.propOr(null, 'render', props)
      );
    },
    props => {
      return mutationRequestContainer(apolloConfig, {outputParams}, props);
    }
  ])(props);
};

/**
 * Calls mutation on each this.props.responses that has a mutation function. Using this instead of effects
 * because this component is conditionally rendered, which messes up hooks/effects (sigh)
 */
class MutateResponsesOnce extends React.Component {
  constructor(props) {
    super(props);
    this.state = {mutatedOnce: false}
  }

  objects() {
    return compact(
      R.map(response => {
        return R.compose(
          response => this.props.responsePath ? strPathOr(null, this.props.responsePath, response) : response,
          response => addMutateKeyToMutationResponse(
            {silent: true},
            response
          )
        )(response);
      }, this.props.responses)
    );
  }

  componentDidMount() {
    return this.componentDidUpdate({}, {}, {})
  }

  componentDidUpdate(prevProps, prevState, snapshot) {
    // Do only once
    if (!this.state.mutatedOnce) {
      R.addIndex(R.forEach)(
        (response, i) => {
          // If the response does not have a mutation, it indicates that the response does not need to call
          // mutation because it represents data that has already been created. TODO this could cause
          // problems if response lacks mutation by accident
          if (R.has('mutation', response)) {
            log.debug(`Calling mutation once on response ${
              i + 1
            } of ${
              R.length(this.props.responses)
            } responses that have responsePath ${
              this.props.responsePath
            }`)
            response.mutation();
          }
        },
        this.props.responses
      );
      // Once we've iterated through our responses and called mutate, don't do it again
      this.setState({mutatedOnce: true})
    }

  }

  render() {
    const objects = this.objects();

    // See if our responses are loaded (not relevant for tasks, only components)
    // If not, wait
    if (R.length(objects) !== R.length(this.props.responses)) {
      return nameComponent('mutateOnceAndWaitContainer', e('div', {}, 'loading mutateOnceAndWaitContainer'));
    }

    return getRenderPropFunction({render: this.props.render})({
      // Make objects singular if responses was
      objects: R.unless(
        () => this.props.responsesAreArray,
        objects => R.head(objects)
      )(objects)
    });
  }
}

MutateResponsesOnce.propTypes = {
  responsesAreArray: PropTypes.bool.isRequired,
  responses: PropTypes.arrayOf(PropTypes.shape).isRequired,
  responsePath: PropTypes.string.isRequired,
  render: PropTypes.func
}


/**
 * Container to call mutate on mount for each mutationResponse. The container
 * then returns an empty div until the mutations have completed. For client queries
 * the mutation will have already happened so it returns a task that resolves
 * to the mutation responses. If a mutationResponse in mutationResponses, doesn't have a mutation method,
 * it is taken to mean that an existing item was found and that item doesn't need to call mutation
 * @param apolloConfig
 * @param {Object} options
 * @param {String} options.responsePath The stringPath into the mutation responses
 * of that object being mutated.
 * @param {Object|[Object]} mutationResponses A single or multiple mutation responses
 * to call the mutation function of once on mount
 * @param {Function} render The render prop
 * @returns {Object|Task} The div component when loading or a component
 * with the mutation response or responses. For client mutations resolves to the mutation responses
 */
export const mutateOnceAndWaitContainer = (apolloConfig, {responsePath}, mutationResponses, render = null) => {
  const responses = toArrayIfNot(mutationResponses);
  return containerForApolloType(
    apolloConfig,
    {
      render: (responses) => {

        /*
        // TODO This code causes errors because hooks can't stand conditional rendering
        // Using MutateResponsesOnce below instead
        useEffect(() => {
          // code to run on component mount
          R.forEach(
            response => {
              // If the response does not have a mutation, it indicates that the response does not need to call
              // mutation because it represents data that has already been created. TODO this could cause
              // problems if response lacks mutation by accident
              if (R.has('mutation', response)) {
                response.mutation();
              }
            },
            responses
          );
        }, []);
         */
        // Calls each responses' mutation function once and only once
        return e(MutateResponsesOnce, {
          responsesAreArray: Array.isArray(mutationResponses),
          responses,
          responsePath,
          render
        })
      },
      // For component queries, pass the full response so render can wait until they are loaded
      // client calls access the objects from the responses
      response: R.propOr(false, 'apolloClient', apolloConfig) ?
        R.compose(
          objects => {
            return R.ifElse(Array.isArray, () => objects, () => R.head(objects))(mutationResponses)
          },
          responses => {
            return R.map(reqStrPathThrowing(responsePath), responses)
          }
        )(responses) :
        responses
    }
  );
};
