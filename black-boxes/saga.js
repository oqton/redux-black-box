const AsyncBlackBox = require('../lib').AsyncBlackBox;

const SAGA_BLACK_BOX = '@@redux-black-box/saga';

class SagaBlackBox extends AsyncBlackBox {
  constructor(saga) {
    super(pseudoStore => this._runGeneratorAsPromise(saga(), pseudoStore, false, true));
    this._name = saga.name;
  }

  _processEffectOrValue(val, pseudoStore) {
    const { dispatch, getState, take } = pseudoStore;
    // null value
    if (val === undefined || val === null) {
      return { value: val };
    }
    // generator
    if (val.next) {
      return { promise: this._runGeneratorAsPromise(val, pseudoStore) };
    }
    // console.log(this, val);
    // effect
    if (val[SAGA_BLACK_BOX]) {
      const effect = val;
      switch (effect.type) {
        case 'SELECT':
          return { value: effect.selector(getState(), ...effect.args) };
        case 'PUT':
          return effect.resolve
            ? { promise: dispatch(effect.action) }
            : { value: dispatch(effect.action) };
        case 'TAKE':
          return { promise: take(effect.filter) };
        case 'CALL':
          return this._processEffectOrValue(effect.fn(...effect.args), pseudoStore);
        case 'ALL':
          return {
            promise: Promise.all(effect.sagas.map((eff) => {
              const { promise, value } = this._processEffectOrValue(eff, pseudoStore);
              return promise || value;
            }))
          };
        case 'CANCELLED':
          return { value: this._unloaded };
        default:
          throw new Error(`Unsupported saga effect: ${effect.type}`);
      }
    }
    // redux-saga style effects
    if (val['@@redux-saga/IO']) {
      const effect = val;
      switch (effect.type) {
        case 'SELECT':
          return { value: effect.payload.selector(getState(), ...effect.payload.args) };
        case 'PUT':
          return effect.payload.resolve
            ? { promise: dispatch(effect.payload.action) }
            : { value: dispatch(effect.payload.action) };
        case 'TAKE':
          return { promise: take(effect.payload.pattern) };
        case 'CALL':
          return this._processEffectOrValue(effect.payload.fn(...effect.payload.args), pseudoStore);
        case 'ALL':
          return {
            promise: Promise.all(effect.payload.map((eff) => {
              const { promise, value } = this._processEffectOrValue(eff, pseudoStore);
              return promise || value;
            }))
          };
        case 'CANCELLED':
          return { value: this._unloaded };
        default:
          throw new Error(`Unsupported saga effect: ${effect.type}`);
      }
    }
    // promise or value
    return (val && val.then) ? { promise: val } : { value: val };
  }

  _runGeneratorAsPromise(iterator, pseudoStore, doReturn = false, runAsync = false) {
    let runningPromise;
    let cancelled = false;
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
          const ret = this._processEffectOrValue(value, pseudoStore);
          if (ret.promise) {
            runningPromise = ret.promise;
            nextValue = await runningPromise; // eslint-disable-line no-await-in-loop
          } else {
            // do not use await if there is no promise to guarantee synchronous return
            nextValue = ret.value;
          }
        } catch (e) {
          isError = true;
          nextError = e;
        }
      } while ((!done || isError) && !cancelled);
      return nextValue;
    })();
    promise.cancel = () => {
      cancelled = true;
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
  [SAGA_BLACK_BOX]: true, type: 'PUT', resolve: false, action
});
const putResolve = action => ({
  [SAGA_BLACK_BOX]: true, type: 'PUT', resolve: true, action
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
  putResolve,
  take,
  call,
  all,
  cancelled
};
