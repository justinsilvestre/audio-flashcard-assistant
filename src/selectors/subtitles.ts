import stripHtml from '../utils/stripHtml'
import { getFileAvailability } from './files'
import { createSelector } from 'reselect'
import { getCurrentMediaFile } from './currentMedia'
import {
  TransliterationFlashcardFields,
  SubtitlesFlashcardFieldsLinks,
} from '../types/Project'

export const getSubtitlesDisplayFile = (
  state: AppState,
  id: string
): VttConvertedSubtitlesFile | ExternalSubtitlesFile | null =>
  getSubtitlesDisplayFileFromFilesSubset(
    state.files.ExternalSubtitlesFile,
    state.files.VttConvertedSubtitlesFile,
    id
  )

const getSubtitlesDisplayFileFromFilesSubset = (
  external: FilesState['ExternalSubtitlesFile'],
  generated: FilesState['VttConvertedSubtitlesFile'],
  id: string
): ExternalSubtitlesFile | VttConvertedSubtitlesFile | null =>
  generated[id] || external[id] || null

export const getSubtitlesSourceFile = (
  state: AppState,
  id: string
): ExternalSubtitlesFile | VttConvertedSubtitlesFile | null =>
  getSubtitlesSourceFileFromFilesSubset(
    state.files.ExternalSubtitlesFile,
    state.files.VttConvertedSubtitlesFile,
    id
  )
const getSubtitlesSourceFileFromFilesSubset = (
  external: FilesState['ExternalSubtitlesFile'],
  generated: FilesState['VttConvertedSubtitlesFile'],
  id: string
): ExternalSubtitlesFile | VttConvertedSubtitlesFile | null =>
  external[id] || generated[id] || null

export const getSubtitlesFileAvailability = (state: AppState, id: string) => {
  const record = getSubtitlesDisplayFile(state, id)

  return record ? getFileAvailability(state, record) : null
}

const getSubtitles = (state: AppState) => state.subtitles

const getCurrentMediaFileSubtitles = (state: AppState) => {
  const currentMediaFile = getCurrentMediaFile(state)
  return currentMediaFile ? currentMediaFile.subtitles : []
}
export const getSubtitlesTracks = createSelector(
  getCurrentMediaFileSubtitles,
  getSubtitles,
  (currentFileSubtitles, subtitles): Array<SubtitlesTrack> => {
    if (!currentFileSubtitles.length) return []
    return currentFileSubtitles
      .map(({ id }) => subtitles[id])
      .filter((track): track is SubtitlesTrack => Boolean(track))
  }
)

export type SubtitlesFileWithTrack =
  | EmbeddedSubtitlesFileWithTrack
  | ExternalSubtitlesFileWithTrack
export type EmbeddedSubtitlesFileWithTrack = {
  id: SubtitlesTrackId
  relation: EmbeddedSubtitlesTrackRelation
  label: string
  embeddedIndex: number
  sourceFile: VttConvertedSubtitlesFile | null // can be null while loading?
  displayFile: VttConvertedSubtitlesFile | null
  track: EmbeddedSubtitlesTrack | null
}
export type ExternalSubtitlesFileWithTrack = {
  id: SubtitlesTrackId
  relation: ExternalSubtitlesTrackRelation
  label: string
  externalIndex: number
  sourceFile: ExternalSubtitlesFile | null // should never really be null
  displayFile: ExternalSubtitlesFile | null
  track: ExternalSubtitlesTrack | null
}

export type MediaSubtitles = {
  total: number
  embedded: EmbeddedSubtitlesFileWithTrack[]
  external: ExternalSubtitlesFileWithTrack[]
  all: SubtitlesFileWithTrack[]
}

export const getSubtitlesFilesWithTracks = createSelector(
  getCurrentMediaFile,
  getSubtitles,
  (state: AppState) => state.files.ExternalSubtitlesFile,
  (state: AppState) => state.files.VttConvertedSubtitlesFile,
  (
    currentFile,
    subtitlesTracks,
    externalFiles,
    convertedFiles
  ): MediaSubtitles => {
    let embeddedCount = 0
    let externalCount = 0
    const subtitles = currentFile
      ? /* eslint-disable array-callback-return */
        currentFile.subtitles.map((t) => {
          switch (t.type) {
            case 'EmbeddedSubtitlesTrack': {
              const embeddedIndex = ++embeddedCount
              return {
                id: t.id,
                relation: t,
                embeddedIndex,
                label: `Embedded subtitles track ${embeddedIndex}`,
                sourceFile: getSubtitlesSourceFileFromFilesSubset(
                  externalFiles,
                  convertedFiles,
                  t.id
                ),
                displayFile: getSubtitlesDisplayFileFromFilesSubset(
                  externalFiles,
                  convertedFiles,
                  t.id
                ),
                track: subtitlesTracks[t.id] || null,
              } as EmbeddedSubtitlesFileWithTrack
            }
            case 'ExternalSubtitlesTrack':
              const externalIndex = ++externalCount
              const sourceFile = getSubtitlesSourceFileFromFilesSubset(
                externalFiles,
                convertedFiles,
                t.id
              )
              return {
                id: t.id,
                relation: t,
                externalIndex,
                label:
                  sourceFile && 'name' in sourceFile
                    ? sourceFile.name
                    : `External subtitles track ${externalIndex}`,
                sourceFile,
                displayFile: getSubtitlesDisplayFileFromFilesSubset(
                  externalFiles,
                  convertedFiles,
                  t.id
                ),
                track: subtitlesTracks[t.id] || null,
              } as ExternalSubtitlesFileWithTrack
          }
          /* eslint-enable array-callback-return */
        })
      : []

    return {
      total: subtitles.length,
      all: subtitles,
      embedded: subtitles.filter(
        (s): s is EmbeddedSubtitlesFileWithTrack =>
          s.relation.type === 'EmbeddedSubtitlesTrack'
      ),
      external: subtitles.filter(
        (s): s is ExternalSubtitlesFileWithTrack =>
          s.relation.type === 'ExternalSubtitlesTrack'
      ),
    }
  }
)

