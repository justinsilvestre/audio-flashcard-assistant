import React, { useCallback } from 'react'
import {
  useWaveform,
  WaveformGestureOf,
  ClipDrag,
  msToSeconds,
  WaveformDrag,
  CLIP_THRESHOLD_MILLSECONDS,
  ClipStretch,
  recalculateRegions,
  setCursorX,
  secondsToPixels,
} from 'clipwave'
import { actions } from '../actions'
import { bound } from '../utils/bound'
import { uuid } from '../utils/sideEffects'
import { setCurrentTime } from '../utils/media'
import { Dispatch } from 'redux'

export function useWaveformEventHandlers(
  playerRef: React.MutableRefObject<HTMLVideoElement | HTMLAudioElement | null>,
  dispatch: Dispatch<Action>,
  waveform: ReturnType<typeof useWaveform>,
  highlightedClipId: string | null
) {
  const {
    getItemDangerously,
    actions: waveformActions,
    state: { regions },
  } = waveform
  const { selectItem } = waveformActions
  const handleWaveformDrag = useCallback(
    ({ gesture }: WaveformGestureOf<WaveformDrag>) => {
      const { start: startRaw, end: endRaw, overlaps } = gesture
      const left = Math.min(startRaw, endRaw)
      const right = Math.max(startRaw, endRaw)

      const tooSmallOrClipOverlapsExist =
        right - left < CLIP_THRESHOLD_MILLSECONDS ||
        overlaps.some((id) => getItemDangerously(id).clipwaveType === 'Primary')
      if (tooSmallOrClipOverlapsExist) {
        if (playerRef.current) {
          playerRef.current.currentTime = msToSeconds(endRaw)
        }
        return
      }

      const newId = uuid()

      dispatch(actions.addClipRequest(gesture, newId))

      waveformActions.addItem({
        start: left,
        end: right,
        clipwaveType: 'Primary',
        id: newId,
      })

      if (playerRef.current) {
        playerRef.current.currentTime = msToSeconds(left)
      }

      // setTimeout(() => {
      //   const button: HTMLTextAreaElement | null = document.querySelector(
      //     `#${getCaptionArticleId(id)} button`
      //   );
      //   button?.click();
      // }, 0);
    },
    [dispatch, getItemDangerously, playerRef, waveformActions]
  )

  const MOVE_START_DELAY = 400
  const handleClipDrag = useCallback(
    ({ gesture: move, mouseDown, timeStamp }: WaveformGestureOf<ClipDrag>) => {
      const moveImminent = timeStamp - mouseDown.timeStamp >= MOVE_START_DELAY
      if (moveImminent) {
        // const deltaX = move.start - move.end
        const deltaX = move.end - move.start

        const offsetStart = move.clip.start + deltaX
        const offsetEnd = move.clip.end + deltaX

        const clipToMoveId = move.clip.id
        console.log('overlaps', move.overlaps)

        const overlaps = move.overlaps.flatMap((id) => {
          const item = getItemDangerously(id)
          const { start, end } = item
          // id check not ncessary in 0.1.3
          return item.clipwaveType === 'Primary' &&
            start <= offsetEnd &&
            end >= offsetStart
            ? [item]
            : []
        })
        console.log(
          { overlaps },
          move.overlaps.map((ol) => getItemDangerously(ol))
        )
        const overlapIds = overlaps.map((c) => c.id)

        setCurrentTime(
          msToSeconds(Math.min(offsetStart, ...overlaps.map((c) => c.start)))
        )

        const toMerge = [
          { id: clipToMoveId, start: offsetStart, end: offsetEnd },
          ...overlaps,
        ].sort((a, b) => a.start - b.start)

        const newStartWithMerges = Math.min(...toMerge.map((c) => c.start))
        const newEndWithMerges = Math.max(...toMerge.map((c) => c.end))

        const newRegions = recalculateRegions(regions, getItemDangerously, [
          {
            id: clipToMoveId,
            newItem: {
              ...getItemDangerously(clipToMoveId),
              id: clipToMoveId,
              start: newStartWithMerges,
              end: newEndWithMerges,
            },
          },
          ...overlapIds.map((id) => ({ id, newItem: null })),
        ])
        console.log('newRegions', newRegions)

        waveform.dispatch({
          type: 'SET_REGIONS',
          regions: newRegions,
        })
        dispatch(actions.moveClip(clipToMoveId, deltaX, overlapIds))
      }

      const { regionIndex, start, end } = move
      const deltaX = end - start
      const { id } = move.clip

      const draggedClip = getItemDangerously(id)
      const isHighlighted = draggedClip.id === highlightedClipId
      const region = regions[regionIndex]
      if (!isHighlighted) {
        selectItem(region, draggedClip)
      }

      if (playerRef.current) {
        const clipStart = moveImminent
          ? draggedClip.start + deltaX
          : draggedClip.start
        const newTimeSeconds =
          !isHighlighted || moveImminent
            ? bound(msToSeconds(clipStart), [0, waveform.state.durationSeconds])
            : msToSeconds(end)
        if (playerRef.current.currentTime !== newTimeSeconds) {
          waveform.selectionDoesntNeedSetAtNextTimeUpdate.current = true
          setCursorX(
            secondsToPixels(newTimeSeconds, waveform.state.pixelsPerSecond)
          )
          setCurrentTime(newTimeSeconds)
        }
      }
    },
    [
      getItemDangerously,
      highlightedClipId,
      regions,
      playerRef,
      waveform,
      dispatch,
      selectItem,
    ]
  )

  // TODO: set time after stretch
  const STRETCH_START_DELAY = 100
  const handleClipEdgeDrag = useCallback(
    ({
      gesture: stretch,
      mouseDown,
      timeStamp,
    }: WaveformGestureOf<ClipStretch>) => {
      if (timeStamp - mouseDown.timeStamp > STRETCH_START_DELAY) {
        const stretchedClip = {
          ...getItemDangerously(stretch.clipId),
          [stretch.originKey]: stretch.end,
        }

        const overlaps = stretch.overlaps.flatMap((id) => {
          const item = getItemDangerously(id)
          const { start, end } = item
          // id check not ncessary in 0.1.3
          return item.clipwaveType === 'Primary' &&
            start <= stretchedClip.end &&
            end >= stretchedClip.start
            ? [item]
            : []
        })
        console.log(
          { overlaps },
          stretch.overlaps.map((ol) => getItemDangerously(ol))
        )
        const overlapIds = overlaps.map((c) => c.id)

        const newStartWithMerges = Math.min(
          ...[stretchedClip, ...overlaps].map((i) => i.start)
        )
        const newEndWithMerges = Math.max(
          ...[stretchedClip, ...overlaps].map((i) => i.end)
        )

        // change regions
        // stretch in knowclip
        const clipToStretchId = stretch.clipId
        const newRegions = recalculateRegions(regions, getItemDangerously, [
          {
            id: clipToStretchId,
            newItem: {
              ...getItemDangerously(clipToStretchId),
              id: clipToStretchId,
              start: newStartWithMerges,
              end: newEndWithMerges,
            },
          },
          ...overlapIds.map((id) => ({ id, newItem: null })),
        ])
        waveform.dispatch({
          type: 'SET_REGIONS',
          regions: newRegions,
        })
        dispatch(actions.stretchClip(stretchedClip, overlapIds))
      } else {
      }
    },
    [dispatch, getItemDangerously, regions, waveform]
  )
  return { handleWaveformDrag, handleClipDrag, handleClipEdgeDrag }
}
