import { createSelector } from 'reselect'
import {
  getSubtitlesFlashcardFieldLinks,
  overlapsSignificantly,
} from './subtitles'
import { getCurrentMediaFile } from './currentMedia'

type SubtitlesCardBaseId = string

export type SubtitlesCardBase = {
  fields: Dict<SubtitlesTrackId, SubtitlesChunkIndex[]>
  clipwaveType: 'Secondary'
  id: SubtitlesCardBaseId
  index: number
  start: number
  end: number
}
type SubtitlesChunkIndex = number

export const CUES_BASE_PRIORITY: TransliterationFlashcardFieldName[] = [
  'transcription',
  'pronunciation',
  'meaning',
  'notes',
]

export type WaveformSelectionExpanded =
  | { type: 'Clip'; index: number; item: Clip; id: string }
  | {
      type: 'Preview'
      index: number
      item: SubtitlesCardBase
      cardBaseIndex: number
    }

const getSubtitlesCardBaseFieldPriority = createSelector(
  getSubtitlesFlashcardFieldLinks,
  (state: AppState) => state.subtitles,
  (links, subtitles) => {
    return CUES_BASE_PRIORITY.filter((fieldName) => {
      const trackId = links[fieldName]
      return Boolean(trackId && subtitles[trackId])
    })
  }
)

export type SubtitlesCardBases = {
  totalTracksCount: number
  cards: SubtitlesCardBase[]
  cardsMap: Record<string, SubtitlesCardBase>
  fieldNames: TransliterationFlashcardFieldName[]
  linkedTrackIds: SubtitlesTrackId[]
  excludedTracks: SubtitlesTrack[]
  getFieldsPreviewFromCardsBase: (
    cardBase: SubtitlesCardBase
  ) => Dict<SubtitlesTrackId, string>
}

export const getSubtitlesCardBases = createSelector(
  (state: AppState) => state.subtitles,
  getCurrentMediaFile,
  getSubtitlesFlashcardFieldLinks,
  getSubtitlesCardBaseFieldPriority,
  (
    subtitles,
    currentFile,
    fieldsToTracks,
    fieldsCuePriority
  ): SubtitlesCardBases => {
    const [cueField] = fieldsCuePriority
    const cueTrackId = cueField && fieldsToTracks[cueField]
    const cueTrack = cueTrackId && subtitles[cueTrackId]
    const totalTracksCount = currentFile ? currentFile.subtitles.length : 0
    if (!cueTrack)
      return {
        totalTracksCount,
        cards: [],
        cardsMap: {},
        fieldNames: fieldsCuePriority,
        linkedTrackIds: [],
        excludedTracks: Object.values(subtitles),
        getFieldsPreviewFromCardsBase: () => ({}),
      }

    const includedTracks = fieldsCuePriority.map(
      (fieldName) => fieldsToTracks[fieldName]
    )

    const lastIndexes = fieldsCuePriority.map(() => 0)
    const cardsMap: Record<string, SubtitlesCardBase> = {}
    const cards: SubtitlesCardBase[] = cueTrack.chunks.map(
      (cueChunk, index) => {
        const id = `${index}-----${Object.keys(fieldsCuePriority).join('___')}`
        const cardBase: SubtitlesCardBase = {
          index,
          id,
          clipwaveType: 'Secondary',
          start: cueChunk.start,
          end: cueChunk.end,
          fields: fieldsCuePriority.reduce((dict, fn, fieldPriority) => {
            const overlappedIndexes: number[] = []

            const trackId = fieldsToTracks[fn]
            const track = trackId && subtitles[trackId]
            const chunks = track ? track.chunks : []

            for (let i = lastIndexes[fieldPriority]; i < chunks.length; i++) {
              const chunk = chunks[i]
              lastIndexes[fieldPriority] = i

              if (!chunk) {
                console.log({ track, i })
                console.error(track)
                throw new Error('invalid chunk index')
              }

              if (chunk.start >= cueChunk.end) {
                break
              }
              if (overlapsSignificantly(cueChunk, chunk.start, chunk.end)) {
                overlappedIndexes.push(i)
              }
            }

            if (trackId) dict[trackId] = overlappedIndexes
            return dict
          }, {} as Dict<SubtitlesTrackId, SubtitlesChunkIndex[]>),
        }
        cardsMap[id] = cardBase
        return cardBase
      }
    )

    return {
      totalTracksCount,
      cards,
      cardsMap,
      fieldNames: fieldsCuePriority,
      linkedTrackIds: fieldsCuePriority
        .map((f) => fieldsToTracks[f])
        .filter((id): id is string => Boolean(id)),
      excludedTracks: Object.values(subtitles).filter(
        (track) => !includedTracks.includes(track.id)
      ),
      getFieldsPreviewFromCardsBase: (cardsBase: SubtitlesCardBase) => {
        const preview: Dict<string, string> = {}
        for (const trackId in cardsBase.fields) {
          preview[trackId] = (cardsBase.fields[trackId] || [])
            .map((index) => subtitles[trackId].chunks[index].text)
            .join('\n')
        }
        return preview
      },
    }
  }
)
