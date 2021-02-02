/**
 * Created by Andy Likuski on 2021.01.15
 * Copyright (c) 2021 Andy Likuski
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 */

import {print} from 'graphql';
import React from 'react';
import {e} from '@rescapes/helpers-component';
import * as R from 'ramda'
import {Mutation} from "react-apollo";
import {inspect} from 'util';
import {loggers} from '@rescapes/log';
const log = loggers.get('rescapeDefault');


class DoMutation extends React.Component {
  componentDidMount() {
    const {mutate, mutation, variables, mutationOnMountOnce} = this.props;
    if (mutationOnMountOnce()) {
      log.debug(`Calling on mount mutation \n${print(mutation)} with predefined args ${inspect(variables, false, 10)}`)
      mutate();
    }
  };

  render() {
    return null;
  };
};

const MutationOnMount = ({children, ...other}) => {
  const {mutation, variables} = R.pick(['mutation', 'variables'], other)
  return e(Mutation,
    other,
    (mutate, {called, data, loading, error}) => {
      return e(
        React.Fragment,
        {},
        e(
          DoMutation,
          {mutate, mutation, variables, mutationOnMount: other.mutationOnMountOnce},
          children && children(mutate, {called, data, loading, error})
        )
      );
    }
  );
};

export default MutationOnMount;