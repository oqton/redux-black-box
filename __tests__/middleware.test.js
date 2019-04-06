import { createStore, applyMiddleware } from 'redux';

import { blackBoxMiddleware } from '../lib';

global.console.assert = (check, msg) => { if (!check) throw new Error(msg || 'AssertionError'); };

describe('middleware tests', () => {
  it('acts as a reducer', () => {
    const reducer = (state = { state: 'STATE0' }, action) => {
      switch (action.type) {
        case 'TRANSITION1':
          return { state: 'STATE1' };
        default:
          return state;
      }
    };

    const store = createStore(reducer, undefined, applyMiddleware(blackBoxMiddleware));
    expect(store.getState().state).toBe('STATE0');
    store.dispatch({ type: 'TRANSITION1' });
    expect(store.getState().state).toBe('STATE1');
  });

  it('handle actions dispatched at unconvenient times (during execution of middleware)', () => {
    const reducer = (state = { state: 'STATE0' }, action) => {
      switch (action.type) {
        case 'TRANSITION1':
          return { state: 'STATE1' };
        case 'TRANSITION2':
          return { state: 'STATE2' };
        default:
          return state;
      }
    };

    const store = createStore(reducer, undefined, applyMiddleware(blackBoxMiddleware));
    expect(store.getState().state).toBe('STATE0');
    store.subscribe(() => {
      if (store.getState().state === 'STATE1') store.dispatch({ type: 'TRANSITION2' });
    });
    store.dispatch({ type: 'TRANSITION1' });
    expect(store.getState().state).toBe('STATE2');
  });

  it('middleware order of execution test', () => {
    function testMiddleware({ dispatch, getState }) {
      return next => (action) => {
        // console.log('start', action, getState());
        const returnValue = next(action);
        if (action.type === 'TRANSITION1') {
          // console.log('dispatch sub', action, getState());
          dispatch({ type: 'TRANSITION2' });
        }
        // console.log('stop', action, getState());
        return returnValue;
      };
    }

    const reducer = (state = { state: 'STATE0' }, action) => {
      switch (action.type) {
        case 'TRANSITION1':
          return { state: 'STATE1' };
        case 'TRANSITION2':
          return { state: 'STATE2' };
        default:
          return state;
      }
    };

    const store = createStore(reducer, undefined, applyMiddleware(testMiddleware));
    expect(store.getState().state).toBe('STATE0');
    store.dispatch({ type: 'TRANSITION1' });
    expect(store.getState().state).toBe('STATE2');
  });
});
