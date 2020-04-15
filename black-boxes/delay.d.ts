import { ReduxAction } from '../lib'

declare namespace delay {

    class DelayedAction {
        constructor(ms: number, action: ReduxAction)
    }

}