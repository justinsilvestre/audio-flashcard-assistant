import moment from 'moment'
import { createSelector } from 'reselect'
import { getProjectMediaFiles } from './currentMedia'
import { getSubtitlesSourceFile } from './subtitles'
import { getClipIdsByMediaFileId, getClip, getFlashcard } from './clips'
import { nowUtcTimestamp } from '../utils/sideEffects'
import { formatDurationWithMilliseconds } from '../utils/formatTime'
import {
  blankSimpleFields,
  blankTransliterationFields,
} from '../utils/newFlashcard'
import YAML from 'yaml'
import {
  MediaJson,
  SubtitlesJson,
  ExternalSubtitlesJson,
  EmbeddedSubtitlesJson,
  ClipJson,
  ProjectJson,
} from '../types/Project'
import { msToSeconds } from 'clipwave'

const newestToOldest = (
  { lastOpened: a }: FileAvailability,
  { lastOpened: b }: FileAvailability
): number => {
  if (!a) return 1
  if (!b) return -1
  return moment(b).valueOf() - moment(a).valueOf()
}
/** starts from availabilities
 * because files were not originally persisted
 */
export const getProjects = createSelector(
  (state: AppState) => state.fileAvailabilities.ProjectFile,
  (state: AppState) => state.files.ProjectFile,
  (availabilities, files) =>
    Object.entries(availabilities)
      .map(([id, presentAvailability]) => {
        const file = files[id]
        const availability = presentAvailability || {
          id,
          name: 'Unknown project file',
          parentId: null,
          type: 'ProjectFile',
          filePath: null,
          status: 'NOT_FOUND',
          isLoading: false,
          lastOpened: null,
        }
        return {
          file,
          availability,
        }
      })
      .sort((a, b) => newestToOldest(a.availability, b.availability))
)

export const getProjectIdByFilePath = (
  state: AppState,
  filePath: string
): ProjectId | null =>
  Object.keys(state.fileAvailabilities.ProjectFile).find(
    (id) =>
      (state.fileAvailabilities.ProjectFile[id] as KnownFile).filePath ===
      filePath
  ) || null

