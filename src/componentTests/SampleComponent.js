import React, {Component} from 'react';
import {
  nameLookup, e, propsFor, renderChoicepoint, composeViews,
  renderLoadingDefault, renderErrorDefault
} from 'rescape-helpers-component';
import {strPath} from 'rescape-ramda';
import PropTypes from 'prop-types';

export const c = nameLookup({
  sample: true,
  sampleLoading: true,
  sampleError: true,

  sampleHeader: true,
  sampleMapboxOuter: true,
  sampleMapbox: true
});

/**
 * The View for a Mapbox on a Sample
 */
class Sample extends Component {
  render() {
    const props = Sample.views(this.props);
    return e('div', propsFor(props.views, c.sample),
      Sample.choicepoint(props)
    );
  }
}

/**
 * Merges parent and state styles into component styles
 * @param style
 */
Sample.viewStyles = () => {
  return {
    [c.sample]: {},
    [c.sampleHeader]: {}
  }
};

Sample.viewProps = (props) => {
  // sample is expected from the query result so can be null during loading or error
  const sample = strPath('data.sample', props);

  return {
    // Key with sample.id so this component can be used in an array
    [c.sample]: {
      sample
    },

    [c.sampleMapboxOuter]: {
    },

    [c.sampleHeader]: {
    },
  };
};

Sample.viewActions = () => {
  return {
  };
};

Sample.renderData = ({views}) => {
  const props = propsFor(views);

  return [
    e('div', props(c.sampleMapboxOuter),
      e('div', props(c.sampleHeader)),
    )
  ];
};


/**
 * Adds to props.views for each component configured in viewActions, viewProps, and viewStyles
 * @param {Object} props this.props or equivalent for testing
 * @returns {Object} modified props
 */
Sample.views = composeViews(
  Sample.viewActions(),
  Sample.viewProps,
  Sample.viewStyles
);

/**
 * Loading, Error, or Data based on the props
 */
Sample.choicepoint = renderChoicepoint(
  renderErrorDefault(c.sampleError),
  renderLoadingDefault(c.sampleLoading),
  Sample.renderData
);

Sample.propTypes = {
  data: PropTypes.shape().isRequired,
  style: PropTypes.shape().isRequired
};

Sample.propTypes = {
  data: PropTypes.shape({
    // The Sample object
    sample: PropTypes.shape(),
    // All locations of the Sample
    locations: PropTypes.arrayOf(PropTypes.shape()).isRequired,
    // All locations with currently loaded geojson. Meaning they can be goespatially shown on the map
    locationsWithGeojson: PropTypes.arrayOf(PropTypes.shape()).isRequired
  }).isRequired
};

export default Sample;
