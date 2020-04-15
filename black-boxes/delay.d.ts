import { ReduxAction } from '../lib'

declare module '@oqton/redux-black-box/black-boxes/delay' {

    class DelayedAction {
        constructor(ms: number, action: ReduxAction)
    }

}