import YAML from 'yaml'
import { readFile } from 'fs-extra'
import { blankSimpleFields, blankTransliterationFields } from './newFlashcard'
import { parseFormattedDuration } from './formatTime'
import {
  ProjectJson,
  MediaJson,
  SubtitlesJson,
  EmbeddedSubtitlesJson,
} from '../types/Project'
import validateProject from './validateProject'
import { unescapeClozeFields } from './clozeField'

type NormalizedProjectFileData = {
  project: ProjectFile
  media: MediaFile[]
  clips: Clip[]
  cards: Flashcard[]
  subtitles: SubtitlesFile[]
}

export const parseProjectJson = async <F extends FlashcardFields>(
  filePath: string
): AsyncResult<ProjectJson<F>> => {
  try {
    const docs = YAML.parseAllDocuments(await readFile(filePath, 'utf8'), {
      // default of 100 is easily reached
      // when i.e. detecting silences in file > ~2 hours long.
      // TODO: investigate setting this to smarter default
      //       and then retrying after confirmation without limit
      //       after user confirmation.
      maxAliasCount: -1,
    } as YAML.Options)
    const errors = docs.flatMap((v) => v.errors)
    if (errors.length) return { errors: errors.map((e) => e.message) }

    const [project, ...media] = docs.map((d) => d.toJSON())

    const validation = validateProject(project, media)

    if (validation.errors)
      return {
        errors: Object.entries(validation.errors).map(
          ([sectionName, bigErrorMessage]) => {
            return `Invalid data for ${sectionName}:\n\n${bigErrorMessage}`
          }
        ),
      }

    return {
      value: {
        project,
        media,
      },
    }
  } catch (err) {
    return { errors: [err.message] }
  }
}

export const normalizeProjectJson = <F extends FlashcardFields>(
  state: AppState,
  { project: projectJson, media: mediaJson }: ProjectJson<F>
): NormalizedProjectFileData => {
  const project: ProjectFile = {
    id: projectJson.id,
    createdAt: projectJson.createdAt,
    lastSaved: projectJson.timestamp,
    noteType: projectJson.noteType,
    name: projectJson.name,
    mediaFileIds: mediaJson.map((m) => m.id),
    type: 'ProjectFile',
    error: null,
  }
  const media: [
    MediaFile,
    () => Clip[],
    () => Flashcard[],
    SubtitlesFile[]
  ][] = mediaJson.map((m) => {
    const subtitles = m.subtitles
      ? m.subtitles.map((s) => toMediaSubtitlesRelation(s))
      : []
    const subtitlesFiles: SubtitlesFile[] = (m.subtitles || []).map(
      (s): SubtitlesFile =>
        s.type === 'Embedded'
          ? {
              type: 'VttConvertedSubtitlesFile',
              id: s.id,
              streamIndex: s.streamIndex,
              parentId: m.id,
              parentType: 'MediaFile',
              chunksMetadata: s.chunksMetadata,
            }
          : {
              type: 'ExternalSubtitlesFile',
              id: s.id,
              name: s.name,
              parentId: m.id,
              parentType: 'MediaFile',
              chunksMetadata: s.chunksMetadata,
            }
    )
    const base: AudioFile = {
      name: m.name,
      type: 'MediaFile',
      id: m.id,
      parentId: projectJson.id,
      durationSeconds: parseFormattedDuration(m.duration).asSeconds(),
      format: m.format,
      subtitles,
      flashcardFieldsToSubtitlesTracks:
        m.flashcardFieldsToSubtitlesTracks || {},
      subtitlesTracksStreamIndexes: (m.subtitles || [])
        .filter((s): s is EmbeddedSubtitlesJson => s.type === 'Embedded')
        .map((s) => s.streamIndex),

      isVideo: false,
    }

    if ('width' in m) {
      return [
        {
          ...base,
          isVideo: true,
          width: m.width,
          height: m.height,
        },
        getMediaClipsGetter<F>(state, project, m),
        getMediaCardsGetter<F>(state, project, m),
        subtitlesFiles,
      ]
    }

    return [
      base,
      getMediaClipsGetter<F>(state, project, m),
      getMediaCardsGetter<F>(state, project, m),
      subtitlesFiles,
    ]
  })

  let clips: Clip[]
  let cards: Flashcard[]

  return {
    project,
    media: media.flatMap(([m]) => m),
    get clips() {
      clips = clips || media.flatMap(([, c]) => c())
      return clips
    },
    get cards() {
      cards = cards || media.flatMap(([, , c]) => c())
      return cards
    },
    subtitles: media.flatMap(([, , , s]) => s),
  }
}

const getMediaClipsGetter = <F extends FlashcardFields>(
  state: AppState,
  project: ProjectFile,
  media: MediaJson<F>
) => () => getMediaClips(state, project, media)
const getMediaCardsGetter = <F extends FlashcardFields>(
  state: AppState,
  project: ProjectFile,
  media: MediaJson<F>
) => () => getMediaCards(state, project, media)

function getMediaClips<F extends FlashcardFields>(
  state: AppState,
  project: ProjectFile,
  media: MediaJson<F>
): Clip[] {
  return (media.clips || []).map(
    (c): Clip => {
      return {
        id: c.id,
        clipwaveType: 'Primary',
        start: parseFormattedDuration(c.start).asMilliseconds(),
        end: parseFormattedDuration(c.end).asMilliseconds(),
        fileId: media.id,
      }
    }
  )
}
function getMediaCards<F extends FlashcardFields>(
  state: AppState,
  project: ProjectFile,
  media: MediaJson<F>
): Flashcard[] {
  return (media.clips || []).map(
    (c): Flashcard => {
      const flashcardBase = {
        type: project.noteType,
        id: c.id,
        tags: c.tags || [],
        image: c.image && {
          id: c.id,
          type: 'VideoStillImage' as const,
          ...(c.image.time
            ? { seconds: parseFormattedDuration(c.image.time).asSeconds() }
            : null),
        },
      }

      const { fields, cloze } = unescapeClozeFields(c.fields)

      return project.noteType === 'Simple'
        ? {
            ...flashcardBase,
            type: 'Simple',
            fields: { ...blankSimpleFields, ...fields },
            cloze,
          }
        : {
            ...flashcardBase,
            type: 'Transliteration',
            fields: { ...blankTransliterationFields, ...fields },
            cloze,
          }
    }
  )
}

function toMediaSubtitlesRelation(s: SubtitlesJson): MediaSubtitlesRelation {
  switch (s.type) {
    case 'Embedded':
      return {
        type: 'EmbeddedSubtitlesTrack',
        id: s.id,
      }

    case 'External':
      return {
        type: 'ExternalSubtitlesTrack',
        id: s.id,
      }
  }
}
