import React from 'react';
import {e} from 'rescape-helpers-component';
import * as R from 'ramda';
import * as Maybe from 'folktale/maybe'

/**
 * Created by Andy Likuski on 2020.04.01
 * Copyright (c) 2020 Andy Likuski
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 */

/**
 * Pass the component that has a render function that expects the two Apollo request results
 * TODO AdoptedApolloContainer expects a render function for its children. Can this be a component class
 * containing a render function?
 * If the HOC receives the prop _testApolloRenderProps, it will store the apollo result props that are
 * passed to Component each time for testing. I feel like this is something Enzyme should do but doesn't seem to,
 * although it has a renderProps function to access the render function
 * _testApolloRenderProps allows tests to namely access the mutate function and call it
 * @param {Object} ApolloContainer An apollo component (Query, Mutation) or a container of adopted apollo components
 * @param {Object} Component The container class to instantiate, which expects the Apollo container request result props
 * @returns {Object} A React Component class whose render method instantiates AdoptedApolloContainer and gives
 * it a child that is a render prop. This render receives props from the Apollo component request results and
 * instantiates Component with those prosp
 */
export const apolloHOC = R.curry((ApolloContainer, Component) => {
  // This is only a class to support _apolloRenderProps
  // this.props are the props passed from the parent component, not the Apollo component request result props
  return class ApolloHOC extends React.Component {
    render() {
      const self = this;
      // this.props are the props passed from the parent component, not the Apollo component request result props
      return e(ApolloContainer, this.props,
        // The Adopted apollo container expects a render function at the children prop
        // This function provides Component with the results of the Apollo component request results
        // in the form ({
        // query{name}s: {status:..., data..., props},
        // mutate{name}: mutate}) where query{name}s, mutate{name}s where name is any object and any number of
        // mutation or query components can be composed into AdoptedApolloContainer
        props => {
          if (self.props._testApolloRenderProps) {
            // Set this for tests so we can call the mutate functions passed by apollo
            self._apolloRenderProps = props;
          }
          return e(Component, props);
        }
      );
    }
  };
});

export const apolloDependentHOC = R.curry((DependentContainers, Component) => {
  return R.compose(
    ...R.map(DependentContainer => {
      return component => {
        const hoc = apolloHOC(DependentContainer, component);
        hoc.displayName = `ApolloHOC(${DependentContainer.displayName})(${component.displayName})`;
        return hoc;
      };
    }, DependentContainers)
  )(Component);
});

/**
 * Given a component and the props passed to it, extract the children component/render prop from the props and create a
 * render prop called children passed to component along with the other props. The children function
 * calls the extracted children component/function
 * @param component
 * @return {*}
 */
export const componentRenderedWithChildrenRenderProp = component => {
  return ({children, ...props}) => {
    return component(R.merge(props, {
      children: p => {
        return children(p);
      }
    }));
  };
};
export const componentRenderedWithChildrenRenderPropMaybe = component => {
  return Maybe.Just(
    componentAndChildRenderedWithChildrenRenderProp(component)
  );
};

/**
 * Given a component and its child component and the props passed to teh component, extract the children
 * render prop from the props and create a render prop called children passed to component along with
 * the other props. The children function calls childComponent with the children render prop, allowing
 * us to build-up the children via the render prop
 */
export const componentAndChildRenderedWithChildrenRenderProp = R.curry((childComponent, component) => {
  return ({children, ...props}) => {
    return component(R.merge(props, {
      children: p => {
        return childComponent(R.merge(p, {children}));
      }
    }));
  };
});
export const componentAndChildRenderedWithChildrenRenderPropMaybe = R.curry((childComponent, component) => {
  return Maybe.Just(componentAndChildRenderedWithChildrenRenderProp(childComponent, component));
});