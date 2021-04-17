import { combineReducers } from 'redux'

import clips from '../reducers/clips'
import session from '../reducers/session'
import snackbar from '../reducers/snackbar'
import dialog from '../reducers/dialog'
import subtitles from '../reducers/subtitles'
import settings from '../reducers/settings'
import fileAvailabilities from '../reducers/fileAvailabilities'
import files from '../reducers/files'

import projectToMarkdown from './projectToMarkdown'

import { initialState } from '../reducers/files'
import { pixelsToMs } from 'clipwave'

export const reducer = combineReducers<AppState>({
  clips,
  session,
  snackbar,
  dialog,
  subtitles,
  settings,
  fileAvailabilities,
  files,
})

describe('projectToMarkdown', () => {
  const baseState = reducer(undefined, { type: '@@INIT' })
  const mediaFileId = 'mediaFileId'

  const noteType = 'Transliteration'
  const newClipWithCard = (
    id: string,
    start: number,
    end: number,
    [transcription, pronunciation, meaning, notes]: [
      string,
      string,
      string,
      string
    ],
    tags: string[]
  ): { clip: Clip; flashcard: Flashcard } => ({
    clip: {
      clipwaveType: 'Primary',
      start: pixelsToMs(start, 50),
      end: pixelsToMs(end, 50),
      fileId: mediaFileId,
      id,
    },
    flashcard: {
      id,
      type: 'Transliteration',
      fields: {
        transcription,
        pronunciation,
        meaning,
        notes,
      },
      tags,
      cloze: [],
    },
  })

  const projectMetadata: ProjectFile = {
    error: null,
    type: 'ProjectFile',
    id: 'xxx',
    name: 'Basic Japanese',
    createdAt: '2015-11-15T09:44:45Z',
    lastSaved: '2015-11-16T09:44:45Z',

    noteType: 'Transliteration',
    mediaFileIds: [mediaFileId],
  }

  const clip1 = newClipWithCard(
    'clip1',
    10,
    160,
    [
      '女の子は言葉を言いません。',
      'Onnanóko-wa kotobá-o iimasén.',
      "[The] girl doesn't say [a] word. (polite)",
      `"iimasén" in plain form = "iwanai"

"iimásu" in plain form = "iu".`,
    ],
    ['jgr1-1-1']
  )
  const clip2 = newClipWithCard(
    'clip2',
    200,
    350,
    [
      '女の子は言葉を言いません。',
      'Onnanóko-wa kotobá-o iimasén.',
      "[The] girl doesn't say [a] word. (polite)",
      '"iimasén" in plain form = "iwanai"\n"iimásu" in plain form = "iu".',
    ],
    ['jgr1-1-1']
  )
  const clip3 = newClipWithCard(
    'clip3',
    400,
    550,
    [
      '女の子は言葉を言いません。',
      'Onnanóko-wa kotobá-o iimasén.',
      "[The] girl doesn't say [a] word. (polite)",
      '"iimasén" in plain form = "iwanai"\n"iimásu" in plain form = "iu".',
    ],
    ['jgr1-1-1', 'taggytag']
  )

  const state: AppState = {
    ...baseState,
    files: {
      ...initialState,
      ProjectFile: { [projectMetadata.id]: projectMetadata },
      MediaFile: {
        [mediaFileId]: {
          durationSeconds: 60,
          format: 'mp4 xxx xxx',
          isVideo: true,
          width: 640,
          height: 480,
          id: mediaFileId,
          name: 'Eetto',
          type: 'MediaFile',
          parentId: projectMetadata.id,
          subtitles: [],
          flashcardFieldsToSubtitlesTracks: {},
          subtitlesTracksStreamIndexes: [],
        },
      },
    },
    clips: {
      ...baseState.clips,
      byId: {
        [clip1.clip.id]: clip1.clip,
        [clip2.clip.id]: clip2.clip,
        [clip3.clip.id]: clip3.clip,
      },
      flashcards: {
        [clip1.flashcard.id]: clip1.flashcard,
        [clip2.flashcard.id]: clip2.flashcard,
        [clip3.flashcard.id]: clip3.flashcard,
      },
      idsByMediaFileId: { [mediaFileId]: ['clip1', 'clip2', 'clip3'] },
    },
  }

  it('makes markdown file', () => {
    const result = projectToMarkdown(state, projectMetadata.id, noteType, {
      [mediaFileId]: ['clip1', 'clip2', 'clip3'],
    })

    expect(result).toEqual(
      [
        `# Basic Japanese`,
        '',
        `## Eetto`,
        '',
        `**0:00 - 0:03** _#jgr1-1-1_`,
        `* 女の子は言葉を言いません。`,
        `* Onnanóko-wa kotobá-o iimasén.`,
        `* [The] girl doesn't say [a] word. (polite)`,
        `* "iimasén" in plain form = "iwanai"<br><br>"iimásu" in plain form = "iu".`, // double line break
        '',
        `**0:04 - 0:07** _#jgr1-1-1_`,
        `* 女の子は言葉を言いません。`,
        `* Onnanóko-wa kotobá-o iimasén.`,
        `* [The] girl doesn't say [a] word. (polite)`,
        `* "iimasén" in plain form = "iwanai"<br>"iimásu" in plain form = "iu".`,
        '',
        `**0:08 - 0:11** _#jgr1-1-1_ _#taggytag_`,
        `* 女の子は言葉を言いません。`,
        `* Onnanóko-wa kotobá-o iimasén.`,
        `* [The] girl doesn't say [a] word. (polite)`,
        `* "iimasén" in plain form = "iwanai"<br>"iimásu" in plain form = "iu".`,
      ].join('\n')
    )
  })
})
