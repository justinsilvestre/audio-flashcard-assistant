import React, { useCallback } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import {
  Button,
  IconButton,
  Tooltip,
  MenuItem,
  MenuList,
  ListItemText,
  Divider,
  Popover,
} from '@material-ui/core'
import { PlayArrow, Pause, Loop } from '@material-ui/icons'
import DarkTheme from './DarkTheme'
import MediaFilesMenuItem from './MediaFilesMenuItem'
import { showOpenDialog } from '../utils/electron'
import usePopover from '../utils/usePopover'
import truncate from '../utils/truncate'
import r from '../redux'
import { actions } from '../actions'
import css from './MainHeader.module.css'
import { getFileFilters } from '../utils/files'
import { getKeyboardShortcut } from './KeyboardShortcuts'
import { usePlayButtonSync } from 'clipwave'

enum $ {
  chooseFirstMediaFileButton = 'choose-media-file-button',
  openMediaFilesMenuButton = 'open-media-files-menu-button',
  mediaFileMenuItem = 'media-file-menu-item',
  addNewAdditionalMediaButton = 'add-new-additional-media-button',
}

type MediaFilesMenuProps = {
  className: string
  currentProjectId: ProjectId
  playButtonSync: ReturnType<typeof usePlayButtonSync>
}

const MediaFilesMenu = ({
  className,
  currentProjectId,
  playButtonSync: { playOrPauseAudio, playing },
}: MediaFilesMenuProps) => {
  const { currentFile, projectMediaFiles, loopIsOn: loopState } = useSelector(
    (state: AppState) => ({
      loopIsOn: r.getLoopState(state),
      currentFile: r.getCurrentMediaFile(state),
      projectMediaFiles: r.getCurrentProjectMediaFiles(state),
    })
  )
  const popover = usePopover()

  const dispatch = useDispatch()
  const chooseMediaFiles = useCallback(
    async (e) => {
      const filePaths = await showOpenDialog(getFileFilters('MediaFile'), true)
      if (filePaths) {
        dispatch(actions.addMediaToProjectRequest(currentProjectId, filePaths))
        popover.close(e)
      }
    },
    [dispatch, currentProjectId, popover]
  )

  const toggleLoop = useCallback(() => dispatch(actions.toggleLoop('BUTTON')), [
    dispatch,
  ])

  return (
    <DarkTheme>
      <section className={className} ref={popover.anchorCallbackRef}>
        {projectMediaFiles.length > 0 ? (
          <span
            className={css.mediaFileName}
            title={currentFile ? currentFile.name : undefined}
          >
            <Button
              className={css.audioButton}
              onClick={popover.open}
              id={$.openMediaFilesMenuButton}
            >
              {currentFile
                ? truncate(currentFile.name, 40)
                : 'Select media file'}
            </Button>
          </span>
        ) : (
          <Button id={$.chooseFirstMediaFileButton} onClick={chooseMediaFiles}>
            Add media
          </Button>
        )}
        {currentFile && (
          <Tooltip
            title={
              playing
                ? `Pause (${getKeyboardShortcut('Play/pause')})`
                : `Play (${getKeyboardShortcut('Play/pause')})`
            }
          >
            <IconButton onClick={playOrPauseAudio}>
              {playing ? <Pause /> : <PlayArrow />}
            </IconButton>
          </Tooltip>
        )}

        {currentFile && (
          <Tooltip
            title={`Loop selection (${getKeyboardShortcut('Toggle loop')})`}
          >
            <IconButton
              onClick={toggleLoop}
              color={loopState ? 'secondary' : 'default'}
            >
              <Loop />
            </IconButton>
          </Tooltip>
        )}
        {popover.isOpen && (
          <Popover
            anchorEl={popover.anchorEl}
            open={popover.isOpen}
            onClose={popover.close}
          >
            <MenuList>
              <div style={{ maxHeight: '30.5em', overflowY: 'auto' }}>
                {projectMediaFiles.map((media) => (
                  <MediaFilesMenuItem
                    key={media.id}
                    closeMenu={popover.close}
                    mediaFile={media}
                    autoFocus={Boolean(
                      currentFile && currentFile.id === media.id
                    )}
                    currentProjectId={currentProjectId}
                    className={$.mediaFileMenuItem}
                  />
                ))}
              </div>
              <Divider />
              <MenuItem
                dense
                tabIndex={0}
                onClick={chooseMediaFiles}
                id={$.addNewAdditionalMediaButton}
              >
                <ListItemText>Add new media</ListItemText>
              </MenuItem>
            </MenuList>
          </Popover>
        )}
      </section>
    </DarkTheme>
  )
}

export default MediaFilesMenu

export { $ as mediaFilesMenu$ }
