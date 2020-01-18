import { Application, SpectronClient } from 'spectron'
import { join } from 'path'
import { testLabels as projectsMenu } from '../../components/ProjectsMenu'
import { testLabels as newProjectForm } from '../../components/Dialog/NewProjectFormDialog'
import { testLabels as main } from '../../components/Main'
import { testLabels as mediaFilesMenu } from '../../components/MediaFilesNavMenu'
import { testLabels as flashcardSection } from '../../components/FlashcardSection'
import { testLabels as tagsInput } from '../../components/TagsInput'
import { testLabels as projectMenu } from '../../components/ProjectMenu'
import {
  startApp,
  stopApp,
  mockElectronHelpers,
  _,
  TestSetup,
  TMP_DIRECTORY,
  MEDIA_DIRECTORY,
} from '../setup'
import { RawResult, Element } from 'webdriverio'
import { mkdirp, remove, existsSync } from 'fs-extra'
// import { remove, copy } from 'fs-extra'

jest.setTimeout(60000)

describe('create a deck from a new project', () => {
  let context: { app: Application | null } = { app: null }
  let setup: TestSetup

  beforeAll(async () => {
    if (existsSync(TMP_DIRECTORY)) await remove(TMP_DIRECTORY)
    await mkdirp(TMP_DIRECTORY)
    // await copy(join(__dirname, 'fixtures'), TMP_DIRECTORY)
    setup = await startApp(context)
  })

  it('create a new project', async () => createNewProject(setup))
  it('change project name', async () => changeProjectName(setup))
  it('add media to project', async () => addJapaneseMedia(setup))
  it('create flashcards', async () => makeTwoFlashcards(setup))

  afterAll(async () => {
    await mockElectronHelpers(setup.app, {
      showMessageBox: Promise.resolve({
        response: 0,
        checkboxChecked: false,
      }),
    })
    await stopApp(context)
  })
})

describe('second test', () => {
  let context: { app: Application | null } = { app: null }
  let setup: TestSetup

  beforeAll(async () => {
    if (existsSync(TMP_DIRECTORY)) await remove(TMP_DIRECTORY)
    await mkdirp(TMP_DIRECTORY)
    // await copy(join(__dirname, 'fixtures'), TMP_DIRECTORY)
    setup = await startApp(context)
  })

  it('create a new project', async () => createNewProject(setup))
  it('change project name', async () => changeProjectName(setup))
  it('add media to project', async () => addJapaneseMedia(setup))
  it('create flashcards', async () => makeTwoFlashcards(setup))

  afterAll(async () => {
    await mockElectronHelpers(setup.app, {
      showMessageBox: Promise.resolve({
        response: 0,
        checkboxChecked: false,
      }),
    })
    await stopApp(context)
  })
})

async function changeProjectName({ $, client, app }: TestSetup) {
  expect(await $(projectMenu.projectTitle).getText()).toContain(
    'My cool poject'
  )
  await $(projectMenu.projectTitle).doubleClick()
  await $(projectMenu.projectTitleInput).doubleClick()
  await $(projectMenu.projectTitleInput).keys([
    ...[...Array(10)].map(() => 'Backspace'),
    ...'My cool project',
  ])
  await $(projectMenu.projectTitleInput).submitForm()
  await client.waitForExist(_(projectMenu.projectTitle))
  expect(await $(projectMenu.projectTitle).getText()).toContain(
    'My cool project'
  )
}

