import { createStore, applyMiddleware } from 'redux';

import { blackBoxMiddleware } from '../../lib';
import { DelayedAction } from '../delay';

global.console.assert = (check, msg) => { if (!check) throw new Error(msg || 'AssertionError'); };

const delay = ms => new Promise(res => setTimeout(res, ms));

describe('DelayedAction', () => {
  const reducer = (state = { state: 'UNLOADED', data: null }, action) => {
    switch (action.type) {
      case 'LOAD':
        return {
          ...state,
          state: 'LOADING',
          loadBlackBox: new DelayedAction(50, { type: 'LOAD_SUCCESS', data: 'test' })
        };
      case 'LOAD_SUCCESS':
        console.assert(state.state === 'LOADING');
        return {
          ...state,
          state: 'LOADED',
          data: action.data,
          loadBlackBox: null
        };
      case 'UNLOAD':
        return {
          ...state,
          state: 'UNLOADED',
          data: null,
          loadBlackBox: null
        };
      default:
        return state;
    }
  };

  it('dispatches delayed action', async () => {
    const store = createStore(reducer, undefined, applyMiddleware(blackBoxMiddleware));

    // succesful delayed action
    expect(store.getState().state).toBe('UNLOADED');
    store.dispatch({ type: 'LOAD' });
    expect(store.getState().state).toBe('LOADING');

    // test the existence of the side effect
    expect(store.getState().loadBlackBox).toBeInstanceOf(DelayedAction);
    expect(store.getState().loadBlackBox.ms).toBe(50);

    await delay(200);
    expect(store.getState().state).toBe('LOADED');
    store.dispatch({ type: 'UNLOAD' });
  });

  it('cancelled delayed action', async () => {
    const store = createStore(reducer, undefined, applyMiddleware(blackBoxMiddleware));

    // cancelled delayed action
    expect(store.getState().state).toBe('UNLOADED');
    store.dispatch({ type: 'LOAD' });
    expect(store.getState().state).toBe('LOADING');
    await delay(2);
    store.dispatch({ type: 'UNLOAD' });
    await delay(200);
    expect(store.getState().state).toBe('UNLOADED');
  });
});
