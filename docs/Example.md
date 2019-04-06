## Walkthrough of the implementation of a data loader

Look at [dataloader.test.js](../__tests__/dataloader.test.js) to see this example in action.

### Problem definition
Let us consider a redux store with two actions:
* Load
* Unload

### Step 1
In our first implementation, dispatching a load action will always transition the redux store to the LOADED state, and dispatching an unload action will transition it to the UNLOADED state. Pretty simple.

```javascript
const reducer = (state = {status: "UNLOADED"}, action) => {
  switch(action.type) {
    case 'LOAD':
      return {
        ...state, 
        status: "LOADED"
      };
    case 'UNLOAD':
      return {
        ...state, 
        status: "UNLOADED"
      };
    default:
      return state;
  }
}
```

### Step 2
For our second implementation we will add reference counting.
Every load action adds a reference, and an unload action removes a reference.
We keep the status LOADED as long as at least one reference remains.

```javascript
const reducer = (state = {status: "UNLOADED", refCount: 0}, action) => {
  switch(action.type) {
    case 'LOAD':
      return state.refCount === 0 ? 
        {
          ...state, 
          status: "LOADED", 
          refCount: 1
        } :
        {
          ...state, 
          refCount: state.refCount + 1
        };
    case 'UNLOAD':
      return state.refCount === 1 ?
        {
          ...state, 
          status:  "UNLOADED",
          refCount: 0
        } :
        {
          ...state, 
          refCount: state.refCount - 1
        };
    default:
      return state;
  }
}
```

### Step 3
Now, let's add some real action.
To load the data, we need to make a call to a server.
We also add an extra status, LOADING, that is used while the call is in flight.

Note:
* we declare the fetch side effect at the same time the status is changed to LOADING.
* we remove the side effect when the status is changed to LOADED, because it has finished.
* we remove the side effect when the status is changed to UNLOADED. If the fetch side effect was still active, it will be automatically cancelled.

```javascript
const reducer = (state = {status: "UNLOADED", refCount: 0}, action) => {
  switch(action.type) {
    case 'LOAD':
      return state.refCount === 0 ? 
        {
          ...state, 
          status: "LOADING", 
          fetchCall: new PromiseBlackBox(() => fetch('http://www.server.org')
            .then(data => ({ type: "LOAD_SUCCESS", data }))),
          refCount: 1
        } :
        {
          ...state, 
          refCount: state.refCount + 1
        };
    case 'LOAD_SUCCESS':
      return {
        ...state,
        status: "LOADED",
        fetchCall: null, //fetch is done, so we do not need it anymore
        data: action.data
      };
    case 'UNLOAD':
      return state.refCount === 1 ?
        {
          ...state, 
          status:  "UNLOADED",
          fetchCall: null, //cancel any fetch calls
          refCount: 0
        } :
        {
          ...state, 
          refCount: state.refCount - 1
        };
    default:
      return state;
  }
}
```

### Step 4
Let's add an extra call to the server during unload. Consider a call to write back any changes that were made to the data while it was in the store.

To make it a little more tricky, we do not want a load action to cancel the unload (because that could result in an unknown state on the server).
When a load action is received while the status is UNLOADING, we wait until the unloading has finished and then transition immediately back to the LOADING state.

```javascript
const reducer = (state = {status: "UNLOADED", refCount: 0}, action) => {
  switch(action.type) {
    case 'LOAD':
      return state.refCount === 0 && state.status === "UNLOADED" ? 
        {
          ...state, 
          status: "LOADING", 
          fetchCall: new PromiseBlackBox(() => fetch('http://www.server.org')
            .then(data => ({ type: "LOAD_SUCCESS", data }))),
          refCount: 1
        } :
        {
          ...state, 
          refCount: state.refCount + 1
        };
    case 'LOAD_SUCCESS':
      return {
        ...state,
        status: "LOADED",
        fetchCall: null, //fetch is done, so we do not need it anymore
        data: action.data
      };
    case 'UNLOAD':
      return state.refCount === 1 ?
        {
          ...state, 
          status:  "UNLOADING",
          fetchCall: null, //cancel any fetch calls
          saveCall: state.status === "LOADED"
            ? new PromiseBlackBox(() => 
              fetch('http://www.server.org', {method: 'POST', body: state.data})
              .then(async data => ({ type: "UNLOAD_SUCCESS" })))
            : new PromiseBlackBox(() => ({ type: 'UNLOAD_SUCCESS' })),
          refCount: 0
        } :
        {
          ...state, 
          refCount: state.refCount - 1
        };
    case "UNLOAD_SUCCESS":
      return state.refCount === 0 ?
        {
          ...state,
          status: "UNLOADED",
          saveCall: null, //save is done, so we do not need it anymore
          data: null,
        } :
        {
          ...state, 
          status: "LOADING", 
          saveCall: null, //save is done, so we do not need it anymore
          data: null,
          fetchCall: new PromiseBlackBox(() => fetch('http://www.server.org')
            .then(data => ({ type: "LOAD_SUCCESS", data }))),
        };
    default:
      return state;
  }
}
```