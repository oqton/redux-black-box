import { createStore, applyMiddleware, combineReducers } from 'redux';
import { fetchMock } from 'fetch-mock';

import { PromiseBlackBox, ReduxBlackBox, blackBoxMiddleware } from '../lib';

const delay = ms => new Promise(res => setTimeout(res, ms));

global.console.assert = (check, msg) => { if (!check) throw new Error(msg || 'AssertionError'); };

export const jobItem = {
  job: {
    urn: 'urn:alpha:abc',
    created: '2018-11-29T15:18:07.248044017Z',
    inputs: {}
  }
};

export const jobStateCompleted = {
  state: 'STATE_COMPLETED',
  progress: 100,
  description: 'Completed',
  updated: '2018-11-29T15:49:17.022455539Z',
  history: [],
  reason: ''
};

export const jobStateRunning = {
  state: 'STATE_PROCESSING',
  progress: 100,
  description: 'Completed',
  updated: '2018-11-29T15:49:17.022455539Z',
  history: [],
  reason: ''
};

export const jobNotices = {
  notices: [{
    severity: 'SEVERITY_INFO', code: 0, message: 'Starting job', time: '2018-11-29T15:18:23.681484Z'
  }]
};


export const jobOutputs = {
  outputs: {
    step1: {},
    step2: {},
  }
};

const API_ENDPOINT = 'http://server.org';
export const JobsAPI = {
  // JOBS
  getJobsStatus: () =>
    fetch(
      `${API_ENDPOINT}/v1/jobs/status`,
      { method: 'GET', body: null }
    ),

  createJob: request =>
    fetch(
      `${API_ENDPOINT}/v1/jobs`,
      { method: 'POST', body: JSON.stringify(request) }
    ),

  getJobState: jobUrn =>
    fetch(
      `${API_ENDPOINT}/v1/jobs/${jobUrn}/state`,
      { method: 'GET', body: null }
    ),

  getJobNotices: jobUrn =>
    fetch(
      `${API_ENDPOINT}/v1/jobs/${jobUrn}/notices`,
      { method: 'GET', body: null }
    ),

  getJobOutputs: jobUrn =>
    fetch(
      `${API_ENDPOINT}/v1/jobs/${jobUrn}/outputs`,
      { method: 'GET', body: null }
    ),

  getJobItem: jobUrn =>
    fetch(
      `${API_ENDPOINT}/v1/jobs/${jobUrn}/item`,
      { method: 'GET', body: null }
    ),

  cancelJob: jobUrn =>
    fetch(
      `${API_ENDPOINT}/v1/jobs/${jobUrn}/cancel`,
      { method: 'POST', body: null }
    ),
};

const JobStates = {
  STATE_UNINITIALIZED: 'STATE_UNINITIALIZED',
  STATE_NOT_RECEIVED: 'STATE_NOT_RECEIVED',
  STATE_RECEIVING: 'STATE_RECEIVING',
  STATE_RECEIVED: 'STATE_RECEIVED',
  STATE_PROCESSING: 'STATE_PROCESSING',
  STATE_COMPLETED: 'STATE_COMPLETED',
  STATE_FAILED: 'STATE_FAILED',
  STATE_ABORTING: 'STATE_ABORTING',
  STATE_ABORTED: 'STATE_ABORTED',
};
const LoadingStates = {
  UNLOADED: 'UNLOADED',
  LOADING: 'LOADING',
  LOADED: 'LOADED',
};
const ActionTypes = {
  // commands
  CREATE: 'CREATE',
  UNLOAD: 'UNLOAD',
  LOAD: 'LOAD',
  RUN: 'RUN',
  ABORT: 'ABORT',


  LOAD_SUCCESS: 'LOAD_SUCCESS',
  UPDATE_JOB_STATE: 'UPDATE_JOB_STATE',
  RUN_SUCCESS: 'RUN_SUCCESS',
  ABORT_SUCCESS: 'ABORT_SUCCESS'
};

export const isRunningState = (state) => {
  console.assert(JobStates[state], `Unknown state: ${state}`);
  return [JobStates.STATE_RECEIVING,
    JobStates.STATE_RECEIVED, JobStates.STATE_PROCESSING, JobStates.STATE_ABORTING].includes(state);
};

export const isFinishedState = (state) => {
  console.assert(JobStates[state], `Unknown state: ${state}`);
  return [JobStates.STATE_FAILED, JobStates.STATE_COMPLETED, JobStates.STATE_ABORTED].includes(state);
};

