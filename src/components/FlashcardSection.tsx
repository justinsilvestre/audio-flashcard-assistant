import React, { useCallback, useState } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import {
  TextField,
  IconButton,
  Card,
  CardContent,
  Menu,
  MenuItem,
  Tooltip,
} from '@material-ui/core'
import { Delete as DeleteIcon, Loop, MoreVert } from '@material-ui/icons'
import formatTime from '../utils/formatTime'
import * as r from '../redux'
import css from './FlashcardSection.module.css'
import { getNoteTypeFields } from '../utils/noteType'
import {
  ChevronLeft,
  ChevronRight,
  Subtitles,
  Hearing,
  Layers,
} from '@material-ui/icons'
import TagsInput from './TagsInput'
import usePopover from '../utils/usePopover'
import * as actions from '../actions'

type FieldMenuProps = {
  embeddedSubtitlesTracks: EmbeddedSubtitlesTrack[]
  externalSubtitlesTracks: ExternalSubtitlesTrack[]
  linkToSubtitlesTrack: (trackId: string | null) => void
  linkedSubtitlesTrack: string | null
}
const FieldMenu = ({
  embeddedSubtitlesTracks,
  externalSubtitlesTracks,
  linkToSubtitlesTrack,
  linkedSubtitlesTrack,
}: FieldMenuProps) => {
  const subtitlesPopover = usePopover()
  return (
    <React.Fragment>
      <Tooltip
        title={
          linkedSubtitlesTrack
            ? 'Link/unlink subtitles track'
            : 'Link subtitles track'
        }
      >
        <IconButton
          tabIndex={-1}
          className={css.fieldMenuButton}
          buttonRef={subtitlesPopover.anchorCallbackRef}
          onClick={subtitlesPopover.open}
        >
          <MoreVert />
        </IconButton>
      </Tooltip>
      {subtitlesPopover.isOpen && (
        <Menu
          anchorEl={subtitlesPopover.anchorEl}
          open={subtitlesPopover.isOpen}
          onClose={subtitlesPopover.close}
        >
          {embeddedSubtitlesTracks.map((track: EmbeddedSubtitlesTrack, i) => {
            const selected = linkedSubtitlesTrack === track.id
            return (
              <MenuItem
                onClick={() => linkToSubtitlesTrack(selected ? null : track.id)}
                selected={selected}
              >
                Embedded subtitles track {i + 1}
              </MenuItem>
            )
          })}
          {externalSubtitlesTracks.map((track, i) => {
            const selected = linkedSubtitlesTrack === track.id
            return (
              <MenuItem
                onClick={() => linkToSubtitlesTrack(selected ? null : track.id)}
                selected={selected}
              >
                External subtitles track {i + 1}
              </MenuItem>
            )
          })}
          ))}
        </Menu>
      )}
    </React.Fragment>
  )
}

const capitalize = (string: string) =>
  string.substring(0, 1).toUpperCase() + string.slice(1)

const getSubtitlesTrackLabel = (
  embedded: EmbeddedSubtitlesTrack[],
  external: ExternalSubtitlesTrack[],
  trackId: string
) => {
  const embeddedIndex = embedded.findIndex(t => t.id === trackId)
  return embeddedIndex !== -1
    ? `Embedded subtitles track ${embeddedIndex + 1}`
    : `External subtitles track ${external.findIndex(t => t.id === trackId) +
        1}`
}

