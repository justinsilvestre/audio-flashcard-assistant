import React, { useCallback } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import { IconButton, Card, CardContent, Tooltip } from '@material-ui/core'
import cn from 'classnames'
import * as r from '../redux'
import css from './FlashcardSection.module.css'
import {
  ChevronLeft,
  ChevronRight,
  Subtitles,
  Hearing,
  Layers,
} from '@material-ui/icons'
import * as actions from '../actions'
import FlashcardForm from './FlashcardSectionForm'

export const testLabels = {
  container: 'flashcard-section-container',
  previousClipButton: 'previous-clip-button',
  nextClipButton: 'next-clip-button',
} as const

const FlashcardSection = ({
  showing,
  mediaFile,
}: {
  showing: boolean
  mediaFile: MediaFile | null
}) => {
  const { prevId, nextId } = useSelector((state: AppState) => ({
    prevId: r.getFlashcardIdBeforeCurrent(state),
    nextId: r.getFlashcardIdAfterCurrent(state),
  }))
  const dispatch = useDispatch()

  return (
    <section className={cn(css.container, testLabels.container)}>
      <Tooltip title="Previous clip (Ctrl + comma)">
        <span>
          <IconButton
            className={cn(css.navButton, testLabels.previousClipButton)}
            disabled={!prevId}
            onClick={useCallback(
              () => dispatch(actions.highlightClip(prevId)),
              [dispatch, prevId]
            )}
          >
            <ChevronLeft />
          </IconButton>
        </span>
      </Tooltip>
      <Card className={css.card}>
        <CardContent>
          {showing && mediaFile ? (
            <FlashcardForm className={css.form} mediaFile={mediaFile} />
          ) : (
            <Placeholder />
          )}
        </CardContent>
      </Card>
      <Tooltip title="Next clip (Ctrl + period)">
        <span>
          <IconButton
            className={cn(css.navButton, testLabels.nextClipButton)}
            disabled={!nextId}
            onClick={useCallback(
              () => dispatch(actions.highlightClip(nextId)),
              [dispatch, nextId]
            )}
          >
            <ChevronRight />
          </IconButton>
        </span>
      </Tooltip>
    </section>
  )
}

const Placeholder = () => (
  <section className={css.intro}>
    <p className={css.introText}>
      You can <strong>create clips</strong> in a few different ways:
    </p>
    <ul className={css.introList}>
      <li>
        Manually <strong>click and drag</strong> on the waveform
      </li>

      <li>
        Use <Hearing className={css.icon} /> <strong>silence detection</strong>{' '}
        to automatically make clips from audio containing little background
        noise.
      </li>
      <li>
        Use <Subtitles className={css.icon} /> <strong>subtitles</strong> to
        automatically create both clips and flashcards.
      </li>
    </ul>
    <p className={css.introText}>
      When you're done, press the <Layers className={css.icon} />{' '}
      <strong>export button</strong>.
    </p>
  </section>
)

export default FlashcardSection
