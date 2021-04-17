import React, { Fragment, useCallback } from 'react'
import {
  Subtitles as SubtitlesIcon,
  Visibility as VisibilityOnIcon,
  VisibilityOff as VisibilityOffIcon,
  MoreVert,
  FolderSpecial,
  Link,
  Delete as DeleteIcon,
} from '@material-ui/icons'
import { useDispatch, useSelector } from 'react-redux'
import r from '../redux'
import { actions } from '../actions'
import {
  IconButton,
  Icon,
  Tooltip,
  Menu,
  MenuItem,
  ListItemText,
  ListItemSecondaryAction,
  ListItemIcon,
  Divider,
  MenuList,
  Popover,
} from '@material-ui/core'
import { showOpenDialog } from '../utils/electron'
import css from './MainHeader.module.css'
import usePopover from '../utils/usePopover'

enum $ {
  openMenuButton = 'subtitles-menu-open-menu-button',
  trackMenuItems = 'subtitles-menu-track-item',
  openTrackSubmenuButton = 'subtitles-menu-open-track-menu-button',
  locateExternalFileButton = 'subtitles-menu-locate-external-file-button',
  addTrackButton = 'subtitles-menu-add-track-button',
  deleteTrackButton = 'subtitles-menu-delete-track-button',
  makeClipsAndCardsButton = 'subtitles-menu-make-clips-and-cards-button',
}

const SubtitlesMenu = () => {
  const { anchorEl, anchorCallbackRef, open, close, isOpen } = usePopover()

  const { subtitles, currentFileId } = useSelector((state: AppState) => {
    const currentFileId = r.getCurrentFileId(state)
    return {
      subtitles: r.getSubtitlesFilesWithTracks(state),
      currentFileId,
    }
  })

  const dispatch = useDispatch()
  const loadExternalTrack = useCallback(
    async (e) => {
      if (!currentFileId)
        return dispatch(
          actions.simpleMessageSnackbar('Please open a media file first.')
        )

      const filePaths = await showOpenDialog([
        { name: 'Subtitles', extensions: ['srt', 'ass', 'vtt'] },
      ])
      if (!filePaths) return

      dispatch(actions.loadNewSubtitlesFile(filePaths[0], currentFileId))

      close(e)
    },
    [dispatch, currentFileId, close]
  )
  const subtitlesClipsDialogRequest = useCallback(
    (e) => {
      dispatch(actions.showSubtitlesClipsDialogRequest())
      close(e)
    },
    [dispatch, close]
  )

  return (
    <Fragment>
      <Tooltip title="Subtitles">
        <IconButton
          buttonRef={anchorCallbackRef}
          onClick={open}
          id={$.openMenuButton}
        >
          <SubtitlesIcon />
        </IconButton>
      </Tooltip>
      {isOpen && (
        <Popover anchorEl={anchorEl} open={isOpen} onClose={close}>
          <MenuList>
            {!subtitles.total && (
              <MenuItem dense disabled>
                No subtitles loaded.
              </MenuItem>
            )}
            {subtitles.embedded.map(
              ({ relation, sourceFile: file, track }, i) => (
                <EmbeddedTrackMenuItem
                  key={relation.id}
                  id={relation.id}
                  file={
                    file as
                      | (VttConvertedSubtitlesFile & {
                          parentType: 'MediaFile'
                        })
                      | null
                  }
                  track={track}
                  title={`Embedded track ${i + 1}`}
                  currentFileId={currentFileId}
                />
              )
            )}
            {subtitles.external.map(({ relation, sourceFile, track }, i) => (
              <ExternalTrackMenuItem
                key={relation.id}
                id={relation.id}
                track={track}
                file={sourceFile}
                title={sourceFile?.name || `External track ${i + 1}`}
                currentFileId={currentFileId}
              />
            ))}
            <Divider />
            <MenuItem
              dense
              onClick={loadExternalTrack}
              className={$.addTrackButton}
            >
              <ListItemText primary="Load external track" />
            </MenuItem>
            <MenuItem
              dense
              onClick={subtitlesClipsDialogRequest}
              id={$.makeClipsAndCardsButton}
            >
              <ListItemText primary="Generate clips + cards from subtitles" />
            </MenuItem>
          </MenuList>
        </Popover>
      )}
    </Fragment>
  )
}

const VisibilityIcon = ({ visible }: { visible: boolean }) => (
  <Icon>
    <Tooltip
      title={
        visible
          ? 'Hide subtitles track in video'
          : 'Show subtitles track in video'
      }
    >
      {visible ? (
        <VisibilityOnIcon fontSize="small" />
      ) : (
        <VisibilityOffIcon fontSize="small" />
      )}
    </Tooltip>
  </Icon>
)

