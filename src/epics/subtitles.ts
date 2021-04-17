import { ofType, combineEpics } from 'redux-observable'
import {
  mergeMap,
  map,
  filter,
  take,
  concatMap,
  ignoreElements,
  startWith,
  takeUntil,
  endWith,
  concat,
  tap,
} from 'rxjs/operators'
import { of, Observable } from 'rxjs'
import r from '../redux'
import A from '../types/ActionType'
import { from } from 'rxjs'
import { uuid } from '../utils/sideEffects'
import { areSameFile } from '../utils/files'
import { SubtitlesFileWithTrack } from '../selectors'
import { afterUpdates } from '../utils/afterUpdates'
import { msToSeconds } from 'clipwave'

const makeClipsFromSubtitles: AppEpic = (
  action$,
  state$,
  { pauseMedia, setCurrentTime }
) =>
  action$.pipe(
    ofType<Action, MakeClipsFromSubtitles>(A.makeClipsFromSubtitles),
    mergeMap<MakeClipsFromSubtitles, Observable<Action>>(
      ({ fileId, fieldNamesToTrackIds, tags, includeStill }) => {
        const tracksValidation = validateTracks(
          state$.value,
          fieldNamesToTrackIds
        )

        pauseMedia()
        setCurrentTime(0)

        if (tracksValidation.status === 'NO_LINKS_GIVEN')
          return of(
            r.simpleMessageSnackbar(
              'Please choose a subtitles track to make cards from before proceeding.'
            ),
            r.showSubtitlesClipsDialogRequest()
          )

        if (tracksValidation.status === 'MISSING_FILE_RECORDS')
          return from([
            r.simpleMessageSnackbar(
              `The following subtitles could not be read: ${tracksValidation.result
                .map(({ label }) => label)
                .join(', ')}`
            ),
            r.showSubtitlesClipsDialogRequest(),
          ])

        if (tracksValidation.status === 'MISSING_TRACKS') {
          const missingTracks = Object.entries(
            tracksValidation.fieldNamesToFiles
          ) as [TransliterationFlashcardFieldName, SubtitlesFile][]
          const openMissingSubtitlesFailure = action$.pipe(
            ofType<Action, OpenFileFailure>('openFileFailure'),
            filter(({ file }) =>
              missingTracks.some(([, t]) => t.id === file.id)
            ),
            take(1)
          )
          return from(missingTracks).pipe(
            concatMap(([, file]) =>
              of(r.openFileRequest(file)).pipe(
                concat(
                  action$.pipe(
                    ofType<Action, OpenFileSuccess>('openFileSuccess'),
                    filter((a) => areSameFile(file, a.validatedFile)),
                    take(1),
                    ignoreElements()
                  )
                )
              )
            ),
            startWith(r.closeDialog()),
            takeUntil(openMissingSubtitlesFailure),
            // either this or right on to successful clip creation? this will require another action though.
            // same idea would be nice for export too`
            endWith(r.subtitlesClipDialog())
          )
        }

        const currentFile = r.getCurrentMediaFile(state$.value)
        if (!currentFile)
          return of(
            r.simpleMessageSnackbar(
              'Could not find media file to make clips from.'
            )
          )

        return from([
          r.deleteCards(
            r.getClipIdsByMediaFileId(state$.value, currentFile.id)
          ),
          r.setDefaultClipSpecs({ tags, includeStill }),
          ...Object.keys(fieldNamesToTrackIds).map((badTypefieldName) => {
            const fieldName = badTypefieldName as FlashcardFieldName
            const trackId = fieldNamesToTrackIds[fieldName] || null
            const action = r.linkFlashcardFieldToSubtitlesTrack(
              fieldName,
              currentFile.id,
              trackId
            )
            return action
          }),
        ]).pipe(
          concat(
            afterUpdates(async () => {
              const clips: Clip[] = []
              const cards: Flashcard[] = []

              getClipsAndCardsFromSubtitles(
                tracksValidation.cueTrackFieldName,
                fieldNamesToTrackIds,
                state$.value,
                fileId
              ).forEach(({ clip, flashcard }) => {
                clips.push(clip)
                cards.push(flashcard)
              })
              return from([
                r.addClips(clips, cards, fileId),
                r.highlightRightClipRequest(),
              ])
            })
          )
        )
      }
    )
  )

const showSubtitlesClipsDialogRequest: AppEpic = (action$, state$) =>
  action$.pipe(
    ofType<Action, ShowSubtitlesClipsDialogRequest>(
      A.showSubtitlesClipsDialogRequest
    ),
    map(() => {
      const tracks = r.getSubtitlesTracks(state$.value)
      if (!tracks.length)
        return r.simpleMessageSnackbar(
          'Please add a subtitles track and try again.'
        )
      const mediaFile = r.getCurrentMediaFile(state$.value)
      if (!mediaFile || !r.getCurrentFilePath(state$.value))
        return r.simpleMessageSnackbar(
          'Please locate this media file and try again.'
        )
      if (!r.getCurrentFileClips(state$.value).length)
        return r.subtitlesClipDialog()
      return r.confirmationDialog(
        'This action will PERMANENTLY delete any clips and cards you made for this current file. Are you sure you want to continue?',
        r.subtitlesClipDialog()
      )
    })
  )

