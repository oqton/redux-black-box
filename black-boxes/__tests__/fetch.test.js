import { createStore, applyMiddleware } from 'redux';
import { fetchMock } from 'fetch-mock';
import express from 'express';

import { blackBoxMiddleware } from '../../lib';
import { FetchSideEffect } from '../fetch';

global.console.assert = (check, msg) => { if (!check) throw new Error(msg || 'AssertionError'); };

const delay = ms => new Promise(res => setTimeout(res, ms));

describe('FetchSideEffect', () => {
  const reducer = (state = { state: 'UNLOADED', data: null }, action) => {
    switch (action.type) {
      case 'LOAD':
        return {
          ...state,
          state: 'LOADING',
          loadSideEffect: new FetchSideEffect('http://www.server.org/data', 'LOAD_SUCCESS', 'LOAD_FAILURE')
        };
      case 'LOAD_SUCCESS':
        console.assert(state.state === 'LOADING');
        return {
          ...state,
          state: 'LOADED',
          data: action.payload,
          loadSideEffect: null
        };
      case 'LOAD_FAILURE':
        return {
          ...state,
          state: 'UNLOADED',
          error: action.payload,
          loadSideEffect: null
        };
      case 'UNLOAD':
        return {
          ...state,
          state: 'UNLOADED',
          data: null,
          loadSideEffect: null
        };
      default:
        return state;
    }
  };

  afterEach(() => fetchMock.reset());

  it('succesful fetch', async () => {
    fetchMock
      .get('http://www.server.org/data',
        delay(20).then(() => ({ status: 200, body: { test: 'is a test' } })),
        { sendAsJson: true });

    const store = createStore(reducer, undefined, applyMiddleware(blackBoxMiddleware));

    // succesful fetch
    expect(store.getState().state).toBe('UNLOADED');
    store.dispatch({ type: 'LOAD' });
    expect(store.getState().state).toBe('LOADING');
    await delay(200);
    expect(store.getState().state).toBe('LOADED');
    expect(store.getState().data).toEqual({ test: 'is a test' });
  });

  it('failing fetch', async () => {
    fetchMock
      .get('http://www.server.org/data',
        delay(20).then(() => ({ status: 404, body: { test: 'is a test' } })),
        { sendAsJson: true });

    const store = createStore(reducer, undefined, applyMiddleware(blackBoxMiddleware));

    // failing fetch
    expect(store.getState().state).toBe('UNLOADED');
    store.dispatch({ type: 'LOAD' });
    expect(store.getState().state).toBe('LOADING');
    await delay(200);
    expect(store.getState().state).toBe('UNLOADED');
    expect(store.getState().error).toBeTruthy();
  });


  describe('real fetch', () => {
    const realReducer = (state = { state: 'UNLOADED', data: null }, action) => {
      switch (action.type) {
        case 'LOAD':
          return {
            ...state,
            state: 'LOADING',
            loadSideEffect: new FetchSideEffect(
              new Request('http://localhost:9134'),
              'LOAD_SUCCESS', 'LOAD_FAILURE'
            )
          };
        case 'LOAD_SUCCESS':
          console.assert(state.state === 'LOADING');
          return {
            ...state,
            state: 'LOADED',
            data: action.payload,
            loadSideEffect: null
          };
        case 'LOAD_FAILURE':
          return {
            ...state,
            state: 'UNLOADED',
            error: action.payload,
            loadSideEffect: null
          };
        case 'UNLOAD':
          return {
            ...state,
            state: 'UNLOADED',
            data: null,
            loadSideEffect: null
          };
        default:
          return state;
      }
    };

    let server = null;
    afterEach(() => { if (server)server.close(); });

    it('real fetch', async () => {
      const app = express();
      app.get('/', (req, res) => {
        res.set('Access-Control-Allow-Origin', '*');
        res.send({ test: 'is a test' });
      });
      await new Promise((res) => { server = app.listen(9134, res); });

      const store = createStore(realReducer, undefined, applyMiddleware(blackBoxMiddleware));

      expect(store.getState().state).toBe('UNLOADED');
      store.dispatch({ type: 'LOAD' });
      expect(store.getState().state).toBe('LOADING');
      await delay(200);
      expect(store.getState().error).toBeFalsy();
      expect(store.getState().state).toBe('LOADED');
    });


    it('cancelled fetch', async () => {
      let finished = false;
      const app = express();
      app.get('/', async (req, res) => {
        await delay(20);
        finished = true;

        res.set('Access-Control-Allow-Origin', '*');
        res.send({ test: 'is a test' });
      });
      await new Promise((res) => { server = app.listen(9134, res); });

      const store = createStore(reducer, undefined, applyMiddleware(blackBoxMiddleware));

      // cancelled fetch
      expect(store.getState().state).toBe('UNLOADED');
      store.dispatch({ type: 'LOAD' });
      expect(store.getState().state).toBe('LOADING');
      await delay(2);
      store.dispatch({ type: 'UNLOAD' });
      await delay(200);
      expect(finished).toBeFalsy();
    });
  });
});
