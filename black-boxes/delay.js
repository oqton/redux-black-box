const PromiseBlackBox = require('../lib').PromiseBlackBox;

class DelayedAction extends PromiseBlackBox {
  constructor(ms, action) {
    super(() => {
      let timeout;
      const delayPromise = new Promise((res) => { timeout = setTimeout(res, ms); })
        .then(() => action);
      delayPromise.cancel = () => clearTimeout(timeout);
      return delayPromise;
    });

    this.ms = ms; // store delay
  }
}

module.exports = { DelayedAction };