const goToSubtitlesChunk: AppEpic = (action$, state$, { setCurrentTime }) =>
  action$.pipe(
    ofType<Action, GoToSubtitlesChunk>(A.goToSubtitlesChunk),
    tap(({ chunkIndex, subtitlesTrackId }) => {
      const track = r.getSubtitlesTrack(state$.value, subtitlesTrackId)
      if (!track) {
        console.error('Track not found')
        return
      }
      const { start } = track.chunks[chunkIndex]
      setCurrentTime(msToSeconds(start))
      return
    }),
    ignoreElements()
  )

function validateTracks(
  state: AppState,
  fieldNamesToTrackIds: SubtitlesFlashcardFieldsLinks
):
  | { status: 'NO_LINKS_GIVEN' }
  | { status: 'MISSING_FILE_RECORDS'; result: SubtitlesFileWithTrack[] }
  | {
      status: 'MISSING_TRACKS'
      fieldNamesToFiles: {
        [K in TransliterationFlashcardFieldName]?: SubtitlesFile
      }
    }
  | {
      status: 'SUCCESS'
      cueTrackFieldName: TransliterationFlashcardFieldName
    } {
  if (
    !Object.values(fieldNamesToTrackIds).find(
      (trackId) => trackId && trackId.trim()
    )
  )
    return { status: 'NO_LINKS_GIVEN' }

  const allMediaSubtitles = r.getSubtitlesFilesWithTracks(state)
  const missingFileRecords = allMediaSubtitles.all.filter(
    ({ sourceFile: file }) => !file
  )
  if (missingFileRecords.length)
    return { status: 'MISSING_FILE_RECORDS', result: missingFileRecords }

  const missingTracks = allMediaSubtitles.all.filter(
    (s): s is SubtitlesFileWithTrack & { file: SubtitlesFile; track: null } =>
      !s.track
  )

  if (missingTracks.length) {
    const fieldNamesToFiles = {} as {
      [K in TransliterationFlashcardFieldName]?: SubtitlesFile
    }
    for (const fn in fieldNamesToTrackIds) {
      const fieldName = fn as TransliterationFlashcardFieldName
      const trackId = fieldNamesToTrackIds[fieldName]
      const missingTrack = missingTracks.find((t) => t.relation.id === trackId)
      if (missingTrack) fieldNamesToFiles[fieldName] = missingTrack.file
    }
    return { status: 'MISSING_TRACKS', fieldNamesToFiles }
  }

  const cueTrackFieldName = r.CUES_BASE_PRIORITY.find(
    (fieldName) => fieldNamesToTrackIds[fieldName]
  ) as TransliterationFlashcardFieldName

  return {
    status: 'SUCCESS',
    cueTrackFieldName,
  }
}

function getClipsAndCardsFromSubtitles(
  cueTrackFieldName: TransliterationFlashcardFieldName,
  fieldNamesToTrackIds: SubtitlesFlashcardFieldsLinks,
  state: AppState,
  fileId: string
) {
  const trackId = fieldNamesToTrackIds[cueTrackFieldName]
  const cueTrack = trackId && r.getSubtitlesTrack(state, trackId)
  if (!cueTrack)
    throw new Error('Could not load subtitles file for generating clips')

  const currentNoteType = r.getCurrentNoteType(state)
  if (!currentNoteType) throw new Error('Could not find note type.') // should be impossible

  // careful, pretty sure this mutates
  const sortedChunks = cueTrack.chunks.sort(
    ({ start: a }, { start: b }) => a - b
  )
  return sortedChunks.map((chunk, chunkIndex) => {
    const fields =
      currentNoteType === 'Simple'
        ? {
            transcription: chunk.text,
            meaning: '',
            notes: '',
          }
        : {
            transcription: chunk.text,
            meaning: '',
            notes: '',
            pronunciation: '',
          }
    ;(Object.keys(fields) as Array<keyof typeof fields>).forEach(
      (fieldName) => {
        const trackId = fieldNamesToTrackIds[fieldName]
        fields[fieldName] = trackId
          ? r
              .getSubtitlesChunksWithinRange(
                state,
                trackId,
                chunk.start,
                chunk.end
              )
              .map((chunk) => chunk.text)
              .join(' ')
          : ''
      }
    )
    return r.getNewClipAndCard(
      state,
      {
        start: chunk.start,
        end:
          sortedChunks[chunkIndex + 1] &&
          chunk.end === sortedChunks[chunkIndex + 1].start
            ? chunk.end - 1
            : chunk.end,
      },
      fileId,
      uuid(),
      fields
    )
  })
}

export default combineEpics(
  makeClipsFromSubtitles,
  showSubtitlesClipsDialogRequest,
  goToSubtitlesChunk
)
