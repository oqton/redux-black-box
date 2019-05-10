# Predefined types of black boxes
In most cases, you will not have to define a black box from scratch, but one of a number of predefined types can be used.

## Base types of black boxes
Below are the base types of black boxes, listed from most restricting to most general.
These black boxes are all defined in the main library and can be imported from there.

### PromiseBlackBox
```javascript
import { PromiseBlackBox } from 'redux-black-box';
new PromiseBlackBox(promiseGenerator)
```
The strictest and simplest type of black box, used for e.g. remote calls.
You create it with a function that returns a promise for an action. The action is automatically dispatched when the promise is resolved.
If the promise has a `cancel()` method, it will be called when the PromiseBlackBox is removed from the redux state. Even if the promise cannot be canceled, the returned action will not be dispatched if the PromiseBlackBox is removed.

```javascript
new PromiseBlackBox(async () => fetch('http://www.server.org')
  .then(res => ({type:"FETCH_SUCCESS", res})) )
```

Because, the promise does not interact with the redux store (e.g. by observing or dispatching actions) and can only dispatch one action once it has finished, it is easy to reason about this type of side effect.
Basically, they are just delayed actions, but with the advantage that they are created and can be canceled synchronously.

### ReduxBlackBox
```javascript
import { ReduxBlackBox } from 'redux-black-box';
new ReduxBlackBox(startAction, resultAction, function actionFilter(action, state))
```
A complex redux system often has different subsystems that interact. One subsystem can then treat another as a black box that it interacts with through actions.

Consider subsystem A and B, where A needs to perform some operations on some data and B is responsible for loading data.

```javascript
new ReduxBlackBox(
  // action to request B to load data
  {type: "LOAD", url},
  // action to tell A to continue when B is ready
  {type: "STEP_AFTER_LOAD"},
  // wait until B dispatches an action that says it is ready
  act => act.type === "LOAD_SUCCESS" && act.url == url
)
```
When the ReduxBlackBox is removed from the redux state, the result action will not be dispatched anymore.
Of course, the start action may have already resulted in side effects that will not be cancelled.

Similarly to the `PromiseBlackBox`, a `ReduxBlackBox` acts as a delayed action, which is in this case triggered by another redux subsystem instead of a promise.


### AsyncBlackBox
```javascript
import { AsyncBlackBox } from 'redux-black-box';
new AsyncBlackBox(async promiseGenerator({ dispatch, getState, take }))
```
Some algorithms are easier (number of lines, readability, ...) to describe in a linear code snippet than explicitly in a redux state machine.
At the user's discretion and risk this can be implemented as a black box subsystem.
The user should be aware that this increases the amount of "hidden" state that is not part of the redux state machine.

Things to avoid:
* Algorithms that interact heavily with other subsystems.
* Promise cancellation if this leaves the redux system in a not well defined intermediate state.


```javascript
new AsyncBlackBox(
  async function myAsyncFunction({ dispatch, getState, take }) {
    let url = getState().url;

    await take(act => act.type === 'LOADED');

    await Promise.all([1, 2, 3].map(async function pingOne(id) {
      await Promise.delay(100));
      dispatch({ type: 'PING', id });
    }));
  }
)
```

The arguments of myAsyncFunction are:
 * `dispatch(action)` to dispatch an action.
 * `getState()` to get the current state of the redux store.
 * `take(filter)` to wait until an action is fired in the redux store that matches the filter.
 
NOTE:
If the promise generator returns a promise with `.cancel()` method, this will be called when the black box is unloaded.
It is important to realise that this `.cancel()` method can only be called if the promise generator has already returned a promise. 
If you dispatch an action in the promise generator before returning the first promise, this can result in an error.


### AbstractBlackBox
```javascript
import { AbstractBlackBox } from 'redux-black-box';
class CustomBlackBox extends AbstractBlackBox {
  onLoad({ dispatch, getState }) {
    //called when added to the redux store
  }

  onUnload({ getState }) {
    //called when removed from the redux store
  }

  onAction(action, { dispatch, getState }) {
    //called when redux has processed an action
  }
}
```

Custom black box systems can be created by extending the `AbstractBlackBox` class.
An example of a black box system that warrants a custom implementation is a web socket.

An other simple example is an interval ticker.
```javascript
class MyCustomSubsystem extends AbstractBlackBox {
  onLoad({ dispatch }) {
    this.interval = setInterval(() => dispatch({ type: 'TICK' }), 50);
  }

  onUnload() {
    clearInterval(this.interval);
    this.interval = null;
  }
}
```

#### Correctly dispatching actions
The `dispatch` function should not be called synchronously inside the `onLoad` or `onAction` methods.
This will result in the error "Black boxes may not synchronously dispatch actions." because it would cause actions to be fired before the processing of the previous action has been completed (see [Design decisions](./Design-decisions.md) for more information).
This is comparable to redux throwing the error "Reducers may not dispatch actions." when you [dispatch an action inside a reducer](https://redux.js.org/api/store#dispatch).
```javascript
onLoad({dispatch}) {
  // setup stuff here ...
  // don't dispatch synchronously
  dispatch({type:"SOMETHING"}); // NOT GOOD
}
```

`dispatch` should always be called in an asynchronous function. 
E.g:
```javascript
onLoad({dispatch}) {
  // setup stuff here ...
  // do dispatch asynchronously
  Promise.resolve().then(() => { dispatch({type:"SOMETHING"}); })
}
```


## Extra types of black boxes
The following are types of black boxes that are more specialised for one specific task.
They are all built on the above base types.
They are not included in the main library and should be imported from their respective files.


### DelayedAction
```javascript
import { DelayedAction } from 'redux-black-box/black-boxes/delay';
new DelayedAction(ms, action)
```

The simplest asynchronous black box: it fires an action after a specified amount of time.
(Based on `PromiseBlackBox`.)


### FetchSideEffect
```javascript
import { FetchSideEffect } from 'redux-black-box/black-boxes/fetch';
new FetchSideEffect(urlOrRequestObject, successActionCreatorOrType, failureActionCreatorOrType)
```
Fetch calls are one of the most common asynchronous interaction.
This black box accepts an url or request object and two action creators or action types: one for a successful fetch and the other for a failed fetch.
(Based on `PromiseBlackBox`.)

```javascript
new FetchSideEffect(
  new Request('http://www.server.org'), 
  'FETCH_SUCCESS', 
  (res, error) => ({ type: 'FETCH_FAILURE', res, error })
)
```

### SagaBlackBox
```javascript
import { SagaBlackBox } from 'redux-black-box/black-boxes/saga';
new SagaBlackBox(sagaGenerator)
```
To make the transition from redux-saga smoother, a special type of black box was implemented that accepts a generator function as constructor argument.
The generator can yield many of the same effects as defined by redux-saga. E.g. put, call, take, select but not takeEvery, takeLatest.
(Based on `AsyncBlackBox`.)

```javascript
import { SagaBlackBox, select, take, call, all, put } from 'redux-black-box/black-boxes/saga';
new SagaBlackBox(
  function* mySaga() {
    let url;
    if (action.url) {
      url = action.url;
    } else {
      url = yield select(globalState => globalState.url);
    }

    yield take(act => act.type === 'LOADED');

    yield call(() => Promise.delay(100));

    yield all([1, 2, 3].map(function* pingOne(id) {
      yield put({ type: 'PING', id });
    }));
  }
)
```


