
declare module '@oqton/redux-black-box' {

    interface ReduxAction {
        type: string;
        [rest]: any;
    }
    interface Store {
        dispatch: (action: ReduxAction) => any;
        getState: () => any;
        abortSignal: AbortSignal
    }
    type TakeFilter = (action: ReduxAction) => boolean;
    interface StoreWithTake extends Store {
        take: TakeFilter
    }
    type ReduxMiddleware = any;

    class AbstractBlackBox {
        constructor();

        onAction(action: ReduxAction, store: Store): void | Promise<void>;

        onLoad(store: Store): void | Promise<void>;

        onUnload(store: Store): void | Promise<void>;
    }

    class AsyncBlackBox {
        constructor(promiseGenerator: (store: StoreWithTake) => Promise<ReduxAction | void>);
    }

    class PromiseBlackBox {
        constructor(promiseGenerator: (abortSignal: AbortSignal) => Promise<ReduxAction | void>);
    }

    class ReduxBlackBox {
        constructor(actionStart: ReduxAction, actionAfter: ReduxAction = null, take: TakeFilter = () => true);
    }

    function blackBoxMiddleware({ dispatch, getState }: Store): ReduxMiddleware;

    function createBlackBoxMiddleware(ignoredPaths: string[][]): ReduxMiddleware;

}