export const getProjectJson = <F extends FlashcardFields>(
  state: AppState,
  file: ProjectFile,
  fieldsTemplate: F
): ProjectJson<F> => {
  const mediaFiles = getProjectMediaFiles(state, file.id)

  return {
    project: {
      name: file.name,
      noteType: file.noteType,
      createdAt: file.createdAt,
      timestamp: nowUtcTimestamp(),
      id: file.id,
    },

    media: mediaFiles.map(
      (mediaFile): MediaJson<F> => {
        const { name, format, durationSeconds, id } = mediaFile

        const externalSubtitles = mediaFile.subtitles
          .filter(
            (s): s is ExternalSubtitlesTrack =>
              s.type === 'ExternalSubtitlesTrack'
          )
          .map(
            (s): ExternalSubtitlesJson => {
              const sourceFile = getSubtitlesSourceFile(
                state,
                s.id
              ) as ExternalSubtitlesFile | null

              return {
                id: s.id,
                type: 'External',
                chunksMetadata: sourceFile ? sourceFile.chunksMetadata : null,
                name: sourceFile ? sourceFile.name : 'External subtitles file',
              }
            }
          )
        const embeddedSubtitles = mediaFile.subtitlesTracksStreamIndexes
          .map((streamIndex) => {
            for (const s of mediaFile.subtitles) {
              if (s.type !== 'EmbeddedSubtitlesTrack') continue

              const file = getSubtitlesSourceFile(state, s.id)
              if (
                file &&
                file.type === 'VttConvertedSubtitlesFile' &&
                file.parentType === 'MediaFile' &&
                file.streamIndex === streamIndex
              ) {
                const sourceFile = getSubtitlesSourceFile(
                  state,
                  s.id
                ) as VttFromEmbeddedSubtitles | null

                const subtitles: EmbeddedSubtitlesJson = {
                  id: file.id,
                  streamIndex: streamIndex,
                  type: 'Embedded',
                  chunksMetadata: sourceFile ? sourceFile.chunksMetadata : null,
                }
                return subtitles
              }
            }

            return undefined
          })
          .filter((s): s is EmbeddedSubtitlesJson => Boolean(s))
        const subtitles: SubtitlesJson[] = [
          ...embeddedSubtitles,
          ...externalSubtitles,
        ]

        const clips = getProjectClips(state, mediaFile, fieldsTemplate)

        const newMediaFile: MediaJson<F> = {
          name,
          format,
          duration: formatDurationWithMilliseconds(
            moment.duration({
              seconds: durationSeconds,
            })
          ),
          id,
        }

        if (subtitles.length) newMediaFile.subtitles = subtitles
        if (clips.length) newMediaFile.clips = clips
        if (Object.keys(mediaFile.flashcardFieldsToSubtitlesTracks).length)
          newMediaFile.flashcardFieldsToSubtitlesTracks =
            mediaFile.flashcardFieldsToSubtitlesTracks

        return newMediaFile
      }
    ),
  }
}
function getProjectClips<F extends FlashcardFields>(
  state: AppState,
  mediaFile: MediaFile,
  fieldsTemplate: F
) {
  const clips = [] as ClipJson<F>[]
  for (const id of getClipIdsByMediaFileId(state, mediaFile.id)) {
    const clip = getClip(state, id)
    const card = getFlashcard(state, id)
    if (clip && card) {
      const { start, end } = clip
      const { fields, tags, image, cloze } = card

      const newClip: ClipJson<F> = {
        id,
        start: formatDurationWithMilliseconds(
          moment.duration({
            seconds: msToSeconds(start),
          })
        ),
        end: formatDurationWithMilliseconds(
          moment.duration({
            seconds: msToSeconds(end),
          })
        ),
      }

      const newFields = {}
      Object.keys(fieldsTemplate).reduce((all, fn) => {
        const fieldName: keyof typeof fields = fn as any
        if (fields[fieldName].trim()) {
          all[fieldName] =
            fieldName === 'transcription' && cloze.length
              ? encodeClozeDeletions(fields[fieldName], cloze)
              : fields[fieldName]
        }

        return all
      }, newFields as F)
      if (Object.keys(newFields).length) newClip.fields = newFields

      if (tags.length) newClip.tags = tags

      if (image)
        newClip.image = {
          type: 'VideoStill',
          ...(typeof image.seconds === 'number'
            ? { seconds: image.seconds }
            : null),
        }

      clips.push(newClip)
    }
  }

  return clips
}

const escapeClozeChars = (text: string) =>
  text.replace(/(<\/?c(10|[1-9])>)/g, `\\$1`)
export const encodeClozeDeletions = (text: string, cloze: ClozeDeletion[]) => {
  const ranges = cloze
    .flatMap((c, clozeIndex) =>
      c.ranges.map((range) => ({ range, clozeIndex }))
    )
    .sort((a, b) => a.range.start - b.range.start)
  if (!ranges.length) return escapeClozeChars(text)
  const firstRange = ranges[0].range
  let result = firstRange.start > 0 ? text.slice(0, firstRange.start) : ''
  let i = 0
  for (const { range, clozeIndex } of ranges) {
    const nextRange = ranges[i + 1]
    const subsequentGapEnd = nextRange ? nextRange.range.start : text.length

    result +=
      `{{c${clozeIndex + 1}::${escapeClozeChars(
        text.slice(range.start, range.end)
      )}}}` + escapeClozeChars(text.slice(range.end, subsequentGapEnd))

    i++
  }
  return result
}

const getFieldsTemplate = (file: ProjectFile) =>
  file.noteType === 'Simple' ? blankSimpleFields : blankTransliterationFields

export const getProjectFileContents = (
  state: AppState,
  projectFile: ProjectFile
): string => {
  const { project, media } = getProjectJson(
    state,
    projectFile,
    getFieldsTemplate(projectFile)
  )
  return (
    `# This file was created by Knowclip!\n# Edit it manually at your own risk.\n` +
    [project, ...media].map((o) => YAML.stringify(o)).join('---\n')
  )
}
