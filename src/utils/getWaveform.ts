import ffmpeg, { toTimestamp } from '../utils/ffmpeg'
import tempy from 'tempy'
import { existsSync } from 'fs'
import { getFileAvailabilityById } from '../selectors'
import { basename, join } from 'path'
import { secondsToMs } from 'clipwave'

const WAVE_COLOR = '#b7cee0'
const BG_COLOR = '#00000000'
const CORRECTION_OFFSET = 0

const WAVEFORM_PNG_PIXELS_PER_SECOND = 50

export const getWaveformPng = async (
  state: AppState,
  file: WaveformPng,
  mediaFilePath: string
): AsyncResult<string> => {
  try {
    const startX = WAVEFORM_PNG_PIXELS_PER_SECOND * file.startSeconds
    const endX = WAVEFORM_PNG_PIXELS_PER_SECOND * file.endSeconds
    const width = ~~(endX - startX)
    const outputFilename = getWaveformPngPath(state, mediaFilePath, file)
    if (outputFilename && existsSync(outputFilename))
      return { value: outputFilename }

    const newFileName: string = await new Promise((res, rej) => {
      return ffmpeg(mediaFilePath)
        .seekInput(toTimestamp(secondsToMs(file.startSeconds)))
        .inputOptions(`-to ${toTimestamp(secondsToMs(file.endSeconds))}`)
        .withNoVideo()
        .complexFilter(
          [
            `[0:a]aformat=channel_layouts=mono,`,
            `compand=gain=-6,`,
            `showwavespic=s=${
              width + CORRECTION_OFFSET
            }x70:colors=${WAVE_COLOR},setpts=0[fg];`,
            `color=s=${width + CORRECTION_OFFSET}x70:color=${BG_COLOR}[bg];`,
            `[bg][fg]overlay=format=rgb,drawbox=x=(iw-w)/2:y=(ih-h)/2:w=iw:h=2:color=${WAVE_COLOR}`,
          ].join(''),
          [] // why needed?
        )
        .outputOptions('-frames:v 1')
        .output(outputFilename)
        .on('end', function () {
          res(outputFilename)
        })
        .on('error', (err: any) => {
          rej(err)
        })
        .run()
    })

    if (!newFileName || !existsSync(newFileName))
      throw new Error('Problem creating waveform image')

    return { value: newFileName }
  } catch (err) {
    return { errors: [err] }
  }
}

const getWaveformPngPath = (
  state: AppState,
  mediaFilePath: string,
  file: WaveformPng
) => {
  const fileAvailability = getFileAvailabilityById(
    state,
    'WaveformPng',
    file.id
  )
  if (fileAvailability.filePath && existsSync(fileAvailability.filePath)) {
    return fileAvailability.filePath
  }
  return join(tempy.root, basename(mediaFilePath) + '_' + file.id + '.png')
}

export const getWaveformPngs = (mediaFile: MediaFile): WaveformPng[] => {
  const { durationSeconds } = mediaFile

  return getWaveformIds(mediaFile).map(
    (id, i): WaveformPng => ({
      type: 'WaveformPng',
      parentId: mediaFile.id,
      id,
      startSeconds: i * WAVEFORM_SEGMENT_LENGTH,
      endSeconds: Math.min(durationSeconds, (i + 1) * WAVEFORM_SEGMENT_LENGTH),
    })
  )
}
const WAVEFORM_SEGMENT_LENGTH = 5 * 60
// TODO: investigate why this produced an empty
//       second segment for pbc demo video when set to 2 minutes
function getWaveformId(mediaFileId: MediaFileId, i: number): string {
  return mediaFileId + '__' + i
}

export function getWaveformIds(mediaFile: MediaFile) {
  const { durationSeconds } = mediaFile
  const segmentsCount = Math.ceil(durationSeconds / WAVEFORM_SEGMENT_LENGTH)
  return [...Array(segmentsCount).keys()].map((index) =>
    getWaveformId(mediaFile.id, index)
  )
}
