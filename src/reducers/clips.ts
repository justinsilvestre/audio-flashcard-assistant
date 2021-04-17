import { Reducer, DeepPartial } from 'redux'
import newFlashcard from '../utils/newFlashcard'
import { getNoteTypeFields } from '../utils/noteType'
import { arrayToMapById } from '../utils/arrayToMapById'
import { TransliterationFlashcardFields } from '../types/Project'
import A from '../types/ActionType'

const initialState: ClipsState = {
  byId: {},
  idsByMediaFileId: {},
  flashcards: {},
}

const byStart = (clips: Record<ClipId, Clip>) => (aId: ClipId, bId: ClipId) => {
  const { start: a } = clips[aId]
  const { start: b } = clips[bId]
  if (a < b) return -1
  if (a > b) return 1
  return 0
}

const addIdToIdsByMediaFileId = (
  oldById: Record<ClipId, Clip>,
  oldIdsByMediaFileId: Array<ClipId>,
  clip: Clip
) => {
  return oldIdsByMediaFileId
    .map((id) => oldById[id])
    .concat(clip)
    .sort((a, b) => a.start - b.start)
    .map((clip) => clip.id)
}

const addIdstoIdsByMediaFileId = (
  oldById: Record<ClipId, Clip>,
  oldIdsByMediaFileId: Array<ClipId>,
  sortedClips: Array<Clip>
) => {
  const newIndex = oldIdsByMediaFileId.findIndex(
    (id) => oldById[id].start > sortedClips[0].start
  )
  return (newIndex === -1 ? [] : oldIdsByMediaFileId.slice(0, newIndex))
    .concat(sortedClips.map((clip) => clip.id))
    .concat(oldIdsByMediaFileId.slice(newIndex))
}

