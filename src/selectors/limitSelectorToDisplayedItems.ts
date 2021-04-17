import { pixelsToMs } from 'clipwave'

const MAX_WAVEFORM_VIEWPORT_WIDTH = 3000

export const limitSelectorToDisplayedItems = <T>(
  getStart: (item: T) => number,
  getEnd: (item: T) => number
) => (
  waveformItems: T[],
  waveformviewBoxStartMs: number,
  pixelsPerSecond: number
) => {
  const result: T[] = []
  const xMax =
    waveformviewBoxStartMs +
    pixelsToMs(MAX_WAVEFORM_VIEWPORT_WIDTH, pixelsPerSecond)
  for (const waveformItem of waveformItems) {
    const itemStart = getStart(waveformItem)
    if (itemStart > xMax) break

    const itemEnd = getEnd(waveformItem)
    // TODO: speed this up with binary search maybe?

    const overlap = itemStart <= xMax && itemEnd >= waveformviewBoxStartMs
    if (overlap) result.push(waveformItem)
  }
  return result
}
