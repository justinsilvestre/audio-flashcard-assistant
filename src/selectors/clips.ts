import { createSelector } from 'reselect'
import formatTime from '../utils/formatTime'
import { msToSeconds } from 'clipwave'

export const getClip = (state: AppState, id: ClipId): Clip | null =>
  state.clips.byId[id]

export const getClipsObject = (state: AppState): Record<ClipId, Clip> =>
  state.clips.byId

export const getClipsByIds = (
  clipsOrder: Array<ClipId>,
  clips: Record<ClipId, Clip>
): Array<Clip> =>
  clipsOrder.map((id) => {
    const clip = clips[id]
    if (!clip) throw new Error('Could not find clip')
    return clip
  })

export const getClips = (
  state: AppState,
  mediaFileId: MediaFileId
): Array<Clip> => {
  const clipsOrder = state.clips.idsByMediaFileId[mediaFileId]
  return clipsOrder ? getClipsByIds(clipsOrder, getClipsObject(state)) : []
}

export const getFlashcard = (state: AppState, id: ClipId): Flashcard | null =>
  state.clips.flashcards[id] || null

export const getFlashcards = (
  state: AppState,
  mediaFileId: MediaFileId
): Array<Flashcard> => {
  const clipsOrder = state.clips.idsByMediaFileId[mediaFileId]
  return clipsOrder ? clipsOrder.map((id) => state.clips.flashcards[id]) : []
}

export const getAllProjectClipsIds: (
  state: AppState
) => Array<ClipId> = createSelector(getClipsObject, (clipsObject) =>
  Object.keys(clipsObject)
)

export const getClipTimeInSeconds = (
  state: AppState,
  id: ClipId
): TimeSpan | null => {
  const clip = getClip(state, id)
  if (!clip) return null

  return {
    start: msToSeconds(clip.start),
    end: msToSeconds(clip.end),
  }
}

export const getFormattedClipTime = (
  state: AppState,
  id: ClipId
): string | null => {
  const clipTime = getClipTimeInSeconds(state, id)
  if (!clipTime) return null

  return `${formatTime(clipTime.start)} - ${formatTime(clipTime.end)}`
}

export const getClipMilliseconds = (
  state: AppState,
  id: ClipId
): {
  start: number
  end: number
} => {
  const clip = state.clips.byId[id]
  if (!clip) throw new Error('Maybe impossible')
  return {
    start: clip.start,
    end: clip.end,
  }
}

export const getClipIdsByMediaFileId = (
  state: AppState,
  mediaFileId: string
): Array<ClipId> => state.clips.idsByMediaFileId[mediaFileId]
