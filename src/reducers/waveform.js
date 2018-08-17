import getViewbox from '../utils/getWaveformViewbox'

const initialState = {
  stepsPerSecond: 25,
  stepLength: 2,
  path: null,
  cursor: { x: 0, y: 0 },
  viewbox: getViewbox(),
  selections: [],
  pendingSelection: null,
  peaks: [],
}

export default function waveform(state = initialState, action) {
  switch (action.type) {
    case 'SET_WAVEFORM_PEAKS':
      return {
        ...state,
        peaks: action.peaks || [],
      }

    case 'SET_CURSOR_POSITION':
      return {
        ...state,
        cursor: {
          ...state.cursor,
          x: action.x,
        }
      }

    case 'ADD_WAVEFORM_SELECTION':
      return {
        ...state,
        pendingSelection: null,
        selections: [
          ...state.selections,
          state.pendingSelection,
        ]
      }

    case 'SET_WAVEFORM_PENDING_SELECTION':
      return {
        ...state,
        pendingSelection: action.selection,
      }

    default:
      return state
  }
}
