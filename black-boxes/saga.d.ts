import { ReduxAction, TakeFilter } from '../lib'

declare module '@oqton/redux-black-box/black-boxes/saga' {

    interface SagaEffect {
        '@@redux-black-box/saga': true;
        type: string;
        [rest]: any
    };

    class SagaBlackBox {
        constructor(saga: () => Generator<any, any, any>);
    }

    function all(sagas: Array<() => Generator<any, any, any>>): SagaEffect;

    function call(fn: (...args: any[]) => any, ...args: any[]): SagaEffect;

    function cancelled(): SagaEffect;

    function put(action: ReduxAction): SagaEffect;

    function putResolve(action: ReduxAction): SagaEffect;

    function select(selector: (...args: any[]) => any, ...args: any[]): SagaEffect;

    function take(filter: TakeFilter): SagaEffect;

}

