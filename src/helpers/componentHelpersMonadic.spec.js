/**
 * Created by Andy Likuski on 2020.05.13
 * Copyright (c) 2020 Andy Likuski
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 */

import * as R from 'ramda';
import {strPathOr, reqStrPathThrowing, composeWithChain, defaultRunConfig} from 'rescape-ramda'
import * as Maybe from 'folktale/maybe';
import {of} from 'folktale/concurrency/task';
import {composeWithComponentMaybeOrTaskChain} from './componentHelpersMonadic';

describe('monadHelpersComponent', () => {
  const outerProps = {jello: 'squish', stone: 'squash'};
  // Simple component
  const simpleComponent = prop => R.cond([
    [strPathOr(false, 'data.loading'), p => `I rendered a ${JSON.stringify(prop)}`],
    [R.identity, p => `I rendered a ${JSON.stringify(p)}`]
  ])(prop);

  // Render function component that does something and renders the children function that is given to it
  // This would typically do something asynchronous
  const componentConsumingARenderProp = ({children, ...props}) => {
    const loadedData = R.merge(props, {data: {keyCount: R.length(R.keys(props))}});
    return children(loadedData);
  };
  // This wraps component in container by creating and outer function (Looks like chainWith)
  // Since container expects a render prop at 'children', we create a function for its children property
  // that renders component with whatever component has done with the original props
  // This doesn't need to be curried. Can also be container => component =>
  const higherOrderComponent = renderPropConsumingComponent => component => {
    // This function is a component that passes props to container that have a children function
    // added to render the component. Component might or might not also expect a children function.
    return props => {
      return renderPropConsumingComponent(R.merge(
        props,
        {
          // This will be called be returned by renderPropConsumingComponent
          // This function simply renders component, which can optionally be a higherOrderComponent
          children: componentProps => {
            return component(componentProps);
          }
        }
      ));
    };
  };

  // Render function component that does something and renders the children function that is given to it
  // This would typically do something asynchronous
  const dependentComponentConsumingARenderProp = ({children, ...props}) => {
    const data = reqStrPathThrowing('data', props);
    const loading = strPathOr(false, 'loading', data);
    if (loading) {
      // If loading pass along the props without processing
      return children(props);
    }

    const loadedData = R.merge(
      props,
      {
        data: R.over(
          R.lensProp('keyCount'),
          keyCount => {
            return `dynamite ${keyCount}`;
          },
          data
        )
      }
    );
    return children(loadedData);
  };

  const renderPropComponentLoading = props => {
    const loadedData = R.merge(props, {data: {loading: true}});
    return props.children(loadedData);
  };

  const higherOrderComponentMaybe = container => component => {
    return Maybe.Just(props => {
      return container(R.merge(
        props,
        {
          children: componentProps => {
            return component(componentProps);
          }
        }
      ));
    });
  };
  // Now what if we codify our highOrderComponent into composeWith
  const composeWithHighOrderComponent = R.composeWith(
    (container, component) => higherOrderComponent(container)(component)
  );

  /**
   * Given a component and its child component and the props passed to the component, extract the children
   * render prop from the props and create a render prop called children passed to component along with
   * the other props. The children function calls childComponent with the children render prop, allowing
   * us to build-up the children via the render prop
   */
  const childrenPropToRenderPropCallingChild = R.curry((childComponent, component) => {
    return ({children, ...props}) => {
      return component(R.merge(props, {
        children: p => {
          return childComponent(R.merge(p, {children}));
        }
      }));
    };
  });

  /**
   * Given a component and its child component and the props passed to teh component, extract the children
   * render prop from the props and create a render prop called children passed to component along with
   * the other props. The children function calls childComponent with the children render prop, allowing
   * us to build-up the children via the render prop
   */
  const childrenPropToRenderPropCallingChildMaybe = R.curry((childComponent, component) => {
    return Maybe.Just(childrenPropToRenderPropCallingChild(childComponent, component));
  });

  test('Basic', () => {
    expect(higherOrderComponent(componentConsumingARenderProp)(simpleComponent)(outerProps)).toEqual(
      'I rendered a {"jello":"squish","stone":"squash","data":{"keyCount":2}}'
    );
  });

  test('Render function component that does something', () => {
    // Now what if we have two renderPropComponents and the second depends on the first
    expect(R.compose(
      higherOrderComponent(componentConsumingARenderProp),
      higherOrderComponent(dependentComponentConsumingARenderProp)
    )(simpleComponent)(outerProps)).toEqual(
      'I rendered a {"jello":"squish","stone":"squash","data":{"keyCount":"dynamite 2"}}'
    );
  });

  test('Render using composeWith', () => {
    expect(
      composeWithHighOrderComponent([
        componentConsumingARenderProp,
        dependentComponentConsumingARenderProp,
        // We always have to create the monad on the first call
        higherOrderComponent(dependentComponentConsumingARenderProp)
      ])(simpleComponent)(outerProps)
    ).toEqual(
      'I rendered a {"jello":"squish","stone":"squash","data":{"keyCount":"dynamite dynamite 2"}}'
    );
  });

  // Now simulate waiting for data
  // Render function component that does something and renders the children function that is given to it
  // This would typically do something asynchronous
  test('Render with fake waiting', () => {
    expect(composeWithHighOrderComponent([
      renderPropComponentLoading,
      dependentComponentConsumingARenderProp,
      // We always have to create the monad on the first call
      higherOrderComponent(dependentComponentConsumingARenderProp)
    ])(simpleComponent)(outerProps)).toEqual(
      'I rendered a {"jello":"squish","stone":"squash","data":{"loading":true}}'
    );
  });

  // What if the higherOrderComponent wraps everything in a Just.Maybe
  // so that we can be compatible composeWithChain
  test('Compose with Maybe', () => {
    expect(composeWithChain([
      // Shed the Maybe
      R.identity,
      higherOrderComponentMaybe(componentConsumingARenderProp),
      higherOrderComponentMaybe(dependentComponentConsumingARenderProp),
      higherOrderComponentMaybe(dependentComponentConsumingARenderProp)
    ])(simpleComponent)(outerProps)).toEqual(
      'I rendered a {"jello":"squish","stone":"squash","data":{"keyCount":"dynamite dynamite 2"}}'
    );
  });

  // Let's compose outer component to inner from bottom to top now.
  // This requires a render prop function to built up backward from top to bottom when we pass the props
  // to function created by compose
  test('Compose bottom to top', () => {
    const hoc = R.compose(
      componentExpectingRenderProp => {
        // Returns the outermost component
        // This component receives the external props with a simple component specified as the children
        // By passing the props to the outermost component, it sends us into the nested components from each level
        // that have instructions to render a child at that level using the render prop
        return ({children, ...props}) => {
          return componentExpectingRenderProp(R.merge(props, {
            children: p => {
              return children(p);
            }
          }));
        };
      },
      componentExpectingRenderProp => {
        // Wrap componentExpectingRenderProp in a component that provides it with props.children render function
        return ({children: outerChildrenRenderProp, ...props}) => {
          // Take the children function from above and wrap it so it renders the component at this level
          return componentExpectingRenderProp(R.merge(props, {
            children: p => {
              return dependentComponentConsumingARenderProp(R.merge(p, {children: outerChildrenRenderProp}));
            }
          }));
        };
      },
      componentExpectingRenderProp => {
        return ({children: outerChildrenRenderProp, ...props}) => {
          // Take the children function above and wrap it so it renders the component at this level
          return componentExpectingRenderProp(R.merge(props, {
            children: p => {
              return dependentComponentConsumingARenderProp(R.merge(p, {children: outerChildrenRenderProp}));
            }
          }));
        };
      },
      () => {
        return props => {
          // Receives built up children render prop. This is the outer component so it can just be called.
          return componentConsumingARenderProp(props);
        };
      }
    )();

    expect(hoc(R.merge(outerProps, {children: simpleComponent}))).toEqual(
      'I rendered a {"jello":"squish","stone":"squash","data":{"keyCount":"dynamite dynamite 2"}}'
    );
  });

  // Compose from bottom to top with hoc functions that handle building up the render prop
  test('Compose bottom to top hocs with helpers', () => {
    /**
     * Given a component and the props passed to it, extract the children component/render prop from the props and create a
     * render prop called children passed to component along with the other props. The children function
     * calls the extracted children component/function
     * @param component
     * @param children
     * @param props
     * @return {*}
     */
    const childrenToRenderProp = R.curry((component, {children, ...props}) => {
      return component(R.merge(props, {
        children: p => {
          return children(p);
        }
      }));
    });
    /**
     * Given a component and its child component and the props passed to teh component, extract the children
     * render prop from the props and create a render prop called children passed to component along with
     * the other props. The children function calls childComponent with the children render prop, allowing
     * us to build-up the children via the render prop
     */
    const childrenToWrappedRenderProp = R.curry((component, childComponent, {children, ...props}) => {
      return component(R.merge(props, {
        children: p => {
          return childComponent(R.merge(p, {children}));
        }
      }));
    });

    const hoc = R.compose(
      componentExpectingRenderProp => {
        return props => {
          return childrenToRenderProp(componentExpectingRenderProp, props);
        };
      },
      componentExpectingRenderProp => {
        return props => {
          return childrenToWrappedRenderProp(componentExpectingRenderProp, dependentComponentConsumingARenderProp, props);
        };
      },
      componentExpectingRenderProp => {
        return props => {
          return childrenToWrappedRenderProp(componentExpectingRenderProp, dependentComponentConsumingARenderProp, props);
        };
      },
      () => {
        return props => {
          return componentConsumingARenderProp(props);
        };
      }
    )();

    expect(hoc(R.merge(outerProps, {children: simpleComponent}))).toEqual(
      'I rendered a {"jello":"squish","stone":"squash","data":{"keyCount":"dynamite dynamite 2"}}'
    );
  });

  // Compose from bottom to top with hoc functions that handle building up the render prop
  test('Compose bottom to top hocs with maybes', () => {


    // Since we need to return maybes we can't expose the props in the compose
    const hoc = composeWithChain([
      // Shed the Maybe of doubt!
      R.identity,
      c => childrenPropToRenderPropCallingChildMaybe(dependentComponentConsumingARenderProp, c),
      c => childrenPropToRenderPropCallingChildMaybe(dependentComponentConsumingARenderProp, c),
      () => {
        return Maybe.Just(componentConsumingARenderProp);
      }
    ])();

    expect(hoc(R.merge(outerProps, {children: simpleComponent}))).toEqual(
      'I rendered a {"jello":"squish","stone":"squash","data":{"keyCount":"dynamite dynamite 2"}}'
    );
  });

  test('Compose bottom to top hocs with task or component', done => {
    // Accepts the props and returns a component expecting it's child component
    // This is like a React component that takes children, but we split it up so we can call
    // the inner function on the next compose line
    const componentOrTaskConsumingARenderProp = (config, props) => {
      const modifiedProps = R.merge(
        props, {
          data: {
            keyCount: R.length(R.keys(props))
          }
        }
      );
      return R.ifElse(
        () => R.propOr(false, 'task', config),
        // Pretend the resolved props are a task
        modifiedProps => of(modifiedProps),
        // Return the resolved props to the children
        // We return a function expecting the children
        modifiedProps => children => children(modifiedProps)
      )(modifiedProps);
    };

    // Render function component that does something and renders the children function that is given to it
    // This would typically do something asynchronous
    const dependentComponentOrTaskConsumingRenderProp = (config, {children, ...props}) => {
      const data = reqStrPathThrowing('data', props);
      const loading = strPathOr(false, 'loading', data);
      if (loading) {
        // If loading pass along the props without processing
        return children(props);
      }

      const loadedData = R.merge(
        props,
        {
          data: R.over(
            R.lensProp('keyCount'),
            keyCount => {
              return `dynamite ${keyCount}`;
            },
            data
          )
        }
      );
      return R.ifElse(
        () => R.propOr(false, 'task', config),
        // Pretend the resolved props are a task
        of,
        // return the resolved props to the children
        loadedData => children(loadedData)
      )(loadedData);
    };


    const props = R.merge(outerProps, {children: simpleComponent});
    // Make a composeWithChain that can handle components or tasks
    const composed = config => composeWithComponentMaybeOrTaskChain([
      props => dependentComponentOrTaskConsumingRenderProp(config, props),
      // composeWithComponentMaybeOrTaskChain
      props => dependentComponentOrTaskConsumingRenderProp(config, props),
      // props -> either task or unary function needing the child component from above. The child gets props made here.
      props => componentOrTaskConsumingARenderProp(config, props)
    ])(props);

    // Key count is now 3 because 'children' is part of the count
    expect(composed({})(simpleComponent)).toEqual(
      'I rendered a {"jello":"squish","stone":"squash","data":{"keyCount":"dynamite dynamite 3"}}'
    );
    const errors = [];
    composed({task: true}).run().listen(defaultRunConfig({
      onResolved: value => {
        expect(value).toEqual(
          // The task results don't include the simpleComponent
          {"data": {"keyCount": "dynamite dynamite 3"}, "jello": "squish", "stone": "squash"}
        );
      }
    }, errors, done));
  }, 10000);
});
