import { combineEpics } from 'redux-observable'
import { filter, mergeMap, map, sample } from 'rxjs/operators'
import { of, from, EMPTY } from 'rxjs'
import r from '../redux'
import A from '../types/ActionType'
import { TransliterationFlashcardFields } from '../types/Project'
import { getUpdateWith } from '../files/updates'
import { msToSeconds } from 'clipwave'

const linkFieldToTrackRequest: AppEpic = (action$, state$) =>
  action$
    .ofType<LinkFlashcardFieldToSubtitlesTrackRequest>(
      A.linkFlashcardFieldToSubtitlesTrackRequest
    )
    .pipe(
      map<LinkFlashcardFieldToSubtitlesTrackRequest, Action>(
        ({ mediaFileId, flashcardFieldName, subtitlesTrackId }) => {
          const previousLinks = r.getSubtitlesFlashcardFieldLinks(state$.value)
          const previouslyLinkedField = (Object.keys(
            previousLinks
          ) as FlashcardFieldName[]).find((fn) => {
            const fieldName = fn as TransliterationFlashcardFieldName
            return previousLinks[fieldName] === subtitlesTrackId
          })
          const cards = r.getFlashcards(state$.value, mediaFileId)
          if (!cards.length)
            return r.linkFlashcardFieldToSubtitlesTrack(
              flashcardFieldName,
              mediaFileId,
              subtitlesTrackId
            )

          const actions: string[] = []
          const unlinking = !subtitlesTrackId
          if (previouslyLinkedField || unlinking) {
            actions.push(
              `clear the ${previouslyLinkedField || flashcardFieldName} field`
            )
          }
          if (!unlinking) {
            actions.push(`overwrite the ${flashcardFieldName} field`)
          }

          const message =
            "It looks like you've already made some flashcards from this media file." +
            '\n\n' +
            `This action will ${actions.join(
              ' and '
            )} for all these existing cards.` +
            '\n\n' +
            'Is that OK?'

          return r.confirmationDialog(
            message,
            r.linkFlashcardFieldToSubtitlesTrack(
              flashcardFieldName,
              mediaFileId,
              subtitlesTrackId,
              previouslyLinkedField
            )
          )
        }
      )
    )

const linkFieldToTrack: AppEpic = (action$, state$) =>
  action$.pipe(
    mergeMap((action) => {
      if (action.type !== 'updateFile') return EMPTY

      const update = getUpdateWith(
        action.update,
        'linkFlashcardFieldToSubtitlesTrack'
      )
      if (!update) return EMPTY

      const currentNoteType = r.getCurrentNoteType(state$.value)
      if (!currentNoteType) return EMPTY

      const mediaFileId = update.id
      const [
        flashcardFieldName,
        _subtitlesTrackId,
        fieldToClear,
      ] = update.updatePayload

      const edits: EditClips['edits'] = []

      for (const clip of r.getClips(state$.value, mediaFileId)) {
        const {
          [flashcardFieldName as TransliterationFlashcardFieldName]: newValue,
        } = r.getNewFieldsFromLinkedSubtitles(
          state$.value,
          clip
        ) as TransliterationFlashcardFields
        const newFields = { [flashcardFieldName]: newValue.trim() }
        if (fieldToClear) newFields[fieldToClear] = ''

        edits.push({
          id: clip.id,
          flashcardOverride: { fields: newFields },
          override: null,
        })
      }

      return of(r.editClips(edits))
    })
  )

export const newClipFromChunkOnEdit: AppEpic = (action$, state$) =>
  action$.ofType<StartEditingCards>(A.startEditingCards).pipe(
    mergeMap(() => {
      const selection = r.getWaveformSelection(state$.value)
      if (selection && selection.type === 'Preview') {
        return of(r.newCardFromSubtitlesRequest(selection, undefined, true))
      }
      return EMPTY
    })
  )

export const newClipFromChunk: AppEpic = (
  action$,
  state$,
  { setCurrentTime, uuid }
) =>
  action$
    .ofType<NewCardFromSubtitlesRequest>(A.newCardFromSubtitlesRequest)
    .pipe(
      mergeMap((action) => {
        const selection = action.linkedSubtitlesChunkSelection

        const mediaFileId = r.getCurrentFileId(state$.value)
        if (!mediaFileId) return EMPTY
        const cardBases = r.getSubtitlesCardBases(state$.value)

        const fields = r.getNewFieldsFromLinkedSubtitles(
          state$.value,
          cardBases.cards[selection.item.index]
        )
        const { clip, flashcard } = r.getNewClipAndCard(
          state$.value,
          {
            start: selection.item.start,
            end: selection.item.end,
          },
          mediaFileId,
          uuid(),
          fields
        )

        if (action.clozeDeletion) {
          flashcard.cloze = [action.clozeDeletion]
        }

        setCurrentTime(msToSeconds(selection.item.start))

        return from([r.addClip(clip, flashcard, action.startEditing || false)])
      })
    )

const updateSelectionAfterLink: AppEpic = (
  action$,
  state$,
  { setCurrentTime, getCurrentTime }
) =>
  action$
    .ofType<LinkFlashcardFieldToSubtitlesTrackRequest>(
      A.linkFlashcardFieldToSubtitlesTrackRequest
    )
    .pipe(
      map(() => {
        return r.getWaveformSelection(state$.value)
      }),
      sample(
        action$.pipe(
          filter(
            (action) =>
              action.type === A.updateFile &&
              Boolean(
                getUpdateWith(
                  action.update,
                  'linkFlashcardFieldToSubtitlesTrack'
                )
              )
          )
        )
      ),
      mergeMap((selection) => {
        if (selection && selection.type === 'Preview') {
          const newSelection = r.getNewWaveformSelectionAt(
            state$.value,
            selection.item.start
          )
          if (
            newSelection &&
            msToSeconds(newSelection.item.start) !== getCurrentTime()
          ) {
            setCurrentTime(msToSeconds(newSelection.item.start))
          }
          return newSelection ? of(r.selectWaveformItem(newSelection)) : EMPTY
        }

        return EMPTY
      })
    )

export default combineEpics(
  updateSelectionAfterLink,
  linkFieldToTrackRequest,
  linkFieldToTrack,
  newClipFromChunk,
  newClipFromChunkOnEdit
)