const clips: Reducer<ClipsState, Action> = (state = initialState, action) => {
  switch (action.type) {
    case A.closeProject:
      return initialState

    case A.openProject: {
      const newState: ClipsState = {
        byId: {},
        idsByMediaFileId: {},
        flashcards: action.flashcards,
      }
      const { idsByMediaFileId, byId } = newState
      action.project.mediaFileIds.forEach((id) => {
        idsByMediaFileId[id] = []
      })

      for (const clip of action.clips) {
        byId[clip.id] = clip
        const ids = idsByMediaFileId[clip.fileId]

        ids.push(clip.id) // TODO: secure case when ids is undefined
      }
      for (const fileId in idsByMediaFileId) {
        idsByMediaFileId[fileId].sort(byStart(byId))
      }
      return newState
    }

    case A.addFile:
    case A.openFileRequest:
      if (action.file.type === 'MediaFile')
        return state.idsByMediaFileId[action.file.id]
          ? state
          : {
              ...state,
              idsByMediaFileId: {
                ...state.idsByMediaFileId,
                [action.file.id]: [],
              },
            }
      return state

    case A.addClip: {
      const { clip, flashcard } = action
      const { fileId } = clip
      return {
        ...state,
        byId: {
          ...state.byId,
          [clip.id]: clip,
        },
        idsByMediaFileId: {
          ...state.idsByMediaFileId,
          [fileId]: addIdToIdsByMediaFileId(
            state.byId,
            state.idsByMediaFileId[fileId],
            clip
          ),
        },
        flashcards: {
          ...state.flashcards,
          [clip.id]: flashcard,
        },
      }
    }

    case A.addClips: {
      const { clips, flashcards, fileId } = action
      return {
        ...state,
        byId: {
          ...state.byId,
          ...arrayToMapById(clips),
        },
        idsByMediaFileId: {
          ...state.idsByMediaFileId,
          [fileId]: addIdstoIdsByMediaFileId(
            state.byId,
            state.idsByMediaFileId[fileId],
            clips
          ),
        },
        flashcards: {
          ...state.flashcards,
          ...arrayToMapById(flashcards),
        },
      }
    }

    case A.moveClip: {
      const existingClip = state.byId[action.id]
      const { deltaX } = action
      const movedState = {
        ...state,
        byId: {
          ...state.byId,
          [action.id]: {
            ...existingClip,
            start: existingClip.start + deltaX,
            end: existingClip.end + deltaX,
          },
        },
      }
      return action.overlapIds
        ? mergeClips(action.id, action.overlapIds, movedState.byId, movedState)
        : movedState
    }

    case A.editClip: {
      const { id, override, flashcardOverride } = action
      return editClip(state, id, override, flashcardOverride)
    }

    case A.editClips: {
      let newState = state
      for (const { id, override, flashcardOverride } of action.edits) {
        const updated = editClip(newState, id, override, flashcardOverride)
        newState = updated
      }
      return newState
    }

    case A.mergeClips: {
      const [id1, ...ids] = action.ids
      return mergeClips(id1, ids, state.byId, state)
    }

    case A.stretchClip: {
      const stretchedClipId = action.stretchedClip.id
      const existingClip = state.byId[stretchedClipId]
      const stretchedState = {
        ...state,
        byId: {
          ...state.byId,
          [stretchedClipId]: {
            ...existingClip,
            start: action.stretchedClip.start,
            end: action.stretchedClip.end,
          },
        },
      }
      return action.overlappedClipsIds.length
        ? mergeClips(
            action.stretchedClip.id,
            action.overlappedClipsIds,
            stretchedState.byId,
            stretchedState
          )
        : stretchedState
    }

    case A.deleteCard: {
      const { id } = action
      const { fileId } = state.byId[id]
      const byId = { ...state.byId }
      delete byId[id]
      return {
        ...state,
        byId,
        idsByMediaFileId: {
          ...state.idsByMediaFileId,
          [fileId]: state.idsByMediaFileId[fileId].filter(
            (id) => id !== action.id
          ),
        },
      }
    }

    case A.deleteCards: {
      const { ids } = action
      const byId = { ...state.byId }
      if (!ids.length) return state

      const { fileId } = state.byId[ids[0]]
      action.ids.forEach((id) => {
        delete byId[id]
      })
      return {
        ...state,
        byId,
        idsByMediaFileId: {
          ...state.idsByMediaFileId,
          [fileId]: state.idsByMediaFileId[fileId].filter(
            (id) => !ids.includes(id)
          ),
        },
      }
    }

    case A.setFlashcardField: {
      const { id, key, value, caretLocation } = action
      const card: Flashcard = state.flashcards[id]
      const editDifference = value.length - card.fields.transcription.length
      const caretStart = caretLocation - editDifference

      const editStart = Math.min(caretStart, caretLocation)
      const editEnd = Math.max(caretStart, caretLocation)

      const cloze =
        key === 'transcription' && card.cloze.length
          ? adjustClozeRanges(card, editDifference, editStart, editEnd)
          : card.cloze

      const flashcards: FlashcardsState = {
        ...state.flashcards,
        [id]: {
          ...card,
          fields: {
            ...(card.fields as TransliterationFlashcardFields),
            [key as TransliterationFlashcardFieldName]: value,
          },
          cloze,
        },
      }
      return {
        ...state,
        flashcards,
      }
    }

    case A.addFlashcardTag: {
      const { id, text } = action

      return {
        ...state,

        flashcards: {
          ...state.flashcards,
          [id]: {
            ...state.flashcards[id],

            tags: [
              ...(state.flashcards[id].tags || []),
              text.replace(/\s/g, '_'),
            ],
          },
        },
      }
    }

    case A.deleteFlashcardTag: {
      const { id, index } = action
      const newTags = [...state.flashcards[id].tags]
      newTags.splice(index, 1)

      return {
        ...state,

        flashcards: {
          ...state.flashcards,
          [id]: {
            ...state.flashcards[id],
            tags: newTags,
          },
        },
      }
    }

    case A.deleteFileSuccess: {
      if (action.file.type === 'MediaFile') {
        const clipIds = state.idsByMediaFileId[action.file.id] || []

        const byId = { ...state.byId }
        const flashcards = { ...state.flashcards }
        clipIds.forEach((id) => {
          delete byId[id]
          delete flashcards[id]
        })

        const idsByMediaFileId = { ...state.idsByMediaFileId }
        delete idsByMediaFileId[action.file.id]

        return {
          ...state,
          byId,
          idsByMediaFileId,
          flashcards,
        }
      } else return state
    }
    default:
      return state
  }
}

function mergeClips(
  /** should all have same filepath */
  finalId: ClipId,
  idsToBeDiscarded: ClipId[],
  byId: ClipsState['byId'],
  state: ClipsState
) {
  const unsortedIds = [finalId, ...idsToBeDiscarded]
  const ids = unsortedIds.sort(byStart(byId))
  const { fileId } = byId[ids[0]]
  const clipsOrder = Object.values(byId)
    .sort((a, b) => a.start - b.start)
    .map((s) => s.id)
  const newClipsOrder = clipsOrder.filter(
    (id) => !idsToBeDiscarded.includes(id)
  )
  const newClips: Record<ClipId, Clip> = {}
  const newCards: Record<ClipId, Flashcard> = {}
  newClipsOrder.forEach((id) => {
    const clip = byId[id]
    if (!clip) throw new Error('impossible')
    newClips[id] = clip

    const card = state.flashcards[id]
    if (!card) throw new Error('impossible')
    newCards[id] = card
  })
  const sortedClipsToMerge = ids.map((id) => byId[id])

  const { flashcards: cards } = state
  const flashcard = newFlashcard(
    finalId,
    cards[finalId].fields,
    [
      ...sortedClipsToMerge.reduce((all, { id }) => {
        cards[id].tags.forEach((tag: string) => all.add(tag))
        return all
      }, new Set<string>()),
    ],
    cards[finalId].image
  )
  const fieldNames = getNoteTypeFields(flashcard.type)

  for (const fieldName of fieldNames) {
    if (fieldName === 'transcription') {
      const mergingCards = sortedClipsToMerge.map(({ id }) => cards[id])
      const { clozeDeletions, text } = mergeClozeFields(mergingCards, fieldName)
      flashcard.fields[fieldName as SimpleFlashcardFieldName] = text
      flashcard.cloze = clozeDeletions
    } else {
      const values = sortedClipsToMerge.map(
        ({ id }) =>
          cards[id].fields[fieldName as SimpleFlashcardFieldName] || ''
      )

      const value = values.filter((x) => x.trim()).join('\n')
      flashcard.fields[fieldName as SimpleFlashcardFieldName] = value
    }
  }

  if (flashcard.cloze.length > 10) console.error(flashcard.cloze.splice(10))

  newClips[finalId] = {
    ...byId[finalId],
    start: sortedClipsToMerge[0].start,
    end: Math.max(...sortedClipsToMerge.map((c) => c.end)),
  }
  return {
    ...state,
    byId: newClips,
    idsByMediaFileId: {
      ...state.idsByMediaFileId,
      [fileId]: state.idsByMediaFileId[fileId].filter(
        (id) => !idsToBeDiscarded.includes(id)
      ),
    },
    flashcards: {
      ...newCards,
      [finalId]: flashcard,
    },
  }
}

