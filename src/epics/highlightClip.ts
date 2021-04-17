import { map, filter, switchMap } from 'rxjs/operators'
import { ofType, combineEpics } from 'redux-observable'
import { EMPTY, of } from 'rxjs'
import A from '../types/ActionType'
import r from '../redux'
import { msToSeconds, secondsToMs } from 'clipwave'

const deselectOnOpenMediaFile: AppEpic = (action$) =>
  action$.pipe(
    ofType<Action, OpenFileRequest>(A.openFileRequest),
    filter(({ file }) => file.type === 'MediaFile'),
    map(() => r.selectWaveformItem(null))
  )

const highlightRightEpic: AppEpic = (
  action$,
  state$,
  { getCurrentTime, setCurrentTime }
) =>
  action$.pipe(
    ofType<Action, HighlightRightClipRequest>(A.highlightRightClipRequest),
    switchMap(() => {
      const state = state$.value
      const currentFileId = r.getCurrentFileId(state)
      if (!currentFileId) return EMPTY
      const waveformItems = r.getWaveformItems(state)
      const selection = r.getWaveformSelection(state)
      const currentIndex = selection ? selection.index : -1
      const nextIndex = currentIndex !== -1 ? currentIndex + 1 : -1
      if (selection && nextIndex !== -1) {
        const lastIndex = waveformItems.length - 1
        const next = waveformItems[nextIndex > lastIndex ? 0 : nextIndex]

        if (next) {
          setCurrentTime(
            msToSeconds(Math.max(next.item.start, selection.item.end + 1))
          )
          return r.isMediaFileLoaded(state)
            ? EMPTY
            : of(r.selectWaveformItem(next))
        }
      }

      const currentMs = secondsToMs(getCurrentTime())

      const next =
        waveformItems.find(({ item }) => item.start >= currentMs) ||
        waveformItems[0]
      if (next) {
        setCurrentTime(msToSeconds(next.item.start))
        return r.isMediaFileLoaded(state)
          ? EMPTY
          : of(r.selectWaveformItem(next))
      }

      return EMPTY
    })
  )

const findLast = <T>(array: Array<T>, predicate: (item: T) => boolean) => {
  if (!array.length) return null
  for (let i = array.length - 1; i >= 0; i -= 1) {
    const item = array[i]
    if (predicate(item)) return item
  }
}

const highlightLeftEpic: AppEpic = (
  action$,
  state$,
  { getCurrentTime, setCurrentTime }
) =>
  action$.pipe(
    ofType<Action, HighlightLeftClipRequest>(A.highlightLeftClipRequest),
    switchMap(() => {
      const state = state$.value
      const currentFileId = r.getCurrentFileId(state)
      if (!currentFileId) return EMPTY

      const waveformItems = r.getWaveformItems(state)
      const selection = r.getWaveformSelection(state)

      if (selection) {
        const highlightedIndex = selection.index
        const prev =
          waveformItems[
            highlightedIndex === 0
              ? waveformItems.length - 1
              : highlightedIndex - 1
          ]

        if (prev) {
          setCurrentTime(msToSeconds(prev.item.start))
          return r.isMediaFileLoaded(state)
            ? EMPTY
            : of(r.selectWaveformItem(prev))
        }
      }
      const ms = msToSeconds(getCurrentTime())

      const prev =
        findLast(waveformItems, ({ item }) => item.end <= ms) ||
        waveformItems[waveformItems.length - 1]

      if (prev) {
        setCurrentTime(msToSeconds(prev.item.start))
        return r.isMediaFileLoaded(state)
          ? EMPTY
          : of(r.selectWaveformItem(prev))
      }

      return EMPTY
    })
  )

export default combineEpics(
  deselectOnOpenMediaFile,
  highlightRightEpic,
  highlightLeftEpic
)
