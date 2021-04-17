import {
  mergeMap,
  map,
  filter,
  mergeAll,
  switchMap,
  catchError,
} from 'rxjs/operators'
import { of, from, EMPTY } from 'rxjs'
import { ofType, combineEpics } from 'redux-observable'
import A from '../types/ActionType'
import r from '../redux'
import { parseProjectJson, normalizeProjectJson } from '../utils/parseProject'
import './setYamlOptions'
import { getUpdateWith } from '../files/updates'

const createProject: AppEpic = (action$, state$, { writeFile }) =>
  action$.ofType<CreateProject>(A.createProject).pipe(
    switchMap(({ project, filePath }) => {
      return from(
        writeFile(filePath, r.getProjectFileContents(state$.value, project))
      ).pipe(
        mergeMap(() =>
          from([
            r.openFileRequest(project, filePath),
            r.setWorkIsUnsaved(false),
          ])
        )
      )
    }),
    catchError((err) =>
      of(
        r.simpleMessageSnackbar(
          'Error creating project file: ' + err.toString()
        )
      )
    )
  )

const openProjectById: AppEpic = (action$, state$, { existsSync }) =>
  action$.pipe(
    ofType<Action, OpenProjectRequestById>(A.openProjectRequestById),
    map(({ id }) => {
      const project = r.getFileAvailabilityById<ProjectFile>(
        state$.value,
        'ProjectFile',
        id
      )
      if (!project.filePath || !existsSync(project.filePath)) {
        const projectFile = r.getFile<ProjectFile>(
          state$.value,
          'ProjectFile',
          id
        )

        return projectFile
          ? r.locateFileRequest(
              projectFile,
              'This project was either moved or renamed.'
            )
          : r.simpleMessageSnackbar(`Could not open project.`)
      }
      return r.openProjectRequestByFilePath(project.filePath)
    })
  )

const openProjectByFilePath: AppEpic = (action$, state$) =>
  action$.pipe(
    ofType<Action, OpenProjectRequestByFilePath>(
      A.openProjectRequestByFilePath
    ),
    switchMap(({ filePath }) =>
      from(parseProjectJson(filePath)).pipe(
        mergeMap((parse) => {
          if (parse.errors) throw new Error(parse.errors.join('\n\n'))

          const { project } = normalizeProjectJson(state$.value, parse.value)
          return from([
            r.abortFileDeletions(),
            r.openFileRequest(project, filePath),
          ])
        }),
        catchError((err) =>
          of(r.errorDialog('Problem opening project file:', err.message))
        )
      )
    )
  )

const saveProject: AppEpic = (action$, state$, { existsSync, writeFile }) =>
  action$.pipe(
    ofType<Action, SaveProjectRequest>(A.saveProjectRequest),
    filter(() => {
      const projectMetadata = r.getCurrentProject(state$.value)
      if (!projectMetadata)
        return Boolean({ type: 'NOOP_SAVE_PROJECT_WITH_NONE_OPEN' })
      const projectFile = r.getFileAvailabilityById(
        state$.value,
        'ProjectFile',
        projectMetadata.id
      )
      return Boolean(
        projectFile && projectFile.filePath && existsSync(projectFile.filePath)
      )
    }), // while can't find project file path in storage, or file doesn't exist
    mergeMap(async () => {
      try {
        const projectMetadata = r.getCurrentProject(state$.value)
        if (!projectMetadata) throw new Error('Could not find project metadata')

        const projectFile = r.getFileAvailabilityById(
          state$.value,
          'ProjectFile',
          projectMetadata.id
        ) as CurrentlyLoadedFile

        await writeFile(
          projectFile.filePath,
          r.getProjectFileContents(state$.value, projectMetadata)
        )

        return from([
          r.setWorkIsUnsaved(false),
          r.commitFileDeletions(),
          r.simpleMessageSnackbar(
            `Project saved in ${projectFile.filePath}`,
            5000
          ),
        ])
      } catch (err) {
        console.error(err)
        return of(
          r.simpleMessageSnackbar(`Problem saving project file: ${err.message}`)
        )
      }
    }),
    mergeAll()
  )

const PROJECT_EDIT_ACTIONS = new Set<Action['type']>([
  A.deleteCard,
  A.makeClipsFromSubtitles,
  A.deleteCards,
  A.setFlashcardField,
  A.addFlashcardTag,
  A.deleteFlashcardTag,
  A.editClip,
  A.stretchClip,
  A.addClip,
  A.addClips,
  A.mergeClips,
  A.addMediaToProjectRequest,
])
const PROJECT_EDIT_UPDATE_FILE_ACTIONS: Set<keyof FileUpdates> = new Set([
  'deleteProjectMedia',
  'linkFlashcardFieldToSubtitlesTrack',
  'setProjectName',
])

const registerUnsavedWork: AppEpic = (action$, state$) =>
  action$.pipe(
    filter((action) => {
      return (
        (PROJECT_EDIT_ACTIONS.has(action.type) ||
          (action.type === A.updateFile &&
            PROJECT_EDIT_UPDATE_FILE_ACTIONS.has(action.update.updateName))) &&
        Boolean(r.getCurrentProjectId(state$.value))
      )
    }),
    map(() => r.setWorkIsUnsaved(true))
  )

const deleteMediaFileFromProject: AppEpic = (action$, state$) =>
  action$.pipe(
    mergeMap((action) => {
      if (action.type !== 'updateFile') return EMPTY
      const update = getUpdateWith(action.update, 'deleteProjectMedia')
      if (!update) return EMPTY

      const {
        updatePayload: [mediaFileId],
      } = update
      const file = r.getFile(state$.value, 'MediaFile', mediaFileId)
      return file ? of(r.deleteFileRequest(file.type, file.id)) : EMPTY
    })
  )

const closeProjectRequest: AppEpic = (action$, state$, effects) =>
  action$.pipe(
    ofType(A.closeProjectRequest),
    map(() => {
      if (r.isWorkUnsaved(state$.value))
        return r.confirmationDialog(
          'Are you sure you want to close this project without saving your work?',
          r.closeProject()
        )
      else {
        effects.sendToMainProcess({
          type: 'setAppMenuProjectSubmenuPermissions',
          args: [false],
        })

        return r.closeProject()
      }
    })
  )

export default combineEpics(
  createProject,
  openProjectByFilePath,
  openProjectById,
  saveProject,
  registerUnsavedWork,
  // autoSaveProject,
  deleteMediaFileFromProject,
  closeProjectRequest
)