const EmbeddedTrackMenuItem = ({
  id,
  file,
  track,
  title,
  currentFileId,
}: {
  id: string
  file: (VttConvertedSubtitlesFile & { parentType: 'MediaFile' }) | null
  track: EmbeddedSubtitlesTrack | null
  title: string
  currentFileId: MediaFileId | null
}) => {
  const { anchorEl, anchorCallbackRef, open, close, isOpen } = usePopover()
  const stopPropagation = useCallback((e) => {
    e.stopPropagation()
  }, [])

  const dispatch = useDispatch()
  const linkSubtitlesDialog = useLinkSubtitlesDialogAction(
    track,
    file,
    dispatch,
    currentFileId
  )

  return (
    <>
      <MenuItem
        dense
        onClick={useToggleVisible(track, id)}
        className={$.trackMenuItems}
        autoFocus
      >
        <ListItemIcon>
          {track ? (
            <VisibilityIcon visible={Boolean(track.mode === 'showing')} />
          ) : (
            <Tooltip title="Problem reading embedded subtitles">
              <FolderSpecial />
            </Tooltip>
          )}
        </ListItemIcon>
        <ListItemText
          className={css.subtitlesMenuListItemText}
          primary={title}
        />
        <Tooltip title="More actions">
          <ListItemSecondaryAction>
            <IconButton
              buttonRef={anchorCallbackRef}
              onClick={open}
              className={$.openTrackSubmenuButton}
            >
              <MoreVert />
            </IconButton>
          </ListItemSecondaryAction>
        </Tooltip>
        {isOpen && (
          <Menu
            autoFocus
            open={isOpen}
            onClose={close}
            anchorEl={anchorEl}
            onKeyDown={stopPropagation}
            onKeyPress={stopPropagation}
            onClick={stopPropagation}
          >
            <MenuItem
              dense
              onClick={linkSubtitlesDialog}
              disabled={!file}
              id={$.locateExternalFileButton}
            >
              <ListItemIcon>
                <Icon>
                  <Link />
                </Icon>
              </ListItemIcon>
              <ListItemText primary="Link track with flashcard field" />
            </MenuItem>
          </Menu>
        )}
      </MenuItem>
    </>
  )
}

const ExternalTrackMenuItem = ({
  id,
  file,
  track,
  title,
  currentFileId,
}: {
  id: SubtitlesTrackId
  file: ExternalSubtitlesFile | null
  track: ExternalSubtitlesTrack | null
  title: string
  currentFileId: string | null
}) => {
  const { anchorEl, anchorCallbackRef, open, close, isOpen } = usePopover()
  const dispatch = useDispatch()

  const deleteExternalSubtitles = useCallback(
    (e) => {
      dispatch(actions.deleteFileRequest('ExternalSubtitlesFile', id))
      close(e)
    },
    [dispatch, id, close]
  )

  const locateFileRequest = useCallback(
    (e) => {
      if (file) {
        dispatch(
          actions.locateFileRequest(
            file,
            `Locate "${file.name}" in your filesystem to use these subtitles.`
          )
        )

        close(e)
      }
    },
    [dispatch, file, close]
  )

  const linkSubtitlesDialog = useLinkSubtitlesDialogAction(
    track,
    file,
    dispatch,
    currentFileId
  )

  const toggleVisible = useToggleVisible(track, id)

  const stopPropagation = useCallback((e) => {
    e.stopPropagation()
  }, [])

  return (
    <MenuItem
      dense
      onClick={toggleVisible}
      disabled={!file}
      className={$.trackMenuItems}
    >
      <ListItemIcon>
        {track ? (
          <VisibilityIcon
            visible={Boolean(track && track.mode === 'showing')}
          />
        ) : (
          <Tooltip title="Not found in filesystem">
            <FolderSpecial />
          </Tooltip>
        )}
      </ListItemIcon>

      <ListItemText className={css.subtitlesMenuListItemText} primary={title} />

      <Tooltip title="More actions">
        <ListItemSecondaryAction>
          <IconButton
            buttonRef={anchorCallbackRef}
            onClick={open}
            className={$.openTrackSubmenuButton}
          >
            <MoreVert />
          </IconButton>
        </ListItemSecondaryAction>
      </Tooltip>
      {isOpen && (
        <Menu
          autoFocus
          open={isOpen}
          onClose={close}
          anchorEl={anchorEl}
          onKeyDown={stopPropagation}
          onKeyPress={stopPropagation}
          onClick={stopPropagation}
        >
          <MenuItem
            dense
            onClick={locateFileRequest}
            disabled={!file}
            id={$.locateExternalFileButton}
          >
            <ListItemIcon>
              <Icon>
                <FolderSpecial />
              </Icon>
            </ListItemIcon>
            <ListItemText primary="Locate subtitles file in filesystem" />
          </MenuItem>
          <MenuItem
            dense
            onClick={linkSubtitlesDialog}
            disabled={!file}
            id={$.locateExternalFileButton}
          >
            <ListItemIcon>
              <Icon>
                <Link />
              </Icon>
            </ListItemIcon>
            <ListItemText primary="Link track with flashcard field" />
          </MenuItem>
          <MenuItem
            dense
            disabled={!file}
            onClick={deleteExternalSubtitles}
            id={$.deleteTrackButton}
          >
            <ListItemIcon>
              <Icon>
                <DeleteIcon />
              </Icon>
            </ListItemIcon>
            <ListItemText primary="Remove subtitles track" />
          </MenuItem>
        </Menu>
      )}
    </MenuItem>
  )
}

function useLinkSubtitlesDialogAction(
  track: SubtitlesTrack | null,
  file: VttFromEmbeddedSubtitles | ExternalSubtitlesFile | null,
  dispatch: Function,
  currentFileId: string | null
) {
  const chunks = track?.chunks
  const linkSubtitlesDialog = useCallback(() => {
    if (file && currentFileId) {
      dispatch(actions.linkSubtitlesDialog(file, chunks || [], currentFileId))
    }
  }, [file, dispatch, chunks, currentFileId])
  return linkSubtitlesDialog
}

function useToggleVisible(track: SubtitlesTrack | null, id: string) {
  const dispatch = useDispatch()
  return useCallback(
    (_e) => {
      if (track)
        dispatch(
          track.mode === 'showing'
            ? actions.hideSubtitles(id)
            : actions.showSubtitles(id)
        )
    },
    [dispatch, id, track]
  )
}

export default SubtitlesMenu

export { $ as subtitlesMenu$ }
