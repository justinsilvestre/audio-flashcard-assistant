import { combineReducers } from 'redux'

import clips from './clips'
import session from './session'
import snackbar from './snackbar'
import dialog from './dialog'
import subtitles from './subtitles'
import settings from './settings'
import fileAvailabilities from './fileAvailabilities'
import files from './files'
import { PersistConfig, createTransform, persistReducer } from 'redux-persist'
import createElectronStorage from 'redux-persist-electron-storage'
import { resetFileAvailabilities } from '../utils/statePersistence'
import A from '../types/ActionType'
import { Action } from '../actions'

const storage = createElectronStorage()
const whitelist: (keyof FilesState)[] = ['ProjectFile', 'Dictionary']
const filesPersistConfig: PersistConfig<
  FilesState,
  FilesState,
  FilesState,
  FilesState
> = {
  key: 'files',
  storage,
  whitelist,
}

const transform = createTransform(
  (inbound: FileAvailabilitiesState) => inbound,
  (outbound: FileAvailabilitiesState) => resetFileAvailabilities(outbound),
  {
    whitelist: ['fileAvailabilities'],
  }
)

const rootConfig: PersistConfig<AppState> = {
  key: 'root',
  storage,
  transforms: [transform],
  whitelist: ['settings', 'fileAvailabilities'],
}

const root = combineReducers<AppState>({
  clips,
  session,
  snackbar,
  dialog,
  subtitles,
  settings,
  fileAvailabilities,
  files: (persistReducer(filesPersistConfig, files) as unknown) as typeof files,
})

const persistedReducer = persistReducer(rootConfig, root)

const UNDOABLE_ACTIONS = new Set<Action['type']>([
  A.deleteCard,
  A.makeClipsFromSubtitles,
  A.deleteCards,
  A.setFlashcardField,
  A.addFlashcardTag,
  A.deleteFlashcardTag,
  A.editClip,
  A.addClip,
  A.addClips,
  A.mergeClips,
  A.moveClip,
  A.stretchClip,
])

const HISTORY_CLEARING_ACTIONS = new Set<Action['type']>([
  A.setCurrentFile,
  A.openProject,
  A.closeProject,
])

const MAX_HISTORY_STACK_SIZE = 50

// TODO: group text editing actions?

function undoable<S extends AppState>(
  reducer: (s: S | undefined, a: Action) => S
) {
  const initialState = reducer(undefined, {} as Action)
  return (
    stateWithHistory: WithHistory<S> = {
      ...initialState,
      lastHistoryAction: null,
      previous: [],
      next: [],
    },
    action: Action
  ): WithHistory<S> => {
    if (action.type === A.undo) {
      const { previous, next, lastHistoryAction, ...state } = stateWithHistory
      const newCurrent = previous[previous.length - 1]
      if (!newCurrent) return stateWithHistory

      return {
        ...newCurrent.state,
        session: sessionAfterHistoryAction(
          state.session,
          newCurrent.state.session
        ),
        ...getStateUnaffectedByHistoryAction(state),
        lastHistoryAction: newCurrent.triggerAction,
        previous: previous.slice(0, previous.length - 1),
        next: [
          {
            state: (state as unknown) as S,
            triggerAction: lastHistoryAction,
          },
          ...next,
        ].slice(0, MAX_HISTORY_STACK_SIZE),
      }
    }

    if (action.type === A.redo) {
      const {
        previous,
        next: oldNext,
        lastHistoryAction,
        ...state
      } = stateWithHistory
      const [newCurrent, ...next] = oldNext
      if (!newCurrent) return stateWithHistory
      return {
        ...newCurrent.state,
        session: sessionAfterHistoryAction(
          state.session,
          newCurrent.state.session
        ),
        ...getStateUnaffectedByHistoryAction(state),
        lastHistoryAction: newCurrent.triggerAction,
        previous: [
          ...previous,
          { state: (state as unknown) as S, triggerAction: lastHistoryAction },
        ],
        next,
      }
    }

    if (UNDOABLE_ACTIONS.has(action.type)) {
      const {
        previous: oldPrevious,
        next: _oldNext,
        lastHistoryAction,
        ...stateRaw
      } = stateWithHistory
      const state: S = (stateRaw as unknown) as any
      const newState = reducer(state, action)

      const newPrevious: HistoryEntry<S>[] = [
        ...oldPrevious,
        { state, triggerAction: lastHistoryAction },
      ]
      const newNext: HistoryEntry<S>[] = []
      return {
        ...newState,
        lastHistoryAction: action,
        previous: newPrevious.slice(
          Math.max(0, newPrevious.length - MAX_HISTORY_STACK_SIZE),
          newPrevious.length
        ),
        next: newNext,
      }
    }

    if (HISTORY_CLEARING_ACTIONS.has(action.type)) {
      return {
        ...reducer(stateWithHistory, action),
        lastHistoryAction: null,
        previous: [],
        next: [],
      }
    }

    const newState = reducer(stateWithHistory, action)
    if (newState === stateWithHistory) return stateWithHistory

    return {
      ...newState,
      lastHistoryAction: stateWithHistory.lastHistoryAction,
      previous: stateWithHistory.previous,
      next: stateWithHistory.next,
    }
  }
}

function sessionAfterHistoryAction(
  base: SessionState,
  override: SessionState
): SessionState {
  return {
    ...base,
    editingCards: override.editingCards,
    loopMedia: override.loopMedia,
    defaultTags: override.defaultTags,
    defaultIncludeStill: override.defaultIncludeStill,
    tagsToClipIds: override.tagsToClipIds,
    waveformSelection: override.waveformSelection,
  }
}

function getStateUnaffectedByHistoryAction(state: AppState) {
  return {
    // waveform: state.waveform,
    // clips: state.clips,
    snackbar: state.snackbar,
    dialog: state.dialog,
    subtitles: state.subtitles,
    fileAvailabilities: state.fileAvailabilities,
    files: state.files,
    // session: state.session,
    settings: state.settings,
  }
}

const undoableReducer = undoable(persistedReducer)

export default undoableReducer
