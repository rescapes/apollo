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


/**

 */
/**
 * Given a child component and its parent component, returns a function that expects the children
 * render prop for the childComponent (i.e. the grandchildren). Providing the grandchildren
 * render prop results in calling the parentComponent with the childComponent, and the childComponent's
 * input props are modified to include the grandchildren render prop at props.children
 * @param childComponent
 * @param parentComponent
 * @return {function(*=): *}
 */
export const embedComponents = (childComponent, parentComponent) => {
  // Otherwise call component with child component as the child, modifying childComponent's incoming
  // props to given it its children render prop
  return grandchildren => {
    return parentComponent(p => {
      return childComponent(R.merge(p, {children: grandchildren}));
    });
  };
};

/**
 * If we have a component, wrap it in a Maybe so we can chain with the props that the component returns.
 * If it's a task chain it with the next task
 * @param {[Task|Object]} list Each is a task that resolves to the Apollo request response or returns an
 * Apollo Component
 * @return {[Task|Object]} The resolution of the final task of list (the first in the list since we're
 * evaluating bottom to top) or returns the built up component from bottom to top, where the outermost component
 * is the from the bottom of list and the most embedded component is from the top of list. If a task
 * the return value will expect props to start the task evaluation chain. If a component, it will expect
 * to be given a component that is to be the child component of the innermost component (the one from the
 * top of list). The result of passing the child component is a composed component expecting props.
 */
export const composeWithComponentMaybeOrTaskChain = list => {
  return componentOrProps => {
    const composed = R.composeWith(
      (nextPropsToTaskOrComponent, res) => {
        return R.ifElse(
          res => R.both(R.is(Object), res => 'run' in res)(res),
          // Chain task with the next function
          // This gives the props that result from the task to a function that produces a task
          task => R.chain(nextPropsToTaskOrComponent, task),
          // Pass the component to the next function, which produces the child component.
          // embedComponentsOrPassPropsToTask makes an hoc from the child component and component
          // so that component can pass props to the child component and get a children render prop
          // to the child component (the render prop to create the grandchild)
          component => embedComponents(nextPropsToTaskOrComponent, component)
        )(res);
      }
    )(list);
    // For tasks, componentOrPropsOrBoth is always just props
    // For components, componentOrPropsOrBoth is the child component. Since we must pass composed the props
    // first, we pass props below and then component after.
    // We could optional expect props with/ a children props as the child component here,
    // but I think we'll always pass the child component before the props
    return R.ifElse(
      R.is(Function),
      // Match the form of HOC(component)(props), even though composed expects props first
      component => {
        return props => {
          // For components, pass props first, then the child component. This returns a complete component
          return composed(props)(component);
        };
      },
      props => {
        // For tasks, just pass the props. This returns a task that is ready to execute
        return composed(props);
      }
    )(componentOrProps);
  };
};