import { switchMap } from 'rxjs/operators'
import { of } from 'rxjs'
import r from '../redux'
import A from '../types/ActionType'
import { ActionOf } from '../actions'

const clipCreateEpic: AppEpic = (action$, state$) => {
  return action$
    .ofType<ActionOf<typeof A.addClipRequest>>(A.addClipRequest)
    .pipe(
      switchMap(({ waveformDrag, clipId }) => {
        const left = Math.min(waveformDrag.start, waveformDrag.end)
        const right = Math.max(waveformDrag.start, waveformDrag.end)

        const currentFileId = r.getCurrentFileId(state$.value)
        if (!currentFileId) throw new Error('Could not find current note type')

        const coordinates = {
          start: left,
          end: right,
        }
        // TODO: get linked subtitles from waveformDrag.overlaps
        const fields = r.getNewFieldsFromLinkedSubtitles(
          state$.value,
          coordinates
        )
        const { clip, flashcard } = r.getNewClipAndCard(
          state$.value,
          coordinates,
          currentFileId,
          clipId,
          fields
        )
        return of(
          r.addClip(
            clip,
            flashcard,
            !Object.values(fields).some((fieldValue) => fieldValue.trim())
          )
        )
      })
    )
}

export default clipCreateEpic