export const isSuccessState = (state) => {
  console.assert(JobStates[state], `Unknown state: ${state}`);
  return [JobStates.STATE_COMPLETED].includes(state);
};

export const isFinishedUnsuccessfullyState = (state) => {
  console.assert(JobStates[state], `Unknown state: ${state}`);
  return [JobStates.STATE_FAILED, JobStates.STATE_ABORTED].includes(state);
};


describe('job handler state machine', () => {
  const jobHandlerReducer = (
    state = {
      loadingState: {
        state: LoadingStates.UNLOADED,
        numRefs: 0,
      },

      // job data
      request: null,
      jobUrn: null,
      startTime: 0,
      jobState: {
        state: JobStates.STATE_NOT_RECEIVED,
        progress: 0,
        description: null,
      },
      error: null,
      notices: null,
      outputs: null,
      runTime: 0,
    },
    action,
  ) => {
    switch (action.type) {
      /* CREATE COMMAND */
      case ActionTypes.CREATE:
        console.assert(state.loadingState.state === LoadingStates.UNLOADED, `Unexpected state: ${state.stateName}`);
        return {
          ...state,
          loadingState: { ...state.loadingState, state: LoadingStates.LOADED },
          jobUrn: action.jobUrn,
          request: action.request,
          startTime: action.startTime
        };

      /* LOAD COMMAND */
      case ActionTypes.LOAD:
        if (state.loadingState.state === LoadingStates.UNLOADED) {
          // start loading process
          console.assert(state.loadingState.numRefs === 0);
          return {
            ...state,
            jobUrn: action.jobUrn,
            loadingState: {
              ...state.loadingState,
              state: LoadingStates.LOADING,
              numRefs: 1
            },
            loadSideEffect: new PromiseBlackBox(() =>
              Promise.all([
                JobsAPI.getJobItem(action.jobUrn),
                JobsAPI.getJobState(action.jobUrn),
                JobsAPI.getJobNotices(action.jobUrn),
                JobsAPI.getJobOutputs(action.jobUrn)
              ])
                .then(resArray => Promise.all(resArray.map(res => res.json())))
                .then(([item, stateRes, notices, outputs]) => (
                  {
                    type: ActionTypes.LOAD_SUCCESS,
                    jobUrn: action.jobUrn,
                    request: item.job,
                    state: stateRes,
                    notices,
                    outputs
                  })))
          };
        }
        return {
          ...state,
          loadingState: {
            ...state.loadingState,
            numRefs: state.numRefs + 1
          }
        };

        /* LOADING PROCESS */
      case ActionTypes.LOAD_SUCCESS:
        console.assert(state.loadingState.state === LoadingStates.LOADING, `Unexpected state: ${state.stateName}`);
        // console.log(action.state);
        return {
          ...state,
          loadingState: { ...state.loadingState, state: LoadingStates.LOADED },
          request: action.request,
          jobState: action.state,
          notices: action.notices,
          outputs: action.outputs,
          loadSideEffect: null,
          pollingSideEffect: isRunningState(action.state.state)
            ? new PromiseBlackBox(() => delay(50)
              .then(() => JobsAPI.getJobState(state.jobUrn).then(res => res.json()))
              .then(stateRes => ({ type: ActionTypes.UPDATE_JOB_STATE, state: stateRes }))) : null
        };

        /* POLLING PROCESS */
      case ActionTypes.UPDATE_JOB_STATE:
        console.assert(state.loadingState.state === LoadingStates.LOADED, `Unexpected state: ${state.stateName}`);
        // console.log(action.state);
        return {
          ...state,
          jobState: action.state,
          pollingSideEffect: isRunningState(action.state.state)
            ? new PromiseBlackBox(() => delay(50)
              .then(() => JobsAPI.getJobState(state.jobUrn).then(res => res.json()))
              .then(stateRes => ({ type: ActionTypes.UPDATE_JOB_STATE, state: stateRes }))) : null
        };

        /* UNLOAD COMMAND */
      case ActionTypes.UNLOAD:
        console.assert(state.loadingState.state === LoadingStates.LOADING
          || state.loadingState.state === LoadingStates.LOADED);
        if (state.loadingState.numRefs === 1) {
          return {
            ...state,
            loadingState: {
              ...state.loadingState,
              state: LoadingStates.UNLOADED,
              numRefs: 0,
            },
            request: null,
            jobState: null,
            notices: null,
            outputs: null,
            loadSideEffect: null,
            pollingSideEffect: null,
          };
        }
        return {
          ...state,
          loadingState: {
            ...state.loadingState,
            numRefs: state.numRefs - 1,
          }
        };


        /* RUN COMMAND */
      case ActionTypes.RUN:
        console.assert(state.loadingState.state === LoadingStates.LOADED, `Unexpected state: ${state.stateName}`);
        console.assert(state.jobState.state === JobStates.STATE_NOT_RECEIVED, `Unexpected state: ${state.stateName}`);
        return {
          ...state,
          numRefs: 0,
          jobState: { ...state.jobState, state: JobStates.STATE_RECEIVING },
          runSideEffect: new PromiseBlackBox(() => JobsAPI.createJob(state.request)
            .then(() => ({ type: ActionTypes.RUN_SUCCESS })))
        };

        /* RUN PROCESS */
      case ActionTypes.RUN_SUCCESS:
        console.assert(state.loadingState.state === LoadingStates.LOADED, `Unexpected state: ${state.stateName}`);
        console.assert(state.jobState.state === JobStates.STATE_RECEIVING, `Unexpected state: ${state.stateName}`);
        return {
          ...state,
          jobState: { ...state.jobState, state: JobStates.STATE_RECEIVED },
          runSideEffect: null,
          pollingSideEffect: new PromiseBlackBox(() => delay(50)
            .then(() => JobsAPI.getJobState(state.jobUrn).then(res => res.json()))
            .then(stateRes => ({ type: ActionTypes.UPDATE_JOB_STATE, state: stateRes })))
        };

        /* ABORT COMMAND */
      case ActionTypes.ABORT:
        console.assert(state.loadingState.state === LoadingStates.LOADED, `Unexpected state: ${state.stateName}`);
        // console.assert(state.jobState.state === JobStates.STATE_RECEIVED, `Unexpected state: ${state.stateName}`);
        return {
          ...state,
          jobState: { ...state.jobState, state: JobStates.STATE_ABORTING },
          abortingSideEffect: new PromiseBlackBox(() => JobsAPI.cancelJob(state.jobUrn)
            .then(() => ({ type: ActionTypes.ABORT_SUCCESS }))),
          pollingSideEffect: null
        };

        /* ABORT PROCESS */
      case ActionTypes.ABORT_SUCCESS:
        console.assert(state.loadingState.state === LoadingStates.LOADED, `Unexpected state: ${state.stateName}`);
        console.assert(state.jobState.state === JobStates.STATE_ABORTING, `Unexpected state: ${state.stateName}`);
        return {
          ...state,
          jobState: { ...state.jobState, state: JobStates.STATE_ABORTED },
          abortingSideEffect: null
        };

      default:
        return state;
    }
  };

  afterEach(() => fetchMock.reset());

  it('handles loading and polling', async () => {
    fetchMock
      .get('express:/v1/jobs/:jobUrn/item',
        { status: 200, body: jobItem },
        { sendAsJson: true })
      .get('express:/v1/jobs/:jobUrn/state',
        { status: 200, body: jobStateRunning },
        { sendAsJson: true, repeat: 4 })
      .get('express:/v1/jobs/:jobUrn/state',
        { status: 200, body: jobStateCompleted },
        { sendAsJson: true, overwriteRoutes: false })
      .get('express:/v1/jobs/:jobUrn/notices',
        { status: 200, body: jobNotices },
        { sendAsJson: true })
      .get('express:/v1/jobs/:jobUrn/outputs',
        { status: 200, body: jobOutputs },
        { sendAsJson: true });

    const store = createStore(jobHandlerReducer, undefined, applyMiddleware(blackBoxMiddleware));

    expect(store.getState().loadingState.state).toBe(LoadingStates.UNLOADED);
    store.dispatch({ type: ActionTypes.LOAD, jobUrn: 'abc' });
    await delay(200);
    expect(store.getState().loadingState.state).toBe(LoadingStates.LOADED);
    expect(store.getState().jobState.state).toBe(JobStates.STATE_PROCESSING);
    await delay(300);
    expect(store.getState().jobState.state).toBe(JobStates.STATE_COMPLETED);
    store.dispatch({ type: ActionTypes.UNLOAD, jobUrn: 'abc' });
    expect(store.getState().loadingState.state).toBe(LoadingStates.UNLOADED);
  });

  it('handles create, run and abort', async () => {
    fetchMock
      .post('express:/v1/jobs',
        { status: 200, body: jobItem },
        { sendAsJson: true })
      .get('express:/v1/jobs/:jobUrn/state',
        { status: 200, body: jobStateRunning },
        { sendAsJson: true, repeat: 4 })
      .get('express:/v1/jobs/:jobUrn/state',
        { status: 200, body: jobStateCompleted },
        { sendAsJson: true, overwriteRoutes: false })
      .post('express:/v1/jobs/:jobUrn/cancel',
        { status: 200 },
        { sendAsJson: true });

    const store = createStore(jobHandlerReducer, undefined, applyMiddleware(blackBoxMiddleware));

    expect(store.getState().loadingState.state).toBe(LoadingStates.UNLOADED);
    store.dispatch({ type: ActionTypes.CREATE, jobUrn: 'abc', request: { nothing: 'here' } });
    await delay(200);
    expect(store.getState().loadingState.state).toBe(LoadingStates.LOADED);
    expect(store.getState().jobState.state).toBe(JobStates.STATE_NOT_RECEIVED);
    store.dispatch({ type: ActionTypes.RUN, jobUrn: 'abc' });
    expect(store.getState().jobState.state).toBe(JobStates.STATE_RECEIVING);
    await delay(100);
    expect(store.getState().jobState.state).toBe(JobStates.STATE_PROCESSING);
    await delay(300);
    expect(store.getState().jobState.state).toBe(JobStates.STATE_COMPLETED);
    store.dispatch({ type: ActionTypes.ABORT, jobUrn: 'abc' });
    expect(store.getState().jobState.state).toBe(JobStates.STATE_ABORTING);
    await delay(100);
    expect(store.getState().jobState.state).toBe(JobStates.STATE_ABORTED);
  });


  it('job handler as a dependency of another process', async () => {
    fetchMock
      .get('express:/v1/jobs/:jobUrn/item',
        { status: 200, body: jobItem },
        { sendAsJson: true })
      .get('express:/v1/jobs/:jobUrn/state',
        { status: 200, body: jobStateRunning },
        { sendAsJson: true, repeat: 4 })
      .get('express:/v1/jobs/:jobUrn/state',
        { status: 200, body: jobStateCompleted },
        { sendAsJson: true, overwriteRoutes: false })
      .get('express:/v1/jobs/:jobUrn/notices',
        { status: 200, body: jobNotices },
        { sendAsJson: true })
      .get('express:/v1/jobs/:jobUrn/outputs',
        { status: 200, body: jobOutputs },
        { sendAsJson: true });

    const processReducer = (state = { state: 'WAITING' }, action) => {
      switch (action.type) {
        case 'START':
          return {
            ...state,
            state: 'STEP0',
            loadSideEffect: new ReduxBlackBox(
              { type: ActionTypes.LOAD, jobUrn: 'abc' },
              { type: 'STEP_TO1' },
              (act, st) => act.type === ActionTypes.LOAD_SUCCESS
                || (act.type === ActionTypes.LOAD && st.jobHandler.loadingState.state === LoadingStates.LOADED)
            )
          };
        case 'STEP_TO1':
          return {
            ...state,
            state: 'STEP1'
          };
        case 'START_AGAIN':
          return {
            ...state,
            state: 'STEP2',
            loadSideEffect: new ReduxBlackBox(
              { type: ActionTypes.LOAD, jobUrn: 'abc' },
              { type: 'STEP_TO3' },
              (act, st) => act.type === ActionTypes.LOAD_SUCCESS
                || (act.type === ActionTypes.LOAD && st.jobHandler.loadingState.state === LoadingStates.LOADED)
            )
          };
        case 'STEP_TO3':
          return {
            ...state,
            state: 'STEP3'
          };
        default:
          return state;
      }
    };
    const reducer = combineReducers({ jobHandler: jobHandlerReducer, process: processReducer });

    const store = createStore(reducer, undefined, applyMiddleware(blackBoxMiddleware));

    expect(store.getState().process.state).toBe('WAITING');
    expect(store.getState().jobHandler.loadingState.state).toBe(LoadingStates.UNLOADED);
    store.dispatch({ type: 'START' });
    await delay(200);
    expect(store.getState().jobHandler.loadingState.state).toBe(LoadingStates.LOADED);
    expect(store.getState().jobHandler.jobState.state).toBe(JobStates.STATE_PROCESSING);
    expect(store.getState().process.state).toBe('STEP1');
    store.dispatch({ type: 'START_AGAIN' });
    expect(store.getState().jobHandler.loadingState.state).toBe(LoadingStates.LOADED);
    await delay(200);
    expect(store.getState().process.state).toBe('STEP3');
  });
});
