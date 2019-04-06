const AsyncBlackBox = require('../lib').AsyncBlackBox;

const SAGA_BLACK_BOX = '@@redux-black-box/saga';

class SagaBlackBox extends AsyncBlackBox {
  constructor(saga) {
    super(pseudoStore => this._runGeneratorAsPromise(saga(), pseudoStore, false, true));
    this._name = saga.name;
  }

  _valueAsPromise(val, pseudoStore) {
    const { dispatch, getState, take } = pseudoStore;
    // null value
    if (val === undefined || val === null) {
      return val;
    }
    // generator
    if (val.next) {
      return this._runGeneratorAsPromise(val, pseudoStore);
    }
    // console.log(this, val);
    // effect
    if (val[SAGA_BLACK_BOX]) {
      const effect = val;
      switch (effect.type) {
        case 'SELECT':
          return effect.selector(getState(), ...effect.args);
        case 'PUT':
          return dispatch(effect.action);
        case 'TAKE':
          return take(effect.filter);
        case 'CALL':
          return this._valueAsPromise(effect.fn(...effect.args), pseudoStore);
        case 'ALL':
          return Promise.all(effect.sagas.map(eff => this._valueAsPromise(eff, pseudoStore)));
        case 'CANCELLED':
          return this._unloaded;
        default:
          throw new Error(`Unsupported saga effect: ${effect.type}`);
      }
    }
    // redux-saga style effects
    if (val['@@redux-saga/IO']) {
      const effect = val;
      if (effect.SELECT) return effect.SELECT.selector(getState(), ...effect.SELECT.args);
      if (effect.PUT) return dispatch(effect.PUT.action);
      if (effect.TAKE) return take(effect.TAKE.pattern);
      if (effect.CALL) return this._valueAsPromise(effect.CALL.fn(...effect.CALL.args), pseudoStore);
      if (effect.ALL) return Promise.all(effect.ALL.map(eff => this._valueAsPromise(eff, pseudoStore)));
      if (effect.CANCELLED) return this._unloaded;
      throw new Error(`Unsupported saga effect: ${effect.toJSON()}`);
    }
    // promise or value
    return val;
  }

  _runGeneratorAsPromise(iterator, pseudoStore, doReturn = false, runAsync = false) {
    let runningPromise;
    const promise = (async () => {
      let value;
      let done;
      let nextValue;
      let isError = false;
      let nextError;
      let isReturn = doReturn;
      if (runAsync) await null; // make sure we return a promise before actually starting the saga
      do {
        let res;
        if (isReturn) {
          isReturn = false;
          res = iterator.return();
        } else if (isError) {
          isError = false;
          res = iterator.throw(nextError);
        } else {
          res = iterator.next(nextValue);
        }
        value = res.value;
        done = res.done;
        try {
          runningPromise = this._valueAsPromise(value, pseudoStore);
          if (runningPromise && runningPromise.then) {
            nextValue = await runningPromise; // eslint-disable-line no-await-in-loop
          } else {
            // do not use await if there is no promise to guarantee synchronous return
            nextValue = runningPromise;
          }
        } catch (e) {
          isError = true;
          nextError = e;
        }
      } while (!done || isError);
      return nextValue;
    })();
    promise.cancel = () => {
      if (runningPromise && runningPromise.cancel) runningPromise.cancel();
      this._runGeneratorAsPromise(iterator, pseudoStore, true, false);
    };
    return promise;
  }
}

const select = (selector, ...args) => ({
  [SAGA_BLACK_BOX]: true, type: 'SELECT', selector, args
});
const put = action => ({
  [SAGA_BLACK_BOX]: true, type: 'PUT', action
});
const take = filter => ({
  [SAGA_BLACK_BOX]: true, type: 'TAKE', filter
});
const call = (fn, ...args) => ({
  [SAGA_BLACK_BOX]: true, type: 'CALL', fn, args
});
const all = sagas => ({
  [SAGA_BLACK_BOX]: true, type: 'ALL', sagas
});
const cancelled = () => ({
  [SAGA_BLACK_BOX]: true, type: 'CANCELLED'
});

module.exports = {
  SagaBlackBox,
  select,
  put,
  take,
  call,
  all,
  cancelled
};
