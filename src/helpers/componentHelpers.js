import * as R from 'ramda';
import Maybe from 'folktale/maybe/index.js';

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
 * Given a component and the props passed to it, extract the render prop or children component from the props and create a
 * render prop called render passed to component along with the other props. The children function
 * calls the extracted children component/function
 * @param component
 * @return {*}
 */
export const componentRenderedWithChildrenRenderProp = component => {
  return ({render, children, ...props}) => {
    return component(R.merge(props, {
      render: p => {
        return render ? render(p) : children(p);
      }
    }));
  };
};
export const componentRenderedWithChildrenRenderPropMaybe = component => {
  return Maybe.Just(
    componentAndChildRenderedWithRenderProp(component)
  );
};

/**
 * Given a component and its child component and the props passed to the component, extract the
 * render prop from the props and create a render prop called children passed to component along with
 * the other props. The children function calls childComponent with the children render prop, allowing
 * us to build-up the children via the render prop
 */
export const componentAndChildRenderedWithRenderProp = R.curry((childComponent, component) => {
  return ({render, ...props}) => {
    return component(R.merge(props, {
      render: p => {
        return childComponent(R.merge(p, {render}));
      }
    }));
  };
});
export const componentAndChildRenderedWithChildrenRenderPropMaybe = R.curry((childComponent, component) => {
  return Maybe.Just(componentAndChildRenderedWithRenderProp(childComponent, component));
});