# Redux-black-box: Brief

> Declare side effects as black boxes in redux: an alternative for redux-thunk, redux-saga, redux-loop, ... 



Redux is a powerful way of thinking:
You gather the complete state of your system in one place and you explicitly describe how actions can transform the state of the system.
The advantage of this is that such an implementation is easy to reason about, verify, or even prove to be correct.

However, a redux system often has to interact with other systems that we can not or do not want to describe as a redux system itself. E.g. a timer, a remote call, a web socket, ...

Other libraries like redux-thunk, redux-saga or redux-observable argue: "This can not be described as a state machine (e.g. because of the side effects), so it does not fit in redux", and solve this by adding an extra, parallel system that stands next to it. By partially bypassing redux like this we lose a lot of its advantages and we add a lot of complexity. In some cases, these side effects are simple, and libraries like redux-thunk can suffice, but when the interaction becomes more complex, even redux-saga can be too limited.

The state is no longer contained in the redux store alone. These parallel systems have their own state that is not captured; most importantly, which asynchronous interactions exist. This makes it more complex to cancel in flight asynchronous interactions, and to know the state in which the combined system will be left after cancellation.
The logic is no longer contained in the reducer alone. This makes it much harder to reason about the application. Moreover, the interaction between the redux system and the parallel system is complex.
The goal of this library is to solve these asynchronous interactions with other systems WITHIN the redux frame of thought. We do this by separating the declaration of the interaction, which we call a black box, from its execution. The declaration of the black box is done in the reducer while the execution is done by the middleware.