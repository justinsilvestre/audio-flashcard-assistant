import { TestSetup, ASSETS_DIRECTORY } from '../../setUpDriver'
import { subtitlesMenu$ } from '../../../components/SubtitlesMenu'
import { fileSelectionForm$ } from '../../../components/Dialog/FileSelectionDialog'
import { mockElectronHelpers } from '../../../utils/electron/mocks'
import { join } from 'path'
import { waveformMouseDrag } from '../../driver/waveform'
import { flashcardSection$ } from '../../../components/FlashcardSection'

export default async function manuallyLocateAsset({ app, client }: TestSetup) {
  await client.clickElement_(subtitlesMenu$.openMenuButton)

  await client.clickElement_(subtitlesMenu$.openTrackSubmenuButton)

  await client.clickElement_(subtitlesMenu$.locateExternalFileButton)

  await mockElectronHelpers(app, {
    showOpenDialog: [Promise.resolve([join(ASSETS_DIRECTORY, 'pbc_jp.ass')])],
  })
  await client.waitForText_(fileSelectionForm$.container, 'pbc_jp.ass')
  await client.clickElement_(fileSelectionForm$.filePathField)
  await client.clickElement_(fileSelectionForm$.continueButton)

  await client.clickElement('body')
  await client.waitUntilGone_(subtitlesMenu$.trackMenuItems)

  await waveformMouseDrag(client, 591, 572)

  await client.waitForText_(flashcardSection$.container, 'ああー  吸わないで')
}
