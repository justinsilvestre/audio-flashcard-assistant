import clips from './clips'
import r from '../redux'
import { TransliterationFlashcardFields } from '../types/Project'

const newClip = (
  { start, end }: { start: number; end: number },
  fileId: MediaFileId,
  id: ClipId,
  fields: TransliterationFlashcardFields
): { clip: Clip; card: Flashcard } => ({
  clip: {
    clipwaveType: 'Primary',
    start,
    end,
    fileId,
    id,
  },
  card: {
    id,
    type: 'Transliteration',
    fields: fields,
    tags: [],
    cloze: [],
  },
})

describe('clips reducer', () => {
  const fileId = 'fileId'
  const transliterationFields = {
    pronunciation: 'a',
    meaning: 'aaa',
    transcription: 'asdf',
    notes: 'hey',
  }
  const a = newClip({ start: 1, end: 1.5 }, fileId, 'a', transliterationFields)
  const b = newClip({ start: 2, end: 2.5 }, fileId, 'b', transliterationFields)
  const c = newClip({ start: 3, end: 3.5 }, fileId, 'c', transliterationFields)
  const oldState = clips(
    {
      byId: {
        a: a.clip,
        b: b.clip,
        c: c.clip,
      },
      flashcards: {
        a: a.card,
        b: b.card,
        c: c.card,
      },
      idsByMediaFileId: {
        [fileId]: ['a', 'b', 'c'],
      },
    },
    { type: 'initializeApp' }
  )

  it('adds to byId and idsByMediaFileId during addClip', () => {
    const { clip, card } = newClip(
      { start: 2.75, end: 3 },
      fileId,
      'b-c',
      transliterationFields
    )
    const action = r.addClip(clip, card)
    const newState = clips(oldState, action)
    expect(newState.idsByMediaFileId[fileId]).toEqual(['a', 'b', 'b-c', 'c'])
    expect(newState.byId).toEqual({
      ...oldState.byId,
      [clip.id]: clip,
    })
  })

  it('adds to byId and idsByMediaFileId during addClip', () => {
    const { clip, card } = newClip(
      { start: 4, end: 4.5 },
      fileId,
      'd',
      transliterationFields
    )
    const action = r.addClip(clip, card)
    const newState = clips(oldState, action)
    expect(newState.idsByMediaFileId[fileId]).toEqual(['a', 'b', 'c', 'd'])
    expect(newState.byId).toEqual({
      ...oldState.byId,
      [clip.id]: clip,
    })
  })

  it('adds to byId and idsByMediaFileId during addClips', () => {
    const bC1 = newClip(
      { start: 2.75, end: 2.8 },
      fileId,
      'b-c1',
      transliterationFields
    )
    const bC2 = newClip(
      { start: 2.85, end: 3 },
      fileId,
      'b-c2',
      transliterationFields
    )

    const newClips = [bC1.clip, bC2.clip]
    const newCards = [bC1.card, bC2.card]
    const action = r.addClips(newClips, newCards, fileId)
    const newState = clips(oldState, action)
    expect(newState.idsByMediaFileId[fileId]).toEqual([
      'a',
      'b',
      'b-c1',
      'b-c2',
      'c',
    ])
    expect(newState.byId).toEqual({
      ...oldState.byId,
      'b-c1': bC1.clip,
      'b-c2': bC2.clip,
    })
    expect(newState.flashcards).toEqual({
      ...oldState.flashcards,
      'b-c1': bC1.card,
      'b-c2': bC2.card,
    })
  })

  it('merges clips', () => {
    const mergedFields = {
      pronunciation: 'a\na',
      meaning: 'aaa\naaa',
      transcription: 'asdf\nasdf',
      notes: 'hey\nhey',
    }
    const a = newClip(
      { start: 1, end: 1.5 },
      fileId,
      'a',
      transliterationFields
    )
    const b = newClip(
      { start: 2, end: 2.5 },
      fileId,
      'b',
      transliterationFields
    )
    const c = newClip(
      { start: 3, end: 3.5 },
      fileId,
      'c',
      transliterationFields
    )
    const state = clips(
      {
        byId: {
          a: a.clip,
          b: b.clip,
          c: c.clip,
        },
        flashcards: {
          a: a.card,
          b: b.card,
          c: c.card,
        },
        idsByMediaFileId: {
          [fileId]: ['a', 'b', 'c'],
        },
      },
      { type: 'initializeApp' }
    )
    const mergeAction = r.mergeClips(['a', 'b'], {
      type: 'Clip',
      index: 0,
      id: 'a',
    })

    const expectedA = newClip({ start: 1, end: 2.5 }, fileId, 'a', mergedFields)
    const expectedC = newClip(
      { start: 3, end: 3.5 },
      fileId,
      'c',
      transliterationFields
    )
    expect(clips(state, mergeAction)).toEqual(
      clips(
        {
          byId: { a: expectedA.clip, c: expectedC.clip },
          flashcards: { a: expectedA.card, c: expectedC.card },
          idsByMediaFileId: {
            [fileId]: ['a', 'c'],
          },
        },
        { type: 'initializeApp' }
      )
    )
  })

  it('merges clips with cloze fields', () => {
    const a = newClip({ start: 1, end: 1.5 }, fileId, 'a', {
      transcription: 'The quick brown fox',
      pronunciation: '',
      meaning: '',
      notes: '',
    })
    const b = newClip({ start: 2, end: 2.5 }, fileId, 'b', {
      transcription: 'jumps over the lazy dog',
      pronunciation: '',
      meaning: '',
      notes: '',
    })
    const getWordRange = (text: string, word: string) => {
      const start = text.indexOf(word)
      return {
        start,
        end: start + word.length,
      }
    }
    a.card.cloze = [
      { ranges: [getWordRange(a.card.fields.transcription, 'quick')] },
    ]
    b.card.cloze = [
      {
        ranges: [
          getWordRange(b.card.fields.transcription, 'jumps'),
          getWordRange(b.card.fields.transcription, 'over'),
        ],
      },
      { ranges: [getWordRange(b.card.fields.transcription, 'dog')] },
    ]

    const state = clips(
      {
        byId: {
          a: a.clip,
          b: b.clip,
        },
        flashcards: {
          a: a.card,
          b: b.card,
        },
        idsByMediaFileId: {
          [fileId]: ['a', 'b'],
        },
      },
      { type: 'initializeApp' }
    )
    const mergeAction = r.mergeClips(['a', 'b'], {
      type: 'Clip',
      index: 0,
      id: 'a',
    })

    const expectedMergeResult = newClip({ start: 1, end: 2.5 }, fileId, 'a', {
      transcription: 'The quick brown fox\njumps over the lazy dog',
      pronunciation: '',
      meaning: '',
      notes: '',
    })
    const { fields } = expectedMergeResult.card
    expectedMergeResult.card.cloze = [
      { ranges: [getWordRange(fields.transcription, 'quick')] },
      {
        ranges: [
          getWordRange(fields.transcription, 'jumps'),
          getWordRange(fields.transcription, 'over'),
        ],
      },
      {
        ranges: [getWordRange(fields.transcription, 'dog')],
      },
    ]

    expect(clips(state, mergeAction)).toEqual(
      clips(
        {
          byId: { a: expectedMergeResult.clip },
          flashcards: { a: expectedMergeResult.card },
          idsByMediaFileId: {
            [fileId]: ['a'],
          },
        },
        { type: 'initializeApp' }
      )
    )
  })
})