export const getSubtitlesTrack = (
  state: AppState,
  id: SubtitlesTrackId
): SubtitlesTrack | null => state.subtitles[id] || null

export const readVttChunk = (
  state: AppState,
  {
    start,
    end,
    text,
    index,
  }: {
    start: number
    end: number
    text: string
    index: number
  }
): SubtitlesChunk => ({
  start: start,
  end: end,
  text: (stripHtml(text) || '').trim(),
  index,
})

export const readSubsrtChunk = readVttChunk

const HALF_SECOND = 500

export const overlapsSignificantly = (
  chunk: { start: number; end: number },
  start: number,
  end: number
): boolean =>
  start <= chunk.end - HALF_SECOND && end >= chunk.start + HALF_SECOND

export const getSubtitlesChunksWithinRange = (
  state: AppState,
  subtitlesTrackId: SubtitlesTrackId,
  start: WaveformX,
  end: WaveformX
): Array<SubtitlesChunk> =>
  getSubtitlesChunksWithinRangeFromTracksState(
    state.subtitles,
    subtitlesTrackId,
    start,
    end
  )

export const getSubtitlesChunksWithinRangeFromTracksState = (
  state: AppState['subtitles'],
  subtitlesTrackId: SubtitlesTrackId,
  start: WaveformX,
  end: WaveformX
): Array<SubtitlesChunk> => {
  const track = state[subtitlesTrackId]
  const chunks: SubtitlesChunk[] = []

  if (!track) return chunks

  for (let i = 0; i < track.chunks.length; i++) {
    const chunk = track.chunks[i]
    if (chunk.end < start) continue
    if (chunk.start > end) break

    if (overlapsSignificantly(chunk, start, end)) chunks.push(chunk)
  }
  return chunks
}

export const getSubtitlesFlashcardFieldLinks = (
  state: AppState // should probably be ?id
): SubtitlesFlashcardFieldsLinks => {
  const media = getCurrentMediaFile(state)
  return media ? media.flashcardFieldsToSubtitlesTracks : {}
}

export const getNewFlashcardForStretchedClip = (
  state: AppState,
  waveformState: WaveformState,
  noteType: NoteType,
  { start, end }: Clip,
  flashcard: Flashcard,
  { start: stretchStart, end: stretchEnd }: { start: number; end: number },
  direction: 'PREPEND' | 'APPEND'
): Flashcard => {
  const links = getSubtitlesFlashcardFieldLinks(state)
  if (!Object.keys(links).length) return flashcard

  const originalFields: TransliterationFlashcardFields = flashcard.fields as any
  const newFields: TransliterationFlashcardFields = { ...originalFields }

  for (const fn in links) {
    const fieldName = fn as TransliterationFlashcardFieldName
    const trackId = links[fieldName]
    const originalText = originalFields[fieldName]
    const newlyOverlapped = (chunk: SubtitlesChunk) =>
      !originalText.trim() || !overlapsSignificantly(chunk, start, end)
    const chunks = trackId
      ? getSubtitlesChunksWithinRange(
          state,
          trackId,
          stretchStart,
          stretchEnd
        ).filter(newlyOverlapped)
      : []

    const newText = chunks.map((chunk) => chunk.text).join('\n')

    newFields[fieldName] = (direction === 'PREPEND'
      ? [newText, originalText]
      : [originalText, newText]
    )
      .filter((t) => t.trim())
      .join('\n')

    if (fieldName === 'transcription' && direction === 'PREPEND') {
      const difference = newFields[fieldName].length - originalText.length
      flashcard.cloze = flashcard.cloze.map((c) => ({
        ...c,
        ranges: c.ranges.map(({ start, end }) => ({
          start: start + difference,
          end: end + difference,
        })),
      }))
    }
  }

  if (
    Object.keys(newFields).every(
      (k) =>
        originalFields[k as TransliterationFlashcardFieldName] ===
        newFields[k as TransliterationFlashcardFieldName]
    )
  )
    return flashcard

  return { ...flashcard, fields: newFields }
}
