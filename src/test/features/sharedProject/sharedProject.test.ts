import { startApp, stopApp, TestSetup } from '../../setUpDriver'
import openSharedProject from './openSharedProject'
import navigateBetweenMedia from './navigateBetweenMedia'
import makeFlashcards from './makeFlashcards'
import makeFlashcardsWithSubtitles from './makeFlashcardsWithSubtitles'
import manuallyLocateAsset from './manuallyLocateAsset'
import reviewWithMissingMedia from './reviewWithMissingMedia'
import exportWithMissingMedia from './exportWithMissingMedia'
import saveAndCloseProject from './saveAndCloseProject'
import { mockSideEffects } from '../../../utils/sideEffects'
import { TestDriver } from '../../driver/TestDriver'
import { runAll, step } from '../step'

jest.setTimeout(60000)

const testId = 'sharedProject'

describe('opening a shared project', () => {
  let context: { app: TestDriver | null; testId: string } = {
    app: null,
    testId,
  }
  let setup: TestSetup

  beforeAll(async () => {
    setup = await startApp(context)

    // if (context.app) {
    //   console.log('logging process.env')
    //   console.log('process.env:', process.env)

    //   console.log('logging window location')
    //   console.log(
    //     'window location:',
    //     await context.app.client.execute(() => {
    //       return window.location
    //     })
    //   )
    //   console.log('logging window process.env')
    //   console.log(
    //     'window process.env:',
    //     await context.app.client.execute(() => {
    //       return process.env
    //     })
    //   )
    // } else {
    //   throw new Error('Problem starting app')
    // }

    await mockSideEffects(setup.app, sideEffectsMocks)
  })

  runAll(sharedProjectTestSteps(), () => setup)
  test('save and close project', () => saveAndCloseProject(setup))

  afterAll(async () => {
    await stopApp(context)
  })
})

function sharedProjectTestSteps() {
  return [
    step(
      'open a shared project and locates media in local filesystem',
      openSharedProject
    ),
    step('navigate between as-of-yet unloaded media', navigateBetweenMedia),
    step('make some flashcards', makeFlashcards),
    step('make some flashcards using subtitles', makeFlashcardsWithSubtitles),
    step('manually locate missing assets', manuallyLocateAsset),
    step('review with missing media', reviewWithMissingMedia),
    step('export deck with missing media', exportWithMissingMedia),
  ]
}

const sideEffectsMocks = {
  uuid: [
    '64bc9fe8-822a-4ecf-83d9-d6997029db7d',
    'b9ba2184-cb5c-4d50-98c2-568bf8e75854',
  ],
  nowUtcTimestamp: [
    '2020-01-24T15:09:02Z',
    '2020-01-24T15:09:03Z',
    '2020-01-24T15:09:18Z',
    '2020-02-02T15:26:22Z',
    '2020-02-02T15:26:22Z',
    '2020-02-02T15:26:24Z',
    '2020-02-02T15:26:24Z',
    '2020-02-02T15:26:24Z',
    '2020-02-02T15:26:26Z',
    '2020-02-02T15:26:28Z',
    '2020-02-02T15:26:29Z',
    '2020-02-02T15:26:29Z',
    '2020-02-02T15:26:30Z',
    '2020-02-02T15:26:34Z',
    '2020-02-02T15:26:34Z',
    '2020-02-02T15:26:39Z',
    '2020-02-02T15:26:39Z',
    '2020-02-02T15:26:39Z',
    '2020-02-02T15:26:39Z',
    '2020-02-02T15:26:39Z',
    '2020-02-02T15:26:39Z',
  ],
}
