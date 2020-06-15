/**
 * Created by Andy Likuski on 2020.05.15
 * Copyright (c) 2020 Andy Likuski
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 */

import * as R from 'ramda';
import {strPathOr} from 'rescape-ramda';

export const nameComponent = (name, component) => {
  component.displayName = name;
  return component;
};

/**
 * For some reason Query and Mutation don't have displayNames, so use their type.name
 * @param component
 * @return {*}
 */
const getDisplayName = component => {
  return strPathOr(null, 'displayName', component) || strPathOr('Undefined', 'type.name', component);
};

/**
 * Given a child component and its parent component, returns a function that expects the children
 * render prop for the childComponent (i.e. the render prop that makes grandchildren). Providing the grandchildren
 * render prop results in calling the parentComponent with the childComponent, and the childComponent's
 * input props are modified to include the grandchildren render prop at props.children
 * @param childComponent
 * @param parentComponent
 * @return {function(*=): *}
 */
export const embedComponents = (config, childComponent, parentComponent) => {
  // Wrap parentComponent in an HOC component that expects a render function, grandchildren
  const displayName = `${getDisplayName(parentComponent)}(${getDisplayName(childComponent)})`;
  return nameComponent(displayName, grandchildren => {
    // Only for tests that aren't using React
    if (R.propOr(false, '_noReact', config)) {
      return parentComponent(
        nameComponent(displayName, props => {
          return childComponent(R.merge(props, {
              children: grandchildren,
              render: grandchildren
            }
          ));
        })
      );
    }

    return nameComponent(displayName, props => {
      // Pass a modified version of childComponent that adds a children render prop
      return parentComponent(nameComponent(displayName, p => {
        return childComponent(R.merge(p, {
          children: props.children,
          render: props.children
        }));
      }));
    })({children: grandchildren});
  });
};

export const getRenderProp = props => {
  return R.find(prop => R.propOr(null, prop, props), ['render', 'children']);
};

export const getRenderPropFunction = props => {
  return R.prop(
    getRenderProp(props),
    props
  );
};

export const callRenderProp = props => {
  return getRenderPropFunction(props)(props);
};


/**
 * If we have a component, wrap it in a Maybe so we can chain with the props that the component returns.
 * If it's a task chain it with the next task
 * @param {[Task|Object]} list Each is a task that resolves to the Apollo request response or returns an
 * Apollo Component
 * @param {[Task|Object]} componentOrProps For tasks this is props. For components, this is the child component.
 * When composed it returns the composed component expecting props.
 * Apollo Component
 * @return {Task|Object]} The resolution of the final task of list (the first in the list since we're
 * evaluating bottom to top) or returns the built up component from bottom to top, where the outermost component
 * is the from the bottom of list and the most embedded component is from the top of list. If a task
 * the return value will expect props to start the task evaluation chain. If a component, it will expect
 * to be given a component that is to be the child component of the innermost component (the one from the
 * top of list). The result of passing the child component is a composed component expecting props.
 */
export const composeWithComponentMaybeOrTaskChain = list => {
  return props => {
    const renderProp = getRenderProp(props);

    // Delay the last item of the list (first evaluated) so we can give it its render function
    // to render its child. For subsequent items in the list, this is accomplished by embedComponents below
    // TODO we do all this so we can pass the render function from the top component through the intermediate
    // down to the lowest component. However it might be better if we can just give the render function to
    // the lowest component when we create it.
    const delayedList = R.when(
      () => renderProp,
      list => R.over(
        R.lensIndex(-1),
        f => {
          return props => {
            // Delay evaluation by wrapping in a function expecting the children component
            // so we can link the first called component in list (the last one) to the second (the penultimate)
            const compFunc = children => {
              return f(R.merge(props, {[renderProp]: children}));
            };
            compFunc.displayName = f.displayName;
            return compFunc;
          };
        },
        list
      )
    )(list);

    const composed = R.composeWith(
      (nextPropsToTaskOrComponent, lastTaskOrComponent) => {
        return R.ifElse(
          res => R.both(R.is(Object), res => 'run' in res)(res),
          // Chain task with the next function
          // This gives the props that result from the task to a function that produces a task
          task => R.chain(nextPropsToTaskOrComponent, task),
          // Pass the component to the next function, which produces the child component.
          // embedComponents makes an HOC from component and child component (nextPropsToTaskOrComponent)
          // so that component can pass props to the child component, including a children render prop
          // to the child component (the render prop to create the grandchildren).
          component => {
            return embedComponents(R.pick(['_noReact'], props), nextPropsToTaskOrComponent, component);
          }
        )(lastTaskOrComponent);
      }
    )(delayedList);

    // For tasks, componentOrPropsOrBoth is always just props
    // For components, componentOrPropsOrBoth is the child component. Since we must pass composed the props
    // first, we pass props below and then component after.
    // We could optional expect props with/ a children props as the child component here,
    // but I think we'll always pass the child component before the props
    return R.ifElse(
      props => R.any(prop => R.propOr(false, prop, props), ['render', 'children']),
      // Match the form of HOC(component)(props), even though composed expects props first
      props => {
        // For components, pass props, this produces a function that must be called
        // to create the correct chaining process between components
        const composedExpectingRenderProps = composed(props);
        // Pass the render prop. This passes the render prop from outermost component to innermost
        return composedExpectingRenderProps(R.prop(renderProp, props));
      },
      props => {
        // For tasks, just pass the props. This returns a task that is ready to execute
        return composed(props);
      }
    )(props);
  };
};