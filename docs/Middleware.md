# Configuring the Middleware

The simplest way to add the redux-black-box middleware to your redux store is as follows:
```javascript
import { blackBoxMiddleware } from 'redux-black-box';

const store = createStore(reducer, undefined, applyMiddleware(blackBoxMiddleware));
```

It is possible to configure some settings of the middleware by using `createBlackBoxMiddleware`:
```javascript
import { createBlackBoxMiddleware } from 'redux-black-box';

const myBlackBoxMiddleware = createBlackBoxMiddleware(ignoredPaths);
const store = createStore(reducer, undefined, applyMiddleware(myBlackBoxMiddleware));
```

## Ignored paths in redux state
The current implementation of the middleware traverses the whole redux state on every action to find all black boxes.
When your redux state grows large (multiple megabytes), this can take a considerable amount of time.
If you know that some sections of your state will never contain black boxes (e.g. because they contain large results from a database query), you can ignore these by adding ignored paths.

```javascript
const myBlackBoxMiddleware = createBlackBoxMiddleware([['data', '*', 'content']]);
```
