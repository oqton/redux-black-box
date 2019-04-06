## Frequently Asked Questions

If you have other questions than the ones listed here, these should be posted to [Stack Overflow](https://stackoverflow.com/questions/tagged/redux-black-box) using the `[redux-black-box]` tag. 
We will attempt to answer your questions there.

### Is it ok that black boxes cannot be serialized?
Serializability of redux state and actions is a useful feature that makes it possible to record and replay situations for debugging.
However, it is not a requirement of redux that the whole state is a pure JSON object tree.

In the case of black boxes, we argue that, although it may be useful to know what happens in a black box, it typically does not make sense to be able go back to an old black box state, specifically because black boxes can have effects outside redux that should *not* be replayed. E.g. replaying a REST POST is not desirable.

To help with debugging it may be useful to attach meaningful information to the black box that can be serialized. E.g. the black box type, the url being fetched, ...

Note that in other libraries, such as redux-saga, the asynchronous interactions cannot be serialized and rehydrated either. 
No trace of them is even recorded.


### Is it ok to dispatch an action in response to an  other action?
It is clear that black boxes, especially `ReduxBlackBox`, can be used to dispatch an action in response to a state change which is itself the result of an other action.

You could say this does not make sense and there is no reason why the second action shouldn't have been dispatched in the first place, or the reducer should have reacted to the first action instead of requiring a second, different action to be fired.

Indeed, dispatching an action in response to an other action should not be done if the two actions are strongly coupled. 
E.g. when executing the first action without the second puts the system in an invalid state.
Nor should it be used as a way to reuse state transition code. 
E.g. an action to create a todo item that is completed from the start should probably not result in dispatching two actions: one to create the todo item and one to mark it as completed.

However, we do think there are valid use cases for this pattern.
The requirement is that the second action should be an (asynchronous) side effect of the first action, similar to making a call to a server.
Its value becomes clearer when looking at a complex redux store, with different subsystems with specific responsibilities.
Each of the subsystems is supposed to function independently, only communicating using actions as if it were in a separate redux store.
In this situation, it becomes clear that for subsystem A to react to one action, it may have to send a second action to subsystem B. 
E.g. when opening a document in an editor, the editor subsystem will send an action to the data layer subsystem to load data, which may in turn send a REST call to a server.


### How do I test a reducer with black boxes?
Since the reducers are side-effect-free, you can test them like normal reducers.
By creating a redux store and omitting the redux-black-box middleware, you can easily test the behaviour of the store without black boxes being *executed*.

You can test if the black box was correctly declared and configured without it being executed.
E.g.
```javascript
// test the declaration of the side effect
expect(store.getState().loadBlackBox).toBeInstanceOf(DelayedAction);
expect(store.getState().loadBlackBox.ms).toBe(50);
```


### Wouldn't it be easy if the middleware automatically removed the blackbox from the state when finished?
In general, it is considered an anti-pattern to change the redux state in the middleware.
One of the three principles of redux prescribes that state transformations should be the result of an action and should only be defined in the reducer.

We leave the responsibility to the user, to remove the black boxes from the state when they have completed their function.