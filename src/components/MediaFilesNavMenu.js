import React, { Fragment, useCallback, useState, useRef } from 'react'
import { connect } from 'react-redux'
import {
  Button,
  IconButton,
  Tooltip,
  Menu,
  MenuItem,
  MenuList,
  ListItemText,
  ListItemSecondaryAction,
  Divider,
  Popover,
} from '@material-ui/core'
import { Loop, Delete as DeleteIcon } from '@material-ui/icons'
import DarkTheme from './DarkTheme'
import { showOpenDialog } from '../utils/electron'
import truncate from '../utils/truncate'
import * as r from '../redux'
import css from './Header.module.css'

const CONFIRM_DELETE_MEDIA_FROM_PROJECT_MESSAGE =
  'Are you sure you want to remove this media file? This action will delete any flashcards you might have made with it.'

const MediaFilesNavMenu = ({
  className,
  toggleLoop,
  currentFileName,
  currentFileId,
  loop,
  addMediaToProjectRequest,
  currentProjectId,
  projectMediaMetadata,
  openMediaFileRequest,
  confirmationDialog,
  deleteMediaFromProjectRequest,
}) => {
  const chooseMediaFiles = useCallback(
    async () => {
      const filters = [{ name: 'Audio or video files' }]
      const filePaths = await showOpenDialog(filters, true)
      if (filePaths) addMediaToProjectRequest(currentProjectId, filePaths)
    },
    [addMediaToProjectRequest, currentProjectId]
  )

  const menuAnchorEl = useRef(null)
  const [menuIsOpen, setMenuIsOpen] = useState(false)
  const openMenu = e => setMenuIsOpen(true)
  const closeMenu = e => setMenuIsOpen(false)

  return (
    <DarkTheme>
      <section className={className} ref={menuAnchorEl}>
        {projectMediaMetadata.length > 0 ? (
          <span className="mediaFileName" title={currentFileName}>
            <Button className={css.audioButton} onClick={openMenu}>
              {currentFileName ? truncate(currentFileName, 40) : 'Select media'}
            </Button>

            {menuIsOpen && (
              <Popover
                anchorEl={menuAnchorEl.current}
                open={menuIsOpen}
                onClose={closeMenu}
                // PaperProps={{
                //   style: {
                //     maxHeight: '40em',
                //   },
                // }}
              >
                <MenuList style={{ maxHeight: '40em', overflowY: 'auto' }}>
                  {projectMediaMetadata.map(({ name, id }) => (
                    <MenuItem
                      dense
                      key={id}
                      selected={id === currentFileId}
                      onClick={() => openMediaFileRequest(id)}
                    >
                      <ListItemText
                        title={name}
                        className={css.mediaFilesMenuListItemText}
                      >
                        {truncate(name, 40)}
                      </ListItemText>
                      <ListItemSecondaryAction>
                        <IconButton
                          onClick={() =>
                            confirmationDialog(
                              CONFIRM_DELETE_MEDIA_FROM_PROJECT_MESSAGE,
                              r.deleteMediaFromProjectRequest(
                                currentProjectId,
                                id
                              )
                            )
                          }
                        >
                          <DeleteIcon />
                        </IconButton>
                      </ListItemSecondaryAction>
                    </MenuItem>
                  ))}
                </MenuList>
                <Divider />
                <MenuItem dense>
                  <ListItemText onClick={chooseMediaFiles}>
                    Add new media
                  </ListItemText>
                </MenuItem>
              </Popover>
            )}
          </span>
        ) : (
          <Button onClick={chooseMediaFiles}>Choose source file</Button>
        )}
        <Tooltip title="Loop audio (Ctrl + L)">
          <IconButton onClick={toggleLoop} color={loop ? 'primary' : 'default'}>
            <Loop />
          </IconButton>
        </Tooltip>{' '}
      </section>
    </DarkTheme>
  )
}

const mapStateToProps = state => ({
  loop: r.isLoopOn(state),
  currentFileName: r.getCurrentFileName(state),
  currentFileId: r.getCurrentFileId(state),
  currentProjectId: r.getCurrentProjectId(state),
  projectMediaMetadata: r.getProjectMediaMetadata(
    state,
    r.getCurrentProjectId(state)
  ),
})

const mapDispatchToProps = {
  toggleLoop: r.toggleLoop,
  addMediaToProjectRequest: r.addMediaToProjectRequest,
  openMediaFileRequest: r.openMediaFileRequest,
  deleteMediaFromProjectRequest: r.deleteMediaFromProjectRequest,
  confirmationDialog: r.confirmationDialog,
}

export default connect(
  mapStateToProps,
  mapDispatchToProps
)(MediaFilesNavMenu)
