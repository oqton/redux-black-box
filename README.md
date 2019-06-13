# Redux-black-box
<img width="280px" src="./docs/src/logo-black-box-redux.svg?sanitize=true" alt="logo">

[Redux](https://redux.js.org/) is a powerful way of thinking:

* You gather the complete state of your system in **one place**
* You explicitly describe how actions can **transform** the state of the system

The advantage of this is that such an implementation is easy to reason about, verify, or even prove to be correct.

However, a redux system often has to interact with other systems that we can not or do not want to describe as a redux system itself. 
E.g. a timer, a remote call, a web socket, ...

Other libraries such as [redux-thunk](https://github.com/reduxjs/redux-thunk), [redux-saga](https://github.com/redux-saga/redux-saga) or [redux-observable](https://github.com/redux-observable/redux-observable) argue: 
_"This can not be described as a state machine (e.g. because of the side effects), so it does not fit in redux"_, and solve this by adding an extra, parallel system that interacts with redux but is not part of it.
By partially bypassing redux like this we lose a lot of its advantages and we add a lot of complexity.

* The state is no longer contained in the redux store alone. 
These parallel systems have their own state that is not captured; most importantly, which asynchronous interactions exist.
This makes it more complex to cancel in flight asynchronous interactions, and to know the state in which the combined system will be left after cancellation.
* The logic is no longer contained in the reducer alone. 
This makes it much harder to reason about the application.
Moreover, the interaction between the redux system and the parallel system is complex.

> The goal of this library is to solve these asynchronous interactions WITHIN the redux frame of thought.
> We do this by separating the declaration of the interaction, which we call a black box, from its execution.
> The declaration of the black box is done in the reducer while the execution is done by the middleware.


## How to use black boxes in redux
Declaring a black box is simply done by adding an instance of a class that extends `AbstractBlackBox` to the redux state.
Note that declaring the black box is side-effect-free.
The custom middleware will take care of the life cycle and execution of the black box.

```javascript
import { createStore, applyMiddleware } from 'redux';
import { blackBoxMiddleware } from 'redux-black-box';

const reducer = (state, action) => {
  switch(action.type) {
    case "FETCH_REQUEST":
      return {
        ...state,
        call: new PromiseBlackBox( // predefined class extending AbstractBlackBox
          async () => fetch('http://www.server.org') // asynchronous side effect
          .then(res => ({type:"FETCH_SUCCESS", res})) // return action with results
        )
      };
    case "FETCH_SUCCESS":
      return {
        ...state,
        result: action.res,
        call: null
      };
    case "FETCH_ABORT":
      return {
        ...state,
        call: null
      };
    default:
      return state;
  }
}

const store = createStore(reducer, undefined, applyMiddleware(blackBoxMiddleware));
```

This example implements a remote call using a `PromiseBlackBox`. The action returned by the promise is automatically dispatched to the redux store.
 Note that this is only one of [many available types of black box](docs/BlackBoxes.md).


## Redux-black-box rules
Let us have a look at [the three principles of redux](https://redux.js.org/introduction/threeprinciples) and derive the rules for black boxes.

### Single source of truth
> The state of your whole application is stored in an object tree within a single store.

 ***Black boxes should be declared as part of the redux state***

The state of the whole application including the existence of the asynchronous interactions is captured in a single redux store.
The internal state of the black boxes, however, is not defined in the redux store. These bits have to be explicitly declared and are clearly contained.

The life cycle of the asynchronous interaction described by a black box is linked to its existence in the redux state.
When the declaration of a black box is removed from the redux state, the middleware will prevent it from further interacting with it and will, if possible, stop the execution of the asynchronous code. (E.g. in case of a cancellable promise.)

*E.g. using a black box we declare that a fetch call should happen, but we do not describe the state of the fetch call (uploading, waiting for response, downloading, done, ...) in redux.*

### State is read-only
>The only way to change the state is to emit an action, an object describing what happened.

***Black boxes do not expose their internal state, but they can communicate it using actions***

A black box, hence the name, does not expose any state that could be considered as not read-only.
It can only communicate with the redux store using actions and can only do this as long as it is part of the redux state.

*E.g. we cannot get any information about the fetch call that it does not communicate using an action nor does it have methods that we can use to affect the fetch call.*

### Changes are made with pure functions
>To specify how the state tree is transformed by actions, you write pure reducers.

***Black boxes are declared in the reducer, but executed by the middleware***

The reducer function that transforms the state tree is thus a pure, synchronous function. 

*E.g. the declaration of a fetch black box in the reducer does not trigger the fetch, but the middleware observing the redux state change will.*



## Example use case of redux-black-box: Data loader
Read about the implementation of a complex data loader in [Example](docs/Example.md) to better understand how to use redux-black-box and experience its benefits.


## Predefined types of black boxes
In most cases, you will not have to define a black box from scratch. 
Instead, you use one of a number of predefined types, such as the `PromiseBlackBox`.
These are described [here](docs/BlackBoxes.md).


## Comparison against alternative libraries
We compare redux-black-box with several state of the art libraries in [this document](docs/State-of-the-art-comparison.md).
We cover redux-thunk, redux-saga, redux-observable and redux-loop.


## Frequently asked questions
Can be found at [docs/FAQ.md](docs/FAQ.md).


## Design decisions
Documentation about design decisions  can be found [here](docs/Design-decisions.md). This is useful to read for contributors and may also be interesting if you want to implement your own custom black box.


## Questions and bugs
Bugs and pull requests can be submitted to GitHub.
Other questions should be posted to [Stack Overflow](https://stackoverflow.com/questions/tagged/redux-black-box) using the `[redux-black-box]` tag. 
We will attempt to answer your questions there.