type FieldProps = {
  id: FlashcardFieldName
  currentFlashcard: Flashcard
  name: string
  setFlashcardText: (id: string, text: string) => void
  embeddedSubtitlesTracks: EmbeddedSubtitlesTrack[]
  externalSubtitlesTracks: ExternalSubtitlesTrack[]
  linkedSubtitlesTrack: string | null
  linkToSubtitlesTrack: (trackId: string | null) => void
}
const Field = ({
  id,
  currentFlashcard,
  name,
  setFlashcardText,
  embeddedSubtitlesTracks,
  externalSubtitlesTracks,
  linkedSubtitlesTrack,
  linkToSubtitlesTrack,
}: FieldProps) => {
  const handleChange = useCallback(e => setFlashcardText(id, e.target.value), [
    setFlashcardText,
    id,
  ])

  const linkedTrackName = linkedSubtitlesTrack
    ? `—${getSubtitlesTrackLabel(
        embeddedSubtitlesTracks,
        externalSubtitlesTracks,
        linkedSubtitlesTrack
      )}`
    : ''

  return (
    <section className={css.field}>
      {Boolean(
        embeddedSubtitlesTracks.length + externalSubtitlesTracks.length
      ) && (
        <FieldMenu
          {...{
            embeddedSubtitlesTracks,
            externalSubtitlesTracks,
            linkToSubtitlesTrack,
            linkedSubtitlesTrack,
          }}
        />
      )}
      <TextField
        onChange={handleChange}
        value={
          id in currentFlashcard.fields
            ? (currentFlashcard.fields as Record<
                TransliterationFlashcardFieldName,
                string
              >)[id]
            : ''
        }
        fullWidth
        multiline
        margin="dense"
        label={name + linkedTrackName}
      />
    </section>
  )
}