async function makeTwoFlashcards({ app, $, $$, client }: TestSetup) {
  const mouseDragEvents = getMouseDragEvents([402, 422], [625, 422])
  await runEvents(app, mouseDragEvents)
  await client.waitForExist(_(flashcardSection.flashcardField))
  await fillInFlashcardFields(
    await $$(flashcardSection.flashcardField),
    client,
    {
      transcription: '笹を食べながらのんびりするのは最高だなぁ',
      pronunciation: 'sasa-o tabe-nágara nonbíri-suru-no-wa saikoo-da-naa',
      meaning: 'Lying around while eating bamboo grass is the best',
    }
  )
  await $(tagsInput.tagsInput)
    .$('svg')
    .click()
  await $(tagsInput.tagsInput).click()
  await $(tagsInput.tagsInput)
    .$('input')
    .setValue('pbc')
  await $(tagsInput.tagsInput)
    .$('input')
    .keys(['Enter'])
  await runEvents(app, getMouseDragEvents([756, 422], [920, 422]))
  expect(await app.client.$$(`.${tagsInput.tagsInput} svg`)).toHaveLength(1)
  expect(await $(tagsInput.tagsInput).getText()).toContain('pbc')
  await fillInFlashcardFields(
    await $$(flashcardSection.flashcardField),
    client,
    {
      transcription: 'またこの子は昼間からゴロゴロして',
      pronunciation: 'mata kono ko-wa hiruma-kara goro-goro shite',
      meaning: 'This kid, lazing about again so early',
      notes: '"Goro-goro" is the sound of something big rolling around.',
    }
  )
}

async function fillInFlashcardFields(
  elements: RawResult<Element>[],
  client: SpectronClient,
  {
    transcription,
    pronunciation,
    meaning,
    notes,
  }: Partial<TransliterationFlashcardFields>
) {
  const [transcriptionId, pronunciationId, meaningId, notesId] = elements.map(
    el => el.value.ELEMENT
  )
  if (transcription) await client.elementIdValue(transcriptionId, transcription)
  if (pronunciation) await client.elementIdValue(pronunciationId, pronunciation)
  if (meaning) await client.elementIdValue(meaningId, meaning)
  if (notes) await client.elementIdValue(notesId, notes)
}

async function runEvents(app: Application, [next, ...rest]: any[]) {
  if (next) {
    await app.webContents.sendInputEvent(next)
    await runEvents(app, rest)
  }
}
function getMouseDragEvents(
  [fromX, fromY]: [number, number],
  [toX, toY]: [number, number]
) {
  return [
    {
      type: 'mouseDown',
      x: fromX,
      y: fromY,
    },
    {
      type: 'mouseMove',
      x: ~~((toX + fromX) / 2),
      y: ~~((toY + fromY) / 2),
    },
    {
      type: 'mouseMove',
      x: toX,
      y: toY,
    },
    {
      type: 'mouseUp',
      x: toX,
      y: toY,
    },
  ]
}

async function addJapaneseMedia(setup: TestSetup) {
  const { app, client, $ } = setup
  const { mediaFilesNavMenuButton } = main
  const japaneseVideoPath = join(MEDIA_DIRECTORY, 'japanese.mp4')
  await mockElectronHelpers(app, {
    showOpenDialog: Promise.resolve([japaneseVideoPath]),
  })
  await $(mediaFilesNavMenuButton).click()
  await client.waitUntilTextExists('body', 'japanese.mp4')
  const video = $('audioPlayer')
  expect(await video.getAttribute('src')).toContain(japaneseVideoPath)
}

async function createNewProject({ app, client, $ }: TestSetup) {
  $(projectsMenu.newProjectButton).click()

  await mockElectronHelpers(app, {
    showSaveDialog: Promise.resolve(
      join(TMP_DIRECTORY, 'my_cool_project.afca')
    ),
  })
  const {
    projectNameField,
    projectFileLocationField,
    noteTypeSelect,
    transcriptionNoteTypeOption,
    saveButton,
    cardsPreview,
  } = newProjectForm

  await client.waitForExist(_(projectNameField))
  await $(projectNameField).setValue('My cool poject')

  $(projectFileLocationField).click()

  $(noteTypeSelect).click()
  await client.waitForExist(_(transcriptionNoteTypeOption))
  await $(transcriptionNoteTypeOption).click()

  await client.waitForExist(_(cardsPreview))

  await app.client.waitUntil(
    async () =>
      !(await app.client.isExisting(
        _(newProjectForm.transcriptionNoteTypeOption)
      ))
  )

  await $(saveButton).click()

  await client.waitForExist(_(main.mediaFilesNavMenuButton))
}