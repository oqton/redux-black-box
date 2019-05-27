## Design Decisions

### Order of execution
To guarantee consistent execution and understandable behaviour and interaction, order of execution should be clearly defined.

#### State transition and onLoad/onUnload/onAction
`onLoad`, `onUnload` and `onAction` are guaranteed to be called immediately (synchronously) after the triggering action has been processed by the redux store. 
I.e. after the redux state update and before any other action is dispatched.
* Calling `getState` in `onAction(action)` will return the new redux state with the action already applied.
* `onLoad` and `onUnload` are guaranteed to be called immediately after the action that caused the declaration or removal of the black box from the redux state was processed. 
As a result, `onLoad` is guaranteed to be called before `onUnload`, and the black box cannot have been removed by another action yet at that moment.


#### Dispatching actions in black boxes
To achieve the above guarantees, black boxes should follow this rule:
* Dispatching actions should not happen synchronously in `onLoad`, `onUnload` or `onAction`.

Disregarding this constraint will result in the error "Black boxes may not synchronously dispatch actions".
The solution is to make sure that actions are dispatched asynchronously, e.g. by using a promise or async/await.

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
