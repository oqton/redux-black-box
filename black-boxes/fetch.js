const PromiseBlackBox = require('../lib').PromiseBlackBox;

class ApiError extends Error {
  constructor(status, statusText, payload) {
    super();
    this.name = 'ApiError';
    this.status = status;
    this.statusText = statusText;
    this.payload = payload;
    this.message = `${status} - ${statusText}`;
  }
}

async function getPayload(res) {
  const contentType = res.headers.get('Content-Type');
  if (contentType && contentType.indexOf('json')) {
    return res.json();
  }
  return res.body;
}

class FetchSideEffect extends PromiseBlackBox {
  constructor(urlOrRequestObject, successActionCreatorOrType, failureActionCreatorOrType) {
    const abortController = new AbortController();
    const successActionCreator = typeof successActionCreatorOrType === 'function'
      ? successActionCreatorOrType
      : async (res) => {
        const payload = await getPayload(res);
        return { type: successActionCreatorOrType, payload };
      };
    const failureActionCreator = typeof failureActionCreatorOrType === 'function'
      ? failureActionCreatorOrType
      : async (res, error) => {
        if (error) {
          return { type: failureActionCreatorOrType, payload: error };
        }
        const payload = await getPayload(res);
        return { type: failureActionCreatorOrType, payload: new ApiError(res.status, res.statusText, payload) };
      };
    super(() => {
      const fetchPromise = fetch(urlOrRequestObject, { signal: abortController.signal })
        .then(
          res => (res.ok ? successActionCreator(res) : failureActionCreator(res)),
          err => failureActionCreator(null, err)
        );
      fetchPromise.cancel = () => {
        abortController.abort();
      };
      return fetchPromise;
    });
  }
}

module.exports = { FetchSideEffect };