export function mergeClozeFields(
  mergingCards: { fields: Flashcard['fields']; cloze: Flashcard['cloze'] }[],
  fieldName: string
) {
  const clozeDeletions: ClozeDeletion[] = []
  let mergedValueSoFar = ''

  let mergingCardIndex = 0
  for (const card of mergingCards) {
    const transcriptionText =
      card.fields[fieldName as SimpleFlashcardFieldName] || ''
    const trimmed = transcriptionText.trim()
    if (mergingCardIndex > 0 && trimmed) mergedValueSoFar += '\n'
    const mergingCard = mergingCards[mergingCardIndex]

    clozeDeletions.push(
      /* eslint-disable @typescript-eslint/no-loop-func */
      ...mergingCard.cloze.map((c) => ({
        ...c,
        ranges: c.ranges.map((r) => ({
          start: r.start + mergedValueSoFar.length,
          end: r.end + mergedValueSoFar.length,
        })),
      }))
    )
    /* eslint-enable @typescript-eslint/no-loop-func */
    mergedValueSoFar += trimmed
    mergingCardIndex++
  }
  return { clozeDeletions, text: mergedValueSoFar }
}

function adjustClozeRanges(
  card: Flashcard,
  editDifference: number,
  editStart: number,
  editEnd: number
) {
  return card.cloze
    .map((c) => ({
      ...c,
      ranges: c.ranges
        .map((r) => {
          if (editDifference < 0) {
            const deletion = {
              start: editStart,
              end: editEnd,
            }
            const overlap = deletion.start <= r.end && deletion.end > r.start
            if (overlap && (deletion.start < r.start || deletion.end > r.end)) {
              return deletion.start < r.start
                ? {
                    start: deletion.start,
                    end: deletion.start + 1 + (r.end - deletion.end),
                  }
                : {
                    start: r.start,
                    end: deletion.start,
                  }
            }
          }
          return {
            start: editStart >= r.start ? r.start : r.start + editDifference,
            end: editStart <= r.end ? r.end + editDifference : r.end,
          }
        })
        .filter(
          (r) =>
            r.start !== r.end && r.end > r.start && r.end > 0 && r.start >= 0
        ),
    }))
    .filter((c) => c.ranges.length)
}

function editClip(
  state: ClipsState,
  id: string,
  override: DeepPartial<Clip> | null,
  flashcardOverride: DeepPartial<Flashcard> | null
) {
  const clip = state.byId[id]
  const flashcard = state.flashcards[id]
  const newClip: Clip = override
    ? {
        // START AND END SHOULD ALWAYS BE SORTED! where is the right place to do this?
        id,
        fileId: clip.fileId,
        start: override.start || clip.start,
        end: override.end || clip.end,
        clipwaveType: 'Primary',
      }
    : clip

  const fields = {
    ...flashcard.fields,
    ...(flashcardOverride ? flashcardOverride.fields : null),
  } as TransliterationFlashcardFields
  const newFlashcard: Flashcard = flashcardOverride
    ? {
        id,
        type: flashcard.type,
        image:
          'image' in flashcardOverride
            ? flashcardOverride.image
            : flashcard.image,
        fields,
        tags: flashcardOverride.tags
          ? flashcardOverride.tags.filter((t): t is string => Boolean(t))
          : flashcard.tags,
        cloze: (flashcardOverride.cloze as ClozeDeletion[]) || flashcard.cloze,
      }
    : state.flashcards[id]
  return {
    ...state,
    byId:
      newClip === clip
        ? state.byId
        : {
            ...state.byId,
            [id]: newClip,
          },
    flashcards:
      newFlashcard === flashcard
        ? state.flashcards
        : { ...state.flashcards, [id]: newFlashcard },
  }
}

export default clips
