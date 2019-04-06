# Comparison Against State of the Art

We compare redux-black-box with several state of the art side effect libraries.


## [Redux-thunk](https://github.com/reduxjs/redux-thunk)
Redux-thunk as described on the website (excerpt):
> Thunks are the recommended middleware for basic Redux side effects logic, including complex synchronous logic that needs access to the store, and simple async logic like AJAX requests.

Redux-thunk moves asynchronous interactions and business logic to the action creators.
It is simple and fast to write for example an AJAX request.

In our opinion, an action should signify an event/request and the business logic should react to it. Putting the business logic in the action creator makes the action log harder to interpret.

It does not really have its own state, which makes it hard to know which side effects are in flight or to cancel them.


## [Redux-saga](https://redux-saga.js.org/)
Redux-saga as described on the website (edited excerpt):
>redux-saga is a library that aims to make application side effects (i.e. asynchronous things like data fetching and impure things like accessing the browser cache) easier to manage, more efficient to execute, easy to test, and better at handling failures. 
The mental model is that a saga is like a separate thread in your application that's solely responsible for side effects.

Redux-saga is a really powerful way to write complex asynchronous interactions.
However, it does not match very well with the redux methodology.
Redux-saga feels more like a second system that listens to redux actions and can look at the redux state, but is otherwise independent.

It is possible to cancel in flight side effects using for instance race conditions or explicitly using saga cancellation.
However, because the state of which side effects are in flight is again not part of the redux state, this is not-trivial to keep in sync.


## [Redux-loop](https://redux-loop.js.org/)
Redux-loop as described on the website (edited excerpt):
>A port of the Elm Architecture to Redux that allows you to sequence your (side) effects naturally and purely by returning them from your reducers.
>
>Having used and followed the progression of Redux and the Elm Architecture, and after trying other effect patterns for Redux, we came to the following conclusion
>> Synchronous state transitions caused by returning a new state from the reducer in response to an action are just one of all possible effects an action can have on application state.
>
>Many other methods for handling effects in Redux, especially those implemented with action-creators, incorrectly teach the user that asynchronous effects are fundamentally different from synchronous state transitions. This separation encourages divergent and increasingly specific means of processing particular types effects. Instead, we should focus on making our reducers powerful enough to handle asynchronous effects as well as synchronous state transitions. With redux-loop, the reducer doesn't just decide what happens now due to a particular action, it decides what happens next. All of the behavior of your application can be traced through one place, and that behavior can be easily broken apart and composed back together. This is one of the most powerful features of the Elm architecture, and with redux-loop it is a feature of Redux as well.

Redux-loop shares the philosophy that performing side effects should not be separated from redux, but instead redux should be made more powerful so that it can handle side effects.
Many of the arguments that are made for redux-loop apply to redux-black-box too.

The main difference with redux-black-box is that it does not consider the existence of the side effects to be part of the redux state.
While the declaration of the side effects is returned by the reducer, it is not stored in the state.
As a result of this, redux-loop does not handle side effect cancellation.
<!-- https://github.com/redux-loop/redux-loop/issues/134 -->

## [Redux-observable](https://redux-observable.js.org/)
***WIP***