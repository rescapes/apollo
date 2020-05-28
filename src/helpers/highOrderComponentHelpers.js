/**
 * Created by Andy Likuski on 2020.05.28
 * Copyright (c) 2020 Andy Likuski
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 */

/**
 * If we have a component, wrap it in a react-adopt component and our apolloHOC
 * This returns a function expecting a component (the child receiving this apolloComponent's query result)
 * @param apolloComponent
 * @param label
 * @return {function(*): *}
 */
const adoptAndHOC = (label, apolloComponent) => {
  return component => {
    const hoc = apolloHOC(apolloComponent, component);
    hoc.displayName = `ApolloHOC(${apolloComponent.displayName})(${component.displayName})`;
    return hoc;
  };
};

/**
 * Creates a container for the given apollo component by calling adopt on it and wrapping it
 * in a Maybe.Just. If the component is a task leave it alone, since this means we're not using Apollo components
 * @param {String} label Label for react adopt if we have an Apollo Component. Not used for tasks
 * @param {Task|Object} componentOrTask
 * @return {Task|Object} componentOrTask untouched if a task, else the wrapped component
 */
const adoptAndHOCAndMaybeUnlessTask = (label, componentOrTask) => {
  return R.unless(
    c => 'run' in c,
    c => R.compose(
      Maybe.Just,
      c => adoptAndHOC(label, c)
    )(c)
  )(componentOrTask);
};

export const maybeForComponent = (apolloConfig, componentOrTask) => {
  return R.unless(
    () => R.has('apolloClient', apolloConfig),
    componentOrTask => Maybe.Just(componentOrTask)
  )(componentOrTask);
};

/**
 * Calls makesQueryContainer. If it returns a component and not a task we call adopt on the component
 * (using apolloConfig.name for the component label)
 * and wrap it as an HOC function that expects a component that is the child of the apollo query.
 * This is further wrapped in a Maybe to make it a composable monad
 * @params {Object} apolloConfig
 * @params {Object} requestConfig
 * @params {String} requestConfig.name The name of for the adopted component. This name is used store
 * the results of the Apollo Request when passing to its child component's render method
 * @params {Object} requestConfig.readInputTypeMapper input type mapping for the query
 * @params {Object} requestConfig.outputParams output params for the query
 * @params {Object} props Props for the query
 * @return {Object} The task returned by makeQueryContainer or the HOC raised and adopted component wrapped in a Maybe.Just
 */
const makeQueryContainerMaybe = R.curry(
  (apolloConfig,
   {name, readInputTypeMapper, outputParams},
   propsFunc
  ) => {
    return maybeForComponent(
      apolloConfig,
      props => {
        return makeQueryContainer(
          apolloConfig,
          {name, readInputTypeMapper, outputParams},
          R.merge(
            R.pick(['component', 'render', 'children'], props),
            propsFunc(props)
          )
        );
      }
    );
  });

