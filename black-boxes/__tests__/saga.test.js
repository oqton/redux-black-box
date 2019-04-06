import { createStore, applyMiddleware } from 'redux';

import { blackBoxMiddleware, PromiseBlackBox } from '../../lib';
import {
  SagaBlackBox, call, put, select, take, all, cancelled
} from '../saga';

const delay = (ms) => {
  let timeout;
  const p = new Promise((res) => { timeout = setTimeout(res, ms); });
  p.cancel = () => clearTimeout(timeout);
  return p;
};

global.console.assert = (check, msg) => { if (!check) throw new Error(msg || 'AssertionError'); };

describe('SagaBlackBox', () => {
  it('can handle a saga', async () => {
    const reducer = (state = { state: 'STATE0', urn: 'abc' }, action) => {
      switch (action.type) {
        case 'TRANSITION1':
          return {
            ...state,
            state: 'STATE1',
            sagaSideEffect: new SagaBlackBox(
              function* mySaga() {
                let urn;
                if (action.urn) {
                  urn = action.urn;
                } else {
                  urn = yield select(globalState => globalState.urn);
                }

                yield put({ type: 'LOAD', urn });

                yield take(act => act.type === 'LOADED');

                yield call(() => delay(100));

                const urn2 = yield call(function* subSaga() {
                  return yield select(globalState => globalState.urn);
                });
                expect(urn2).toEqual('abc');

                yield put({ type: 'UNLOAD', urn });

                yield all([1, 2, 3].map(function* pingOne(id) {
                  yield put({ type: 'PING', id });
                }));

                return put({ type: 'TRANSITION2' });
              }
            )
          };
        case 'LOAD':
          return {
            ...state,
            loadSideEffect: new PromiseBlackBox(() => delay(0).then(() => ({ type: 'LOADED' })))
          };
        case 'TRANSITION2':
          console.assert(state.state === 'STATE1');
          return {
            ...state,
            state: 'STATE2',
            sagaSideEffect: null
          };
        default:
          return state;
      }
    };

    const store = createStore(reducer, undefined, applyMiddleware(blackBoxMiddleware));

    expect(store.getState().state).toBe('STATE0');
    store.dispatch({ type: 'TRANSITION1' });
    expect(store.getState().state).toBe('STATE1');
    await delay(200);
    expect(store.getState().state).toBe('STATE2');
  });
  it('can handle an error', async () => {
    const reducer = (state = { state: 'STATE0', urn: 'abc' }, action) => {
      switch (action.type) {
        case 'TRANSITION1':
          return {
            ...state,
            state: 'STATE1',
            sagaSideEffect: new SagaBlackBox(
              function* mySaga() {
                let errorCaught = false;
                try {
                  yield call(() => {
                    throw new Error();
                  });
                  expect(false).toBeTruthy();
                } catch (e) {
                  errorCaught = true;
                }
                expect(errorCaught).toBeTruthy();
                return put({ type: 'TRANSITION2' });
              }
            )
          };
        case 'TRANSITION2':
          console.assert(state.state === 'STATE1');
          return {
            ...state,
            state: 'STATE2',
            sagaSideEffect: null
          };
        default:
          return state;
      }
    };

    const store = createStore(reducer, undefined, applyMiddleware(blackBoxMiddleware));

    expect(store.getState().state).toBe('STATE0');
    store.dispatch({ type: 'TRANSITION1' });
    expect(store.getState().state).toBe('STATE1');
    await delay(100);
    expect(store.getState().state).toBe('STATE2');
  });
  it('can handle cancellation', async () => {
    let finallyReached = false;
    const reducer = (state = { state: 'STATE0', urn: 'abc' }, action) => {
      switch (action.type) {
        case 'TRANSITION1':
          return {
            ...state,
            state: 'STATE1',
            sagaSideEffect: new SagaBlackBox(
              function* mySaga() {
                try {
                  yield put({ type: 'TRANSITION2' });

                  expect(false).toBeTruthy();
                } finally {
                  expect(yield cancelled()).toBeTruthy();
                  finallyReached = true;
                }
              }
            )
          };
        case 'TRANSITION2':
          console.assert(state.state === 'STATE1');
          return {
            ...state,
            state: 'STATE2',
            sagaSideEffect: null
          };
        default:
          return state;
      }
    };

    const store = createStore(reducer, undefined, applyMiddleware(blackBoxMiddleware));

    expect(store.getState().state).toBe('STATE0');
    store.dispatch({ type: 'TRANSITION1' });
    expect(store.getState().state).toBe('STATE1');
    await delay(100);
    expect(store.getState().state).toBe('STATE2');
    expect(finallyReached).toBeTruthy();
  });

  it('can handle nested cancellation of promise with cancel', async () => {
    let finallyReached = false;
    const reducer = (state = { sagaSideEffect: null }, action) => {
      switch (action.type) {
        case 'TRANSITION1':
          return {
            ...state,
            sagaSideEffect: new SagaBlackBox(
              function* mySaga() {
                try {
                  yield call(() => {
                    let timeout;
                    const p = new Promise((res) => { timeout = setTimeout(res, 50); })
                      .then(() => expect(false).toBeTruthy());
                    p.cancel = () => clearTimeout(timeout);
                    return p;
                  });

                  expect(false).toBeTruthy();
                } finally {
                  expect(yield cancelled()).toBeTruthy();
                  finallyReached = true;
                }
              }
            )
          };
        case 'TRANSITION2':
          return {
            ...state,
            sagaSideEffect: null
          };
        default:
          return state;
      }
    };

    const store = createStore(reducer, undefined, applyMiddleware(blackBoxMiddleware));

    expect(store.getState().sagaSideEffect).toBe(null);
    store.dispatch({ type: 'TRANSITION1' });
    await delay(10);
    expect(store.getState().sagaSideEffect).toBeTruthy();
    store.dispatch({ type: 'TRANSITION2' });
    await delay(10);
    expect(store.getState().sagaSideEffect).toBe(null);
    expect(finallyReached).toBeTruthy();
    await delay(100);
  });
  it('can handle cancellation of nested saga', async () => {
    let finallyReached = false;
    const reducer = (state = { sagaSideEffect: null }, action) => {
      switch (action.type) {
        case 'TRANSITION1':
          return {
            ...state,
            sagaSideEffect: new SagaBlackBox(
              function* mySaga() {
                try {
                  yield call(function* helperSaga() {
                    yield call(() => delay(50));
                    expect(false).toBeTruthy();
                  });

                  expect(false).toBeTruthy();
                } finally {
                  expect(yield cancelled()).toBeTruthy();
                  finallyReached = true;
                }
              }
            )
          };
        case 'TRANSITION2':
          return {
            ...state,
            sagaSideEffect: null
          };
        default:
          return state;
      }
    };

    const store = createStore(reducer, undefined, applyMiddleware(blackBoxMiddleware));

    expect(store.getState().sagaSideEffect).toBe(null);
    store.dispatch({ type: 'TRANSITION1' });
    await delay(10);
    expect(store.getState().sagaSideEffect).toBeTruthy();
    store.dispatch({ type: 'TRANSITION2' });
    await delay(10);
    expect(store.getState().sagaSideEffect).toBe(null);
    expect(finallyReached).toBeTruthy();
    await delay(100);
  });

  it('can handle take with string', async () => {
    const reducer = (state = { state: 'STATE0', urn: 'abc' }, action) => {
      switch (action.type) {
        case 'TRANSITION1':
          return {
            ...state,
            state: 'STATE1',
            sagaSideEffect: new SagaBlackBox(
              function* mySaga() {
                yield put({ type: 'LOAD' });
                yield take('LOADED');
                return put({ type: 'TRANSITION2' });
              }
            )
          };
        case 'LOAD':
          return {
            ...state,
            loadSideEffect: new PromiseBlackBox(() => ({ type: 'LOADED' }))
          };
        case 'TRANSITION2':
          console.assert(state.state === 'STATE1');
          return {
            ...state,
            state: 'STATE2',
            sagaSideEffect: null
          };
        default:
          return state;
      }
    };

    const store = createStore(reducer, undefined, applyMiddleware(blackBoxMiddleware));

    expect(store.getState().state).toBe('STATE0');
    store.dispatch({ type: 'TRANSITION1' });
    expect(store.getState().state).toBe('STATE1');
    await delay(0);
    expect(store.getState().state).toBe('STATE2');
  });
});
