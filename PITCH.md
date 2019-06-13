# Redux-black-box: Brief

> Declare side effects as black boxes in redux: an alternative to redux-thunk, redux-saga, redux-loop, ... 

Redux is a powerful way of thinking:
You gather the complete state of your system in one place and you explicitly describe how actions can transform the state of the system.
The advantage of this is that such an implementation is easy to reason about, verify, or even prove to be correct.

However, a redux system often has to interact with other systems that we can not or do not want to describe as a redux system itself. E.g. a timer, a remote call, a web socket, ...

Other libraries like redux-thunk, redux-saga or redux-observable argue: "This can not be described as a state machine (e.g. because of the side effects), so it does not fit in redux", and they solve this by adding an extra, parallel system that interacts with redux but is not part of it. By partially bypassing redux like this we lose a lot of its advantages and we potentially add a lot of complexity. 

Redux-black-box is meant for those cases where there are multiple concurrent, interacting side effects.
Those cases where redux-thunk doesn't cut it and we turn to redux-saga or other libraries.
We argue that those libraries are also "flawed" because they do not consider (the existence of) those asynchronous interactions to be part of the redux state.
This makes it complex to manage or cancel asynchronous interactions, and to know the state in which the combined system will be left after cancellation.
Moreover, the logic is no longer contained in the reducer alone. This makes it harder to reason about the application.

The goal of this library is to solve these asynchronous interactions WITHIN the redux frame of thought. We do this by separating the declaration of the interaction, which we call a black box, from its execution. The declaration of the black box is done in the reducer itself while the execution is done by the middleware.

