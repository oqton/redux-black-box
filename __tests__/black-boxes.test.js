import { Promise } from 'bluebird';
import { createStore, applyMiddleware } from 'redux';
import { every } from 'lodash';

import {
  PromiseBlackBox, ReduxBlackBox, AbstractBlackBox, AsyncBlackBox, blackBoxMiddleware
} from '../lib';

Promise.config({
  // Enable cancellation
  cancellation: true,
});

global.console.assert = (check, msg) => { if (!check) throw new Error(msg || 'AssertionError'); };

const delay = ms => new Promise(res => setTimeout(res, ms));

describe('base black boxes tests', () => {
  describe('promise black boxes', () => {
    it('can handle a promise black box', async () => {
      const reducer = (state = { state: 'STATE0' }, action) => {
        switch (action.type) {
          case 'TRANSITION1':
            return {
              state: 'STATE1',
              blackBox: new PromiseBlackBox(() => Promise.delay(100)
                .then(() => ({ type: 'TRANSITION2' })))
            };
          case 'TRANSITION2':
            return {
              state: 'STATE2',
            };
          default:
            return state;
        }
      };

      const store = createStore(reducer, undefined, applyMiddleware(blackBoxMiddleware));
      expect(store.getState().state).toBe('STATE0');
      store.dispatch({ type: 'TRANSITION1' });
      expect(store.getState().state).toBe('STATE1');
      await Promise.delay(200);
      expect(store.getState().state).toBe('STATE2');
    });

    it('can handle a promise black box that returns no promise', async () => {
      const reducer = (state = { state: 'STATE0' }, action) => {
        switch (action.type) {
          case 'TRANSITION1':
            return {
              state: 'STATE1',
              blackBox: new PromiseBlackBox(() => ({ type: 'TRANSITION2' }))
            };
          case 'TRANSITION2':
            return {
              state: 'STATE2',
            };
          default:
            return state;
        }
      };

      const store = createStore(reducer, undefined, applyMiddleware(blackBoxMiddleware));
      expect(store.getState().state).toBe('STATE0');
      store.dispatch({ type: 'TRANSITION1' });
      expect(store.getState().state).toBe('STATE1');
      await Promise.delay(200);
      expect(store.getState().state).toBe('STATE2');
    });

    it('can handle cancellation', async () => {
      const reducer = (state = { state: 'STATE0' }, action) => {
        switch (action.type) {
          case 'TRANSITION1':
            return {
              state: 'STATE1',
              blackBox: new PromiseBlackBox(() => Promise.delay(100)
                .then(() => ({ type: 'TRANSITION2' })))
            };
          case 'TRANSITION2':
            return {
              state: 'STATE2',
              blackBox: null
            };
          case 'TRANSITION3':
            return {
              state: 'STATE3',
              blackBox: null
            };
          default:
            return state;
        }
      };

      const store = createStore(reducer, undefined, applyMiddleware(blackBoxMiddleware));
      expect(store.getState().state).toBe('STATE0');
      store.dispatch({ type: 'TRANSITION1' });
      expect(store.getState().state).toBe('STATE1');
      store.dispatch({ type: 'TRANSITION3' });
      await Promise.delay(200);
      expect(store.getState().state).toBe('STATE3');
    });

    it('can handle many black boxes', async () => {
      const reducer = (state = { state: 'STATE0', cnt: 0 }, action) => {
        switch (action.type) {
          case 'TRANSITION1':
            return {
              ...state,
              state: 'STATE1',
              subStates: action.urns.map((urn, i) => new PromiseBlackBox(() => Promise.delay(10)
                .then(() => ({ type: 'TRANSITION2' }))))
            };
          case 'TRANSITION2':
            console.assert(state.state === 'STATE1', `Unexpected state: ${state.state}`);
            return {
              ...state,
              cnt: state.cnt + 1
            };
          default:
            return state;
        }
      };

      const store = createStore(reducer, undefined, applyMiddleware(blackBoxMiddleware));

      expect(store.getState().state).toBe('STATE0');
      store.dispatch({ type: 'TRANSITION1', urns: ['abc', 'def', 'def', 'def', 'def'] });
      await Promise.delay(11);
      expect(store.getState().state).toBe('STATE1');
      expect(store.getState().subStates.length).toBe(5);
      expect(store.getState().cnt).toBe(5);
    });
  });

  describe('redux black box', () => {
    it('can handle a simple redux black box', async () => {
      const reducer = (state = { state: 'STATE0' }, action) => {
        switch (action.type) {
          case 'TRANSITION1':
            return {
              state: 'STATE1',
              blackBox: new ReduxBlackBox(
                { type: 'TRANSITION2' },
                { type: 'TRANSITION3' }
              )
            };
          case 'TRANSITION2':
            console.assert(state.state === 'STATE1');
            return {
              ...state,
              state: 'STATE2'
            };
          case 'TRANSITION3':
            console.assert(state.state === 'STATE2');
            return {
              ...state,
              state: 'STATE3'
            };
          default:
            return state;
        }
      };

      const store = createStore(reducer, undefined, applyMiddleware(blackBoxMiddleware));

      expect(store.getState().state).toBe('STATE0');
      store.dispatch({ type: 'TRANSITION1' });
      await Promise.delay(1);
      expect(store.getState().state).toBe('STATE3');
    });

    it('can handle a simple redux black box without after action', async () => {
      const reducer = (state = { state: 'STATE0' }, action) => {
        switch (action.type) {
          case 'TRANSITION1':
            return {
              state: 'STATE1',
              blackBox: new ReduxBlackBox(
                { type: 'TRANSITION2' }
              )
            };
          case 'TRANSITION2':
            console.assert(state.state === 'STATE1');
            return {
              ...state,
              state: 'STATE2'
            };
          case 'TRANSITION3':
            console.assert(state.state === 'STATE2');
            return {
              ...state,
              state: 'STATE3'
            };
          default:
            return state;
        }
      };

      const store = createStore(reducer, undefined, applyMiddleware(blackBoxMiddleware));

      expect(store.getState().state).toBe('STATE0');
      store.dispatch({ type: 'TRANSITION1' });
      await Promise.delay(1);
      expect(store.getState().state).toBe('STATE2');
    });

    it('can handle many redux black boxes', async () => {
      const reducer = (state = { state: 'STATE0', cnt: 0 }, action) => {
        switch (action.type) {
          case 'TRANSITION1':
            return {
              ...state,
              state: 'STATE1',
              subStates: action.urns.map((urn, i) => new ReduxBlackBox({ type: 'DUMMY' }, { type: 'TRANSITION2' }))
            };
          case 'TRANSITION2':
            console.assert(state.state === 'STATE1', `Unexpected state: ${state.state}`);
            return {
              ...state,
              cnt: state.cnt + 1
            };
          default:
            return state;
        }
      };

      const store = createStore(reducer, undefined, applyMiddleware(blackBoxMiddleware));

      expect(store.getState().state).toBe('STATE0');
      store.dispatch({ type: 'TRANSITION1', urns: ['abc', 'def', 'def', 'def', 'def'] });
      await Promise.delay(10);
      expect(store.getState().state).toBe('STATE1');
      expect(store.getState().subStates.length).toBe(5);
      expect(store.getState().cnt).toBe(5);
    });

    it('can handle a redux black box', async () => {
      const reducer = (state = { state: 'STATE0' }, action) => {
        switch (action.type) {
          case 'TRANSITION1':
            return {
              state: 'STATE1',
              blackBox: new ReduxBlackBox(
                { type: 'TRANSITION2' },
                { type: 'TRANSITION4' },
                act => act.type === 'TRANSITION3'
              )
            };
          case 'TRANSITION2':
            console.assert(state.state === 'STATE1');
            return {
              ...state,
              state: 'STATE2',
              promiseBlackBox: new PromiseBlackBox(() => Promise.delay(100)
                .then(() => ({ type: 'TRANSITION3' })))
            };
          case 'TRANSITION4':
            console.assert(state.state === 'STATE2');
            return {
              ...state,
              state: 'STATE3'
            };
          default:
            return state;
        }
      };

      const store = createStore(reducer, undefined, applyMiddleware(blackBoxMiddleware));

      expect(store.getState().state).toBe('STATE0');
      store.dispatch({ type: 'TRANSITION1' });
      await Promise.delay(1);
      expect(store.getState().state).toBe('STATE2');
      await Promise.delay(200);
      expect(store.getState().state).toBe('STATE3');
    });

    it('can implement parallel subsystems', async () => {
      const subReducer = (state = ({ state: 'SUBSTATE0', }), action, i) => {
        switch (action.type) {
          case undefined:
            return {
              ...state,
              blackBox: new ReduxBlackBox({ type: 'LOAD', i }, { type: 'SUBACTION1', i })
            };
          case 'SUBACTION1':
            return {
              ...state,
              state: 'SUBSTATE1',
              blackBox: null,
            };
          default:
            return state;
        }
      };

      const reducer = (state = { state: 'STATE0' }, action) => {
        switch (action.type) {
          case 'TRANSITION1':
            return {
              ...state,
              state: 'STATE1',
              subStates: action.urns.map((urn, i) => subReducer(undefined, {}, i))
            };
          case 'SUBACTION1': {
            console.assert(state.state === 'STATE1', `Unexpected state: ${state.state}`);
            const newSubStates = state.subStates.map(
              (subState, i) => (i === action.i ? subReducer(subState, action) : subState)
            );
            return {
              ...state,
              state: every(newSubStates, subState => subState.state === 'SUBSTATE1') ? 'STATE2' : 'STATE1',
              subStates: newSubStates
            };
          }
          default:
            return state;
        }
      };

      const store = createStore(reducer, undefined, applyMiddleware(blackBoxMiddleware));

      expect(store.getState().state).toBe('STATE0');
      store.dispatch({ type: 'TRANSITION1', urns: ['abc', 'def'] });
      await delay(1);
      expect(store.getState().subStates.length).toBe(2);
      expect(store.getState().state).toBe('STATE2');
    });
  });

  describe('async black box', () => {
    it('can handle an async black box', async () => {
      const reducer = (state = { state: 'STATE0', urn: 'abc' }, action) => {
        switch (action.type) {
          case 'TRANSITION1':
            return {
              ...state,
              state: 'STATE1',
              blackBox: new AsyncBlackBox(
                async ({ dispatch, getState, take }) => {
                  let urn;
                  if (action.urn) {
                    urn = action.urn;
                  } else {
                    urn = getState().urn;
                  }

                  dispatch({ type: 'LOAD', urn });

                  await take(act => act.type === 'LOADED');

                  await Promise.delay(100);

                  const urn2 = await (async function subSaga() {
                    return getState().urn;
                  }());
                  expect(urn2).toEqual('abc');

                  dispatch({ type: 'UNLOAD', urn });

                  await Promise.all([1, 2, 3].map(async (id) => {
                    await Promise.delay(1);
                    dispatch({ type: 'PING', id });
                  }));

                  dispatch({ type: 'TRANSITION2' });
                }
              )
            };
          case 'LOAD':
            return {
              ...state,
              loadSideEffect: new PromiseBlackBox(() => Promise.resolve().then(() => ({ type: 'LOADED' })))
            };
          case 'TRANSITION2':
            console.assert(state.state === 'STATE1');
            return {
              ...state,
              state: 'STATE2',
            };
          default:
            return state;
        }
      };

      const store = createStore(reducer, undefined, applyMiddleware(blackBoxMiddleware));

      expect(store.getState().state).toBe('STATE0');
      store.dispatch({ type: 'TRANSITION1' });
      expect(store.getState().state).toBe('STATE1');
      await Promise.delay(200);
      expect(store.getState().state).toBe('STATE2');
    });

    it('can handle cancellation', async () => {
      let cancelCalled = false;
      const promiseGenerator = ({ dispatch, getState, take }) => {
        const promise = (async () => {
          await null; // force returning a promise before dispatching
          dispatch({ type: 'LOAD' });
          expect(() => dispatch({ type: 'ANYTHING' })).toThrow();
        })();
        promise.cancel = () => { cancelCalled = true; };
        return promise;
      };
      const reducer = (state = { state: 'STATE0' }, action) => {
        switch (action.type) {
          case 'TRANSITION1':
            return {
              ...state,
              state: 'STATE1',
              blackbox: new AsyncBlackBox(promiseGenerator)
            };
          case 'LOAD':
            return {
              ...state,
              state: 'LOADING_HANGED',
              blackbox: null
            };
          default:
            return state;
        }
      };

      const store = createStore(reducer, undefined, applyMiddleware(blackBoxMiddleware));

      expect(store.getState().state).toBe('STATE0');
      store.dispatch({ type: 'TRANSITION1' });
      expect(store.getState().state).toBe('STATE1');
      await Promise.delay(200);
      expect(store.getState().state).toBe('LOADING_HANGED');
      expect(cancelCalled).toBeTruthy();
    });

    it('handle cancellation even if it happens before promise returned', async () => {
      let cancelCalled = false;
      const promiseGenerator = ({ dispatch, getState, take }) => {
        const promise = (async () => {
          dispatch({ type: 'LOAD' }); // immediate dispatch before promise is returned
          expect(() => dispatch({ type: 'ANYTHING' })).toThrow();
        })();
        promise.cancel = () => { cancelCalled = true; };
        return promise;
      };
      const reducer = (state = { state: 'STATE0' }, action) => {
        switch (action.type) {
          case 'TRANSITION1':
            return {
              ...state,
              blackbox: new AsyncBlackBox(promiseGenerator)
            };
          case 'LOAD':
            return {
              ...state,
              blackbox: null
            };
          default:
            return state;
        }
      };

      const store = createStore(reducer, undefined, applyMiddleware(blackBoxMiddleware));

      store.dispatch({ type: 'TRANSITION1' });
      await Promise.delay(200);
      expect(cancelCalled).toBeTruthy();
    });

    it('handles getState', async () => {
      const reducer = (state = { state: 'STATE0', urn: 'abc' }, action) => {
        switch (action.type) {
          case 'TRANSITION1':
            return {
              ...state,
              state: 'STATE1',
              blackBox: new AsyncBlackBox(
                async ({ dispatch, getState, take }) => {
                  expect(getState().state).toBe('STATE1');
                  expect(getState().blackBox).toBeTruthy();
                }
              )
            };
          default:
            return state;
        }
      };

      const store = createStore(reducer, undefined, applyMiddleware(blackBoxMiddleware));

      expect(store.getState().state).toBe('STATE0');
      store.dispatch({ type: 'TRANSITION1' });
      await Promise.delay(200);
    });

    it('example of chained black boxes', async () => {
      const reducer = (state = { }, action) => {
        switch (action.type) {
          case 'START':
            return {
              ...state,
              blackBox: new AsyncBlackBox(
                async ({ dispatch, getState, take }) => {
                  await null; // force returning a promise

                  dispatch({ type: 'LOAD' });
                  expect(getState().loadSideEffect).toBeInstanceOf(PromiseBlackBox);

                  await Promise.delay(1);
                  expect(getState().loadSideEffect).toBeFalsy();
                }
              )
            };
          case 'LOAD':
            return {
              ...state,
              loadSideEffect: new PromiseBlackBox(() => ({ type: 'LOADED' }))
            };
          case 'LOADED':
            return {
              ...state,
              loadSideEffect: null
            };
          default:
            return state;
        }
      };

      const store = createStore(reducer, undefined, applyMiddleware(blackBoxMiddleware));

      store.dispatch({ type: 'START' });
      await Promise.delay(10);
    });

    it('can handle take with string', async () => {
      const reducer = (state = { state: 'STATE0', urn: 'abc' }, action) => {
        switch (action.type) {
          case 'TRANSITION1':
            return {
              ...state,
              state: 'STATE1',
              blackBox: new AsyncBlackBox(
                async ({ dispatch, getState, take }) => {
                  await null; // force returning a promise

                  dispatch({ type: 'LOAD' });
                  await take('LOADED');
                  dispatch({ type: 'TRANSITION2' });
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
            };
          default:
            return state;
        }
      };

      const store = createStore(reducer, undefined, applyMiddleware(blackBoxMiddleware));

      expect(store.getState().state).toBe('STATE0');
      store.dispatch({ type: 'TRANSITION1' });
      expect(store.getState().state).toBe('STATE1');
      await Promise.resolve();
      expect(store.getState().state).toBe('STATE2');
    });
  });

  it('can handle take with no args or wildcard', async () => {
    const reducer = (state = { state: 'STATE0', urn: 'abc' }, action) => {
      switch (action.type) {
        case 'TRANSITION1':
          return {
            ...state,
            state: 'STATE1',
            blackBox: new AsyncBlackBox(
              async ({ dispatch, getState, take }) => {
                await null; // force returning a promise

                dispatch({ type: 'LOAD' });
                await take('*');
                dispatch({ type: 'LOAD' });
                await take();
                dispatch({ type: 'TRANSITION2' });
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
          };
        default:
          return state;
      }
    };

    const store = createStore(reducer, undefined, applyMiddleware(blackBoxMiddleware));

    expect(store.getState().state).toBe('STATE0');
    store.dispatch({ type: 'TRANSITION1' });
    expect(store.getState().state).toBe('STATE1');
    await Promise.resolve();
    expect(store.getState().state).toBe('STATE2');
  });

  it('can handle take with array', async () => {
    const reducer = (state = { state: 'STATE0', urn: 'abc' }, action) => {
      switch (action.type) {
        case 'TRANSITION1':
          return {
            ...state,
            state: 'STATE1',
            blackBox: new AsyncBlackBox(
              async ({ dispatch, getState, take }) => {
                await null; // force returning a promise

                dispatch({ type: 'LOAD' });
                await take(['ACTION1', act => act.type === 'ACTION2', 'LOADED']);
                dispatch({ type: 'TRANSITION2' });
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
          };
        default:
          return state;
      }
    };

    const store = createStore(reducer, undefined, applyMiddleware(blackBoxMiddleware));

    expect(store.getState().state).toBe('STATE0');
    store.dispatch({ type: 'TRANSITION1' });
    expect(store.getState().state).toBe('STATE1');
    await Promise.resolve();
    expect(store.getState().state).toBe('STATE2');
  });

  it('can handle a custom black box', async () => {
    class WebsocketSubsystem extends AbstractBlackBox {
      constructor(url) {
        super();
        this._url = url;
      }

      onLoad({ dispatch }) {
        this.websocket = setInterval(() => dispatch({ type: 'TRANSITION2' }), 50);
      }

      onUnload() {
        clearInterval(this.websocket);
        this.websocket = null;
      }
    }

    const reducer = (state = { state: 'STATE0', cnt: 0 }, action) => {
      switch (action.type) {
        case 'TRANSITION1':
          return {
            ...state,
            state: 'STATE1',
            blackBox: new WebsocketSubsystem('ws:server.org')
          };
        case 'TRANSITION2':
          console.assert(state.state === 'STATE1' || state.state === 'STATE2');
          return {
            ...state,
            state: 'STATE2',
            cnt: state.cnt + 1,
            blackBox: state.cnt + 1 === 6 ? null : state.blackBox
          };
        default:
          return state;
      }
    };

    const store = createStore(reducer, undefined, applyMiddleware(blackBoxMiddleware));

    expect(store.getState().state).toBe('STATE0');
    store.dispatch({ type: 'TRANSITION1' });
    expect(store.getState().state).toBe('STATE1');
    await Promise.delay(200);
    expect(store.getState().state).toBe('STATE2');
    expect(store.getState().cnt).toBe(3);
    await Promise.delay(200);
    expect(store.getState().cnt).toBe(6);
  });
});