const FlashcardSection = ({ showing }: { showing: boolean }) => {
  const dispatch = useDispatch()
  const {
    allTags,
    currentFlashcard,
    currentMediaFileId,
    highlightedClipId,
    selectedClipTime,
    currentNoteType,
    isLoopOn,
    prevId,
    nextId,
    embeddedSubtitlesTracks,
    externalSubtitlesTracks,
    subtitlesFlashcardFieldLinks,
  } = useSelector((state: AppState) => ({
    allTags: r.getAllTags(state),
    currentFlashcard: r.getCurrentFlashcard(state),
    currentMediaFileId: r.getCurrentFileId(state),
    selectedClipTime: r.getSelectedClipTime(state),
    highlightedClipId: r.getHighlightedClipId(state),
    currentNoteType: r.getCurrentNoteType(state),
    isLoopOn: r.isLoopOn(state),
    prevId: r.getFlashcardIdBeforeCurrent(state),
    nextId: r.getFlashcardIdAfterCurrent(state),
    embeddedSubtitlesTracks: r.getEmbeddedSubtitlesTracks(state),
    externalSubtitlesTracks: r.getExternalSubtitlesTracks(state),
    subtitlesFlashcardFieldLinks: r.getSubtitlesFlashcardFieldLinks(state),
  }))

  // highlightClip,
  // addFlashcardTag,
  // deleteFlashcardTag,
  // linkFlashcardFieldToSubtitlesTrack,

  const [moreMenuAnchorEl, setMoreMenuAnchorEl] = useState(null)

  // const handleClickMoreButton = useCallback(
  //   event => {
  //     setMoreMenuAnchorEl(event.currentTarget)
  //   },
  //   [setMoreMenuAnchorEl]
  // )

  const toggleLoop = useCallback(() => dispatch(actions.toggleLoop()), [
    dispatch,
  ])
  const handleCloseMoreMenu = useCallback(
    () => {
      setMoreMenuAnchorEl(null)
    },
    [setMoreMenuAnchorEl]
  )

  const handleClickDeleteButton = useCallback(
    () => {
      if (highlightedClipId)
        dispatch(
          actions.confirmationDialog(
            'Are you sure you want to delete this clip and flashcard?',
            actions.deleteCard(highlightedClipId)
          )
        )
    },
    [dispatch, highlightedClipId]
  )

  const handleFlashcardSubmit = useCallback(e => {
    e.preventDefault()
  }, [])

  const setFlashcardText = useCallback(
    (key, text) => {
      if (highlightedClipId)
        dispatch(actions.setFlashcardField(highlightedClipId, key, text))
    },
    [dispatch, highlightedClipId]
  )
  const deleteCard = () => {
    if (highlightedClipId) {
      dispatch(actions.deleteCard(highlightedClipId))
    }
  }

  if (
    !highlightedClipId ||
    !selectedClipTime ||
    !currentFlashcard ||
    !currentMediaFileId
  )
    throw new Error('Clip not found')

  const onAddChip = useCallback(
    (text: string) =>
      dispatch(actions.addFlashcardTag(highlightedClipId, text)),
    [dispatch, highlightedClipId]
  )
  const onDeleteChip = useCallback(
    (index, text) =>
      dispatch(actions.deleteFlashcardTag(highlightedClipId, index, text)),
    [dispatch, highlightedClipId]
  )

  return (
    <section className={css.container}>
      <Tooltip title="Previous clip (Ctrl + comma)">
        <span>
          {' '}
          <IconButton
            className={css.navButton}
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

      <Card className={css.form}>
        {!showing ? (
          <CardContent className={css.intro}>
            <p className={css.introText}>
              You can <strong>create clips</strong> in a few different ways:
            </p>
            <ul className={css.introList}>
              <li>
                Manually <strong>click and drag</strong> on the waveform
              </li>

              <li>
                Use <Hearing className={css.icon} />{' '}
                <strong>silence detection</strong> to automatically make clips
                from audio containing little background noise.
              </li>
              <li>
                Use <Subtitles className={css.icon} />{' '}
                <strong>subtitles</strong> to automatically create both clips
                and flashcards.
              </li>
            </ul>
            <p className={css.introText}>
              When you're done, press the <Layers className={css.icon} />{' '}
              <strong>export button</strong>.
            </p>
          </CardContent>
        ) : (
          <CardContent>
            <form className="form" onSubmit={handleFlashcardSubmit}>
              <div className="formBody">
                <section className={css.timeStamp}>
                  {formatTime(selectedClipTime.start)}
                  {' - '}
                  {formatTime(selectedClipTime.end)}
                  <Tooltip title="Loop audio (Ctrl + L)">
                    <IconButton
                      onClick={toggleLoop}
                      color={isLoopOn ? 'secondary' : 'default'}
                    >
                      <Loop />
                    </IconButton>
                  </Tooltip>
                </section>
                {currentNoteType &&
                  getNoteTypeFields(currentNoteType).map(id => (
                    <Field
                      key={`${id}_${currentFlashcard.id}`}
                      id={id}
                      currentFlashcard={currentFlashcard}
                      name={capitalize(id)}
                      setFlashcardText={setFlashcardText}
                      embeddedSubtitlesTracks={embeddedSubtitlesTracks}
                      externalSubtitlesTracks={externalSubtitlesTracks}
                      linkedSubtitlesTrack={
                        subtitlesFlashcardFieldLinks[id] || null
                      }
                      linkToSubtitlesTrack={trackId =>
                        dispatch(
                          actions.linkFlashcardFieldToSubtitlesTrack(
                            id,
                            currentMediaFileId,
                            trackId
                          )
                        )
                      }
                    />
                  ))}
                <TagsInput
                  allTags={allTags}
                  tags={currentFlashcard.tags}
                  onAddChip={onAddChip}
                  onDeleteChip={onDeleteChip}
                />

                <section className={css.bottom}>
                  {/* <span className={css.noteTypeName}>
                  Using card template:{' '}
                  <Tooltip title="Edit card template">
                    <span
                      className={css.noteTypeNameLink}
                      onClick={editCardTemplate}
                      tabIndex={0}
                    >
                      {currentNoteType.name}
                    </span>
                  </Tooltip>
                </span> */}
                  <IconButton
                    className={css.moreMenuButton}
                    onClick={handleClickDeleteButton}
                  >
                    <DeleteIcon />
                  </IconButton>
                  <Menu
                    anchorEl={moreMenuAnchorEl}
                    open={Boolean(moreMenuAnchorEl)}
                    onClose={handleCloseMoreMenu}
                  >
                    {/* <MenuItem onClick={editCardTemplate}>
                    Edit card template
                  </MenuItem> */}
                    <MenuItem onClick={deleteCard}>Delete card</MenuItem>
                  </Menu>
                </section>
                {/* <IconButton
                className={css.deleteButton}
                onClick={deleteCard}
              >
                <DeleteIcon />
              </IconButton> */}
              </div>
            </form>
          </CardContent>
        )}
      </Card>

      <Tooltip title="Next clip (Ctrl + period)">
        <span>
          <IconButton
            className={css.navButton}
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

export default FlashcardSection