class AbstractBlackBox {
  constructor() {
    this._name = this.constructor.name;
    this._loadStarted = false;
    this._loaded = false;
    this._unloaded = false;
  }

  guardedStore({ dispatch, getState }) {
    if (!this._guardedStore) {
      this._guardedStore = {
        dispatch: (action) => {
          if (this._unloaded) {
            throw new Error(`This black box (${this._name}) has been removed from the redux state: `
                + `it can no longer dispatch an action (${action.type})`); // basic cancellation
          }
          return dispatch(action);
        },
        getState
      };
    }
    return this._guardedStore;
  }

  onLoadInternal(store) {
    console.assert(!this._loadStarted, 'black box already loaded');
    this._loadStarted = true;
    this.onLoad(this.guardedStore(store));
    this._loaded = true;
  }

  onUnloadInternal(store) {
    console.assert(this._loaded, 'black box not yet loaded');
    console.assert(!this._unloaded, 'black box already unloaded');
    this._unloaded = true;
    this.onUnload(this.guardedStore(store));
  }

  onActionInternal(action, store) {
    console.assert(this._loaded, 'black box not yet loaded');
    console.assert(!this._unloaded, 'black box already unloaded');
    this.onAction(action, this.guardedStore(store));
  }

  onLoad({ dispatch, getState }) { throw new Error('Not implemented'); }

  onUnload({ getState }) { throw new Error('Not implemented'); }

  onAction(action, { dispatch, getState }) {}
}

class PromiseBlackBox extends AbstractBlackBox {
  constructor(promiseGenerator) {
    super();
    this._resolved = false;
    this._promiseGenerator = promiseGenerator;
  }

  async onLoad({ dispatch }) {
    try {
      // call the promise generator: note that this function can return a non-standard promise with `.cancel()` method
      this._promise = this._promiseGenerator();
      // wait for it to finish
      const action = await this._promise;
      this._resolved = true;
      try {
        // if the black box has unloaded, don't do anything
        if (action && !this._unloaded) return dispatch(action);
      } catch (e) {
        console.error(`An error was thrown while dispatching an action: ${e}`);
        // console.error(e);
        throw e;
      }
    } catch (e) {
      this._resolved = true;
      console.error(`An error was thrown during execution of this black box (${this._name}): ${e}`);
      // console.error(e);
      throw e;
    }
  }

  onUnload() {
    if (!this._resolved && this._promise.cancel) this._promise.cancel();
  }
}

class ReduxBlackBox extends AbstractBlackBox {
  constructor(actionStart, actionAfter = null, take = () => true) {
    super();
    console.assert(actionStart, 'A start action is required');
    this._finished = !actionAfter; // if no action after, no need to wait for anything
    this._actionStart = actionStart;
    this._actionAfter = actionAfter;
    this._take = take;
  }

  async onLoad({ dispatch }) {
    await null; // force async dispatch
    if (!this._unloaded) dispatch(this._actionStart);
  }

  onUnload() {
  }

  async onAction(action, { dispatch, getState }) {
    if (this._finished || this._unloaded || !this._loaded) return;
    if (this._take(action, getState())) {
      this._finished = true;
      await null;// force async dispatch
      if (this._actionAfter instanceof Function) {
        dispatch(this._actionAfter(action));
      } else {
        dispatch(this._actionAfter);
      }
    }
  }
}

const patternToFilter = (pattern) => {
  if (pattern === undefined || pattern === '*') return () => true; // wildcard matches all actions
  if (typeof pattern === 'function') return pattern; // pattern can be a function
  if (typeof pattern === 'string') return act => act.type === pattern; // string matches action.type
  // If pattern is an array, each item in the array is matched with aforementioned rules
  if (Array.isArray(pattern)) {
    const filterArray = pattern.map(patternToFilter);
    return act => filterArray.some(filter => filter(act));
  }
  throw new Error('take only accepts a function, wildcard, string or array as pattern');
};

class AsyncBlackBox extends AbstractBlackBox {
  constructor(promiseGenerator) {
    super();
    this._name = promiseGenerator.name;
    this._resolved = false;
    this._promiseGenerator = promiseGenerator;
    this._takeFilters = [];
    this._take = this._take.bind(this);
  }

  async _take(pattern) {
    return new Promise(resolve => this._takeFilters.push({ filter: patternToFilter(pattern), resolve }));
  }

  async onLoad({ dispatch, getState }) {
    await null; // force delay of execution of promise generator; mainly to make sure dispatch is async
    if (this._unloaded) return;
    try {
      this._promise = this._promiseGenerator({
        dispatch: (action) => {
          if (!this._promise) console.warn('It is dangerous to dispatch an action before returning a promise');
          return dispatch(action);
        },
        getState,
        take: this._take
      });
      await this._promise;
      this._resolved = true;
    } catch (e) {
      this._resolved = true;
      console.error(`An error was thrown during execution of this black box (${this._name}): ${e}`);
      // console.error(e);
      throw e;
    }
  }

  onAction(action) {
    // matching takefilters
    const matchedFilters = this._takeFilters.filter(({ filter }) => filter(action));
    // remaining takefilters
    this._takeFilters = this._takeFilters.filter(takeFilter => !matchedFilters.includes(takeFilter));
    // resolve matching promises
    matchedFilters.forEach(({ resolve }) => resolve(action));
  }

  onUnload() {
    if (!this._resolved && this._promise && this._promise.cancel) this._promise.cancel();
  }
}

function findBlackBoxesInObj(obj, subsystems = []) {
  if (obj instanceof AbstractBlackBox) {
    subsystems.push(obj);
  } else if (Array.isArray(obj)) {
    obj.forEach(child => findBlackBoxesInObj(child, subsystems));
  } else if ((typeof obj === 'object') && (obj !== null)) {
    Object.values(obj).forEach(child => findBlackBoxesInObj(child, subsystems));
  }
  return subsystems;
}

function blackBoxMiddleware({ dispatch, getState }) {
  let lock = false;
  let blackBoxesBefore = [];
  return next => (action) => {
    const returnValue = next(action);
    const blackBoxesAfter = findBlackBoxesInObj(getState());
    const addedBlackBoxes = blackBoxesAfter.filter(blackBox => !blackBoxesBefore.includes(blackBox));
    const removedBlackBoxes = blackBoxesBefore.filter(blackBox => !blackBoxesAfter.includes(blackBox));
    blackBoxesBefore = blackBoxesAfter;
    try {
      if (lock) throw new Error('Black boxes may not synchronously dispatch actions.');
      lock = true;
      addedBlackBoxes.forEach(blackBox => blackBox.onLoadInternal({ dispatch, getState }));
      removedBlackBoxes.forEach(blackBox => blackBox.onUnloadInternal({ getState }));
      blackBoxesAfter.forEach(blackBox => blackBox.onActionInternal(action, { dispatch, getState }));
    } catch (e) {
      console.error(`Error occurred while processing action: ${JSON.stringify(action)}`);
      console.error(e);
      throw new Error(`Error occurred while processing action: ${JSON.stringify(action)}`);
    } finally {
      lock = false;
    }
    return returnValue;
  };
}

module.exports = {
  AbstractBlackBox,
  PromiseBlackBox,
  ReduxBlackBox,
  AsyncBlackBox,
  blackBoxMiddleware
};
