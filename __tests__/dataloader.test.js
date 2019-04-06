import { createStore, applyMiddleware } from 'redux';

import { PromiseBlackBox, blackBoxMiddleware } from '../lib';

const delay = ms => new Promise(res => setTimeout(res, ms));

global.console.assert = (check, msg) => { if (!check) throw new Error(msg || 'AssertionError'); };

describe('dataloader test/use cases', () => {
  describe('Step 1', () => {
    const reducer = (state = { status: 'UNLOADED' }, action) => {
      switch (action.type) {
        case 'LOAD':
          return {
            ...state,
            status: 'LOADED'
          };
        case 'UNLOAD':
          return {
            ...state,
            status: 'UNLOADED'
          };
        default:
          return state;
      }
    };

    it('handles load and unload', async () => {
      const store = createStore(reducer);

      expect(store.getState().status).toBe('UNLOADED');
      store.dispatch({ type: 'LOAD' });
      expect(store.getState().status).toBe('LOADED');
      store.dispatch({ type: 'UNLOAD' });
      expect(store.getState().status).toBe('UNLOADED');
    });
  });


  describe('Step 2', () => {
    const reducer = (state = { status: 'UNLOADED', refCount: 0 }, action) => {
      switch (action.type) {
        case 'LOAD':
          return state.refCount === 0
            ? {
              ...state,
              status: 'LOADED',
              refCount: 1
            }
            : {
              ...state,
              refCount: state.refCount + 1
            };
        case 'UNLOAD':
          return state.refCount === 1
            ? {
              ...state,
              status: 'UNLOADED',
              refCount: 0
            }
            : {
              ...state,
              refCount: state.refCount - 1
            };
        default:
          return state;
      }
    };

    it('handles load and unload', async () => {
      const store = createStore(reducer);

      expect(store.getState().status).toBe('UNLOADED');
      store.dispatch({ type: 'LOAD' });
      expect(store.getState().status).toBe('LOADED');
      store.dispatch({ type: 'UNLOAD' });
      expect(store.getState().status).toBe('UNLOADED');
    });

    it('handles multiple loads and unloads', async () => {
      const store = createStore(reducer);

      expect(store.getState().status).toBe('UNLOADED');
      store.dispatch({ type: 'LOAD' });
      store.dispatch({ type: 'LOAD' });
      expect(store.getState().status).toBe('LOADED');
      store.dispatch({ type: 'UNLOAD' });
      expect(store.getState().status).toBe('LOADED');
      store.dispatch({ type: 'UNLOAD' });
      expect(store.getState().status).toBe('UNLOADED');
    });
  });


  describe('Step 3', () => {
    const reducer = (state = { status: 'UNLOADED', refCount: 0 }, action) => {
      switch (action.type) {
        case 'LOAD':
          return state.refCount === 0
            ? {
              ...state,
              status: 'LOADING',
              fetchCall: new PromiseBlackBox(() => delay(100) // Fetch calls have been replace with delay
                .then(data => ({ type: 'LOAD_SUCCESS', data }))),
              refCount: 1
            }
            : {
              ...state,
              refCount: state.refCount + 1
            };
        case 'LOAD_SUCCESS':
          return {
            ...state,
            status: 'LOADED',
            fetchCall: null, // fetch is done, so we do not need it anymore
            data: action.data
          };
        case 'UNLOAD':
          return state.refCount === 1
            ? {
              ...state,
              status: 'UNLOADED',
              fetchCall: null, // cancel any fetch calls
              refCount: 0
            }
            : {
              ...state,
              refCount: state.refCount - 1
            };
        default:
          return state;
      }
    };

    it('handles load and unload', async () => {
      const store = createStore(reducer, undefined, applyMiddleware(blackBoxMiddleware));

      expect(store.getState().status).toBe('UNLOADED');
      store.dispatch({ type: 'LOAD' });
      expect(store.getState().status).toBe('LOADING');
      await delay(200);
      expect(store.getState().status).toBe('LOADED');
      store.dispatch({ type: 'UNLOAD' });
      expect(store.getState().status).toBe('UNLOADED');
    });

    it('handles multiple loads and unloads', async () => {
      const store = createStore(reducer, undefined, applyMiddleware(blackBoxMiddleware));

      expect(store.getState().status).toBe('UNLOADED');
      store.dispatch({ type: 'LOAD' });
      store.dispatch({ type: 'LOAD' });
      expect(store.getState().status).toBe('LOADING');
      await delay(200);
      expect(store.getState().status).toBe('LOADED');
      store.dispatch({ type: 'UNLOAD' });
      expect(store.getState().status).toBe('LOADED');
      store.dispatch({ type: 'UNLOAD' });
      expect(store.getState().status).toBe('UNLOADED');
    });

    it('handles multiple loads and unloads', async () => {
      const store = createStore(reducer, undefined, applyMiddleware(blackBoxMiddleware));

      expect(store.getState().status).toBe('UNLOADED');
      store.dispatch({ type: 'LOAD' });
      expect(store.getState().status).toBe('LOADING');
      store.dispatch({ type: 'LOAD' });
      store.dispatch({ type: 'UNLOAD' });
      expect(store.getState().status).toBe('LOADING');
      await delay(200);
      expect(store.getState().status).toBe('LOADED');
      store.dispatch({ type: 'UNLOAD' });
      expect(store.getState().status).toBe('UNLOADED');
    });

    it('handles load cancellation', async () => {
      const store = createStore(reducer, undefined, applyMiddleware(blackBoxMiddleware));

      expect(store.getState().status).toBe('UNLOADED');
      store.dispatch({ type: 'LOAD' });
      store.dispatch({ type: 'LOAD' });
      await delay(10);
      expect(store.getState().status).toBe('LOADING');
      store.dispatch({ type: 'UNLOAD' });
      expect(store.getState().status).toBe('LOADING');
      store.dispatch({ type: 'UNLOAD' });
      expect(store.getState().status).toBe('UNLOADED');
      await delay(200);
      expect(store.getState().status).toBe('UNLOADED');
    });
  });


  describe('Step 4', () => {
    const reducer = (state = { status: 'UNLOADED', refCount: 0 }, action) => {
      switch (action.type) {
        case 'LOAD':
          return state.refCount === 0 && state.status === 'UNLOADED'
            ? {
              ...state,
              status: 'LOADING',
              fetchCall: new PromiseBlackBox(() => delay(100) // Fetch calls have been replace with delay
                .then(data => ({ type: 'LOAD_SUCCESS', data }))),
              refCount: 1
            }
            : {
              ...state,
              refCount: state.refCount + 1
            };
        case 'LOAD_SUCCESS':
          return {
            ...state,
            status: 'LOADED',
            fetchCall: null, // fetch is done, so we do not need it anymore
            data: action.data
          };
        case 'UNLOAD':
          return state.refCount === 1
            ? {
              ...state,
              status: 'UNLOADING',
              fetchCall: null, // cancel any fetch calls
              saveCall: state.status === 'LOADED'
                ? new PromiseBlackBox(() => delay(100) // Fetch calls have been replace with delay
                  .then(data => ({ type: 'UNLOAD_SUCCESS' })))
                : new PromiseBlackBox(async () => ({ type: 'UNLOAD_SUCCESS' })),
              refCount: 0
            }
            : {
              ...state,
              refCount: state.refCount - 1
            };
        case 'UNLOAD_SUCCESS':
          return state.refCount === 0
            ? {
              ...state,
              status: 'UNLOADED',
              saveCall: null, // save is done, so we do not need it anymore
              data: null,
            }
            : {
              ...state,
              status: 'LOADING',
              saveCall: null, // save is done, so we do not need it anymore
              data: null,
              fetchCall: new PromiseBlackBox(() => delay(100) // Fetch calls have been replace with delay
                .then(data => ({ type: 'LOAD_SUCCESS', data }))),
            };
        default:
          return state;
      }
    };

    it('handles load and unload', async () => {
      const store = createStore(reducer, undefined, applyMiddleware(blackBoxMiddleware));

      expect(store.getState().status).toBe('UNLOADED');
      store.dispatch({ type: 'LOAD' });
      expect(store.getState().status).toBe('LOADING');
      await delay(200);
      expect(store.getState().status).toBe('LOADED');
      store.dispatch({ type: 'UNLOAD' });
      expect(store.getState().status).toBe('UNLOADING');
      await delay(200);
      expect(store.getState().status).toBe('UNLOADED');
    });

    it('handles multiple loads and unloads', async () => {
      const store = createStore(reducer, undefined, applyMiddleware(blackBoxMiddleware));

      expect(store.getState().status).toBe('UNLOADED');
      store.dispatch({ type: 'LOAD' });
      store.dispatch({ type: 'LOAD' });
      expect(store.getState().status).toBe('LOADING');
      await delay(200);
      expect(store.getState().status).toBe('LOADED');
      store.dispatch({ type: 'UNLOAD' });
      expect(store.getState().status).toBe('LOADED');
      store.dispatch({ type: 'UNLOAD' });
      expect(store.getState().status).toBe('UNLOADING');
      await delay(200);
      expect(store.getState().status).toBe('UNLOADED');
    });

    it('handles multiple loads and unloads', async () => {
      const store = createStore(reducer, undefined, applyMiddleware(blackBoxMiddleware));

      expect(store.getState().status).toBe('UNLOADED');
      store.dispatch({ type: 'LOAD' });
      expect(store.getState().status).toBe('LOADING');
      store.dispatch({ type: 'LOAD' });
      store.dispatch({ type: 'UNLOAD' });
      expect(store.getState().status).toBe('LOADING');
      await delay(200);
      expect(store.getState().status).toBe('LOADED');
      store.dispatch({ type: 'UNLOAD' });
      expect(store.getState().status).toBe('UNLOADING');
      await delay(200);
      expect(store.getState().status).toBe('UNLOADED');
    });

    it('handles load cancellation', async () => {
      const store = createStore(reducer, undefined, applyMiddleware(blackBoxMiddleware));

      expect(store.getState().status).toBe('UNLOADED');
      store.dispatch({ type: 'LOAD' });
      expect(store.getState().status).toBe('LOADING');
      await delay(200);
      expect(store.getState().status).toBe('LOADED');
      store.dispatch({ type: 'UNLOAD' });
      await delay(10);
      expect(store.getState().status).toBe('UNLOADING');
      store.dispatch({ type: 'LOAD' });// unload cancellation
      expect(store.getState().status).toBe('UNLOADING');
      await delay(200);
      expect(store.getState().status).toBe('LOADED');
    });

    it('handles unload cancellation', async () => {
      const store = createStore(reducer, undefined, applyMiddleware(blackBoxMiddleware));

      expect(store.getState().status).toBe('UNLOADED');
      store.dispatch({ type: 'LOAD' });
      store.dispatch({ type: 'LOAD' });
      expect(store.getState().status).toBe('LOADING');
      store.dispatch({ type: 'UNLOAD' });
      expect(store.getState().status).toBe('LOADING');
      store.dispatch({ type: 'UNLOAD' });
      expect(store.getState().status).toBe('UNLOADING');
      await delay(200);
      expect(store.getState().status).toBe('UNLOADED');
      await delay(200);
      expect(store.getState().status).toBe('UNLOADED');
    });
  });
});
