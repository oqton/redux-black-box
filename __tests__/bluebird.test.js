import { Promise } from 'bluebird';

Promise.config({
  // Enable cancellation
  cancellation: true,
});

it('cancel promise', async () => {
  let flag = false;
  const p = Promise.delay(100).then(() => { flag = true; });
  expect(p.isCancellable()).toBeTruthy();
  expect(flag).toBeFalsy();
  p.cancel(new Error());
  await Promise.delay(200);
  expect(flag).toBeFalsy();
});

describe('order of execution', () => {
  it('with delay', () => {
    let flag = false;
    Promise.delay(100).then(() => { flag = true; });
    expect(flag).toBeFalsy();
  });
  it('without delay', () => {
    let flag = false;
    Promise.resolve().then(() => { flag = true; });
    expect(flag).toBeFalsy();
  });
  it('async function', () => {
    let flag = false;
    (async () => { flag = true; })();
    expect(flag).toBeTruthy(); // async function is executed immediately
  });
  it('async function with await', () => {
    let flag = false;
    (async () => { await null; flag = true; })();
    expect(flag).toBeFalsy(); // async function is executed immediately
  });
});
