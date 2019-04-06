## Design Decisions

### Order of execution
To guarantee consistent execution and understandable behaviour and interaction, order of execution should be clearly defined.

#### onLoad and onUnload 
* onLoad and onUnload are guaranteed to be called immediately (synchronously) after the action that caused the declaration or removal of the black box from the redux state was processed. i.e. before any other action has been passed to redux
* when onLoad is called, the blackbox is guaranteed to be declared in the state and cannot have been removed already by another action
* onLoad is guaranteed to be called before onUnload

#### Dispatching actions in black boxes
To achieve the above guarantees, black boxes should follow this rule:
* dispatching actions should not happen immediately in onLoad, onUnload or onAction
* technically: make sure that the action dispatching is asynchronous

Disregarding this constraint will result in an error.
It is up to the user of the black box to avoid this error.

#### Practical example
Given the example of two interacting black boxes, where one fires an action that causes the declaration of another. (See the [test](../__tests__/black-boxes.test.js) to see it in action.)

```javascript
const reducer = (state = { }, action) => {
  switch (action.type) {
    case 'START':
      return {
        ...state,
        blackBox: new AsyncBlackBox(
          async ({ dispatch, getState, take }) => {
            await null; // force returning a promise

            dispatch({ type: 'LOAD' });
            expect(getState().loadSideEffect).toBeInstanceOf(PromiseBlackBox);

            await Promise.delay(1);
            expect(getState().loadSideEffect).toBeFalsy();
          }
        )
      };
    case 'LOAD':
      return {
        ...state,
        loadSideEffect: new PromiseBlackBox(() => ({ type: 'LOADED' }))
      };
    case 'LOADED':
      return {
        ...state,
        loadSideEffect: null
      };
    default:
      return state;
  }
};
```

Redux-black-box guarantees that `dispatch({ type: 'LOAD' })` is a synchronous function that returns after the action has been processed by the redux store and has its new state, including newly created black boxes.
The new black box's `onLoad()` will have been executed, but it itself cannot dispatch another action yet.
Only when releasing control of the javascript main thread, by using `await`, the other black box can dispatch an action.
