import * as r from '../redux'
import { toTimestamp } from '../utils/ffmpeg'
import { extname, basename } from 'path'
import { unparse } from 'papaparse'
import { getNoteTypeFields } from '../utils/noteType'
import { getFileAvailability } from '../selectors'
import { existsSync } from 'fs'
import { getVideoStillPngPath, getMidpoint } from './getVideoStill'
const SAFE_SEPARATOR = '-'
const SAFE_MILLISECONDS_SEPARATOR = '_'

const roughEscape = (text: string) => text.replace(/\n/g, '<br />')

const FRONT_SIDE = '{{FrontSide}}'
const HR = '<hr id="answer" />'
const TRANSCRIPTION = '<p class="transcription">{{transcription}}</p>'
const MEANING = '<p class="meaning">{{meaning}}</p>'
const PRONUNCIATION = `{{#pronunciation}}
<p class="pronunciation">{{pronunciation}}
</p>
{{/pronunciation}}`
const NOTES = `{{#notes}}
<p class="notes">{{notes}}
</p>
{{/notes}}`
const IMAGE = `{{#image}}
<div class="image">{{image}}</div>
{{/image}}`

const getCards = (noteType: NoteType) => [
  {
    name: 'Listening',
    questionFormat: [IMAGE, `♫{{sound}}`].join('\n'),
    answerFormat: [
      FRONT_SIDE,
      HR,
      TRANSCRIPTION,
      PRONUNCIATION,
      MEANING,
      NOTES,
    ].join('\n\n'),
  },
  {
    name: 'Reading',
    questionFormat: [IMAGE, TRANSCRIPTION].join('\n'),
    answerFormat: [
      FRONT_SIDE,
      HR,
      '{{sound}}',
      PRONUNCIATION,
      MEANING,
      NOTES,
    ].join('\n\n'),
  },
]

/** Returns either valid export data or a list of missing media files. */
export const getApkgExportData = (
  state: AppState,
  project: ProjectFile,
  clipIds: Array<ClipId>
): ApkgExportData | Set<MediaFile> => {
  const fieldNames = getNoteTypeFields(project.noteType)
  const mediaFiles = r.getProjectMediaFiles(state, project.id)

  const missingMediaFiles: Set<MediaFile> = new Set()

  // sort and validate
  clipIds.sort((id, id2) => {
    const clip = r.getClip(state, id)
    if (!clip) throw new Error('Could not find clip ' + id)

    const clip2 = r.getClip(state, id2)
    if (!clip2) throw new Error('Could not find clip ' + id2)

    const file = mediaFiles.find(media => media.id === clip.fileId)
    if (!file) throw new Error(`Couldn't find media metadata for clip ${id}`)
    const fileLoaded = getFileAvailability(state, file)
    if (!fileLoaded || !fileLoaded.filePath || !existsSync(fileLoaded.filePath))
      missingMediaFiles.add(file)

    const file2 = mediaFiles.find(media => media.id === clip.fileId)
    if (!file2) throw new Error(`Couldn't find media metadata for clip ${id}`)

    const fileIndex1 = mediaFiles.indexOf(file)
    const fileIndex2 = mediaFiles.findIndex(media => media.id === clip2.fileId)

    if (fileIndex1 < fileIndex2) return -1
    if (fileIndex1 > fileIndex2) return 1

    if (clip.start < clip2.start) return -1
    if (clip.start > clip2.start) return 1
    return 0
  })

  if (missingMediaFiles.size > 0) return missingMediaFiles

  const clips = clipIds.map(
    (id, i): ClipSpecs => {
      const clip = r.getClip(state, id)
      if (!clip) throw new Error('Could not find clip ' + id)

      const mediaFile = mediaFiles.find(media => media.id === clip.fileId)
      if (!mediaFile)
        throw new Error(`Couldn't find media metadata for clip ${id}`)
      const file = mediaFiles.find(media => media.id === clip.fileId)
      if (!file) throw new Error(`Couldn't find media metadata for clip ${id}`)
      const fileLoaded = getFileAvailability(state, file)
      if (!fileLoaded.filePath)
        // verified existent via missingMediaFiles above
        throw new Error(`Please open ${file.name} and try again.`)
      const extension = extname(fileLoaded.filePath)
      const filenameWithoutExtension = basename(fileLoaded.filePath, extension)

      const startTime = r.getMillisecondsAtX(state, clip.start)
      const endTime = r.getMillisecondsAtX(state, clip.end)
      const outputFilename = `${filenameWithoutExtension
        .replace(/\[/g, '__br__')
        .replace(/\]/g, '__rb__')}___${toTimestamp(
        startTime,
        SAFE_SEPARATOR
      )}-${toTimestamp(
        endTime,
        SAFE_SEPARATOR,
        SAFE_MILLISECONDS_SEPARATOR
      )}___afcaId${id}${'.mp3'}`

      const fieldValues = Object.values(clip.flashcard.fields).map(roughEscape)

      const image = clip.flashcard.image
        ? `<img src="${basename(
            getVideoStillPngPath(
              clip.flashcard.image.id,
              fileLoaded.filePath,
              typeof clip.flashcard.image.seconds === 'number'
                ? clip.flashcard.image.seconds
                : getMidpoint(startTime * 1000, endTime * 1000)
            )
          )}" />`
        : ''

      return {
        sourceFilePath: fileLoaded.filePath,
        startTime,
        endTime,
        outputFilename,
        flashcardSpecs: {
          sortField: 'transcription',
          fields: [clip.id, ...fieldValues, `[sound:${outputFilename}]`, image],
          tags: clip.flashcard.tags || [],
          image: clip.flashcard.image || null,
          due: i,
        },
      }
    }
  )

  return {
    deckName: `${project.name} (Generated by Knowclip)`,
    template: {
      fields: ['id', ...fieldNames, 'sound', 'image'],
      cards: getCards(project.noteType),
      css: `.card {
  font-family: Helvetica, Arial;
  font-size: 16px;
  text-align: center;
  color: black;
  background-color: white;
  line-height: 1.25
}

.transcription {
  font-size: 2em;
}

.pronunciation {
  font-style: italic;
  font-size: 1.4em;
}

.meaning {
  margin-top: 4em;
  margin-bottom: 4em;
}

.notes {
  background-color: #efefef;
  padding: .8em;
  border-radius: .2em;
  text-align: justify;
  max-width: 40em;
  margin-left: auto;
  margin-right: auto;
}`,
    },
    clips,
  }
}

export const getCsvText = (exportData: ApkgExportData) => {
  const csvData = exportData.clips.map(({ flashcardSpecs }) =>
    [...flashcardSpecs.fields].concat(flashcardSpecs.tags.join(' '))
  )

  return unparse(csvData)
}
