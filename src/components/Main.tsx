import React, { useCallback, useMemo } from 'react'
import { useEffect, useRef } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { CircularProgress } from '@material-ui/core'
import { Redirect } from 'react-router-dom'
import cn from 'classnames'
import Media from '../components/Media'
import {
  Waveform,
  useWaveform,
  WaveformItem,
  sortWaveformItems,
  WaveformGestureOf,
  ClipDrag,
  msToSeconds,
  WaveformDrag,
  CLIP_THRESHOLD_MILLSECONDS,
  ClipStretch,
  recalculateRegions,
  usePlayButtonSync,
} from 'clipwave'
import FlashcardSection from '../components/FlashcardSection'
import Header from '../components/MainHeader'
import KeyboardShortcuts from '../components/KeyboardShortcuts'
import DarkTheme from '../components/DarkTheme'
import css from '../components/Main.module.css'
// import waveformCss from '../components/Waveform.module.css'
import * as r from '../selectors'
import { actions } from '../actions'
import { setMousePosition } from '../utils/mousePosition'
import 'clipwave/dist/index.css'
import { SubtitlesCardBase } from '../selectors'
import { bound } from '../utils/bound'
import { usePrevious } from '../utils/usePrevious'
import { uuid } from '../utils/sideEffects'
import { setCurrentTime } from '../utils/media'
// import { useWaveformSelectionSyncWithRedux } from './useWaveformSelectionSyncWithRedux'

enum $ {
  container = 'main-screen-container',
}

const Main = () => {
  const {
    loop,
    mediaIsEffectivelyLoading,
    currentProject,
    constantBitrateFilePath,
    currentMediaFile,
    subtitles,
    viewMode,
    clipsMap,
    waveformImages,
    subsBases,
  } = useSelector((state: AppState) => {
    const currentMediaFile = r.getCurrentMediaFile(state)
    return {
      loop: r.getLoopState(state),
      mediaIsEffectivelyLoading: r.isMediaEffectivelyLoading(state),
      currentProject: r.getCurrentProject(state),
      constantBitrateFilePath: r.getCurrentMediaConstantBitrateFilePath(state),
      currentMediaFile,
      clipsIdsForExport: currentMediaFile
        ? state.clips.idsByMediaFileId[currentMediaFile.id]
        : EMPTY,
      subtitles: r.getSubtitlesFilesWithTracks(state),
      viewMode: state.settings.viewMode,
      // waveformItems: r.getWaveformItems(state),
      waveformImages: r.getWaveformImages(state),
      clipsMap: r.getClipsObject(state),
      subsBases: r.getSubtitlesCardBases(state),
    }
  })

  const waveformImagesWithUrls = useMemo(() => {
    return waveformImages.map(
      ({ file: { startSeconds, endSeconds }, path }) => ({
        url: new URL(`file://${path}`).toString(),
        startSeconds,
        endSeconds,
      })
    )
  }, [waveformImages])

  const getWaveformItem = useCallback(
    (id: string): WaveformItem => {
      const clip: Clip | null = clipsMap[id] || null
      if (clip)
        return {
          clipwaveType: 'Primary',
          id: clip.id,
          start: clip.start,
          end: clip.end,
        }

      // const subsChunk: SubtitlesCardBase | null = subsBases.cards
      // if (!clip)
      throw new Error('could not find clip ' + id)
    },
    [clipsMap]
  )

  useEffect(() => {
    const trackCursor = (e: MouseEvent) => {
      setMousePosition([e.clientX, e.clientY])
    }
    document.addEventListener('mousemove', trackCursor)
    return () => document.removeEventListener('mousemove', trackCursor)
  }, [])

  const playerRef = useRef<HTMLVideoElement | HTMLAudioElement | null>(null)
  const waveform = useWaveform(getWaveformItem)
  const { onTimeUpdate } = waveform
  const { resetWaveformState } = waveform.actions

  const handleMediaLoaded = useCallback(
    (player: HTMLVideoElement | HTMLAudioElement | null) => {
      resetWaveformState(
        player,
        sortWaveformItems([...Object.values(clipsMap), ...subsBases.cards])
      )
    },
    [clipsMap, resetWaveformState, subsBases.cards]
  )
  // useWaveformSelectionSyncWithRedux(waveform, playerRef)
  usePlayButtonSync(waveform.state.pixelsPerSecond, playerRef)

  const dispatch = useDispatch()

  const { regions } = waveform.state
  const waveformActions = waveform.actions
  const { selectItem } = waveform.actions
  const { getItem } = waveform
  const { highlightedClipId } = useSelector((state: AppState) => {
    return {
      highlightedClipId: r.getHighlightedClipId(state),
    }
  })

  const previousSelection = usePrevious(waveform.state.selection)
  const { selection } = waveform.state
  useEffect(() => {
    if (selection !== previousSelection) {
      dispatch(
        actions.selectWaveformItem(
          selection ? { type: 'Clip', index: 0, id: selection.item.id } : null
        )
      )
    }
  }, [dispatch, previousSelection, selection])

  const handleWaveformDrag = useCallback(
    ({ gesture }: WaveformGestureOf<WaveformDrag>) => {
      const { start: startRaw, end: endRaw, overlaps } = gesture
      const left = Math.min(startRaw, endRaw)
      const right = Math.max(startRaw, endRaw)

      const tooSmallOrClipOverlapsExist =
        right - left < CLIP_THRESHOLD_MILLSECONDS ||
        overlaps.some((id) => getItem(id).clipwaveType === 'Primary')
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
    [dispatch, getItem, waveformActions]
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
          const item = getItem(id)
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
          move.overlaps.map((ol) => getItem(ol))
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

        const newRegions = recalculateRegions(regions, getItem, [
          {
            id: clipToMoveId,
            newItem: {
              ...getItem(clipToMoveId),
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

      const draggedClip = getItem(id)
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
          playerRef.current.currentTime = newTimeSeconds
        }
      }
    },
    [getItem, highlightedClipId, regions, dispatch, waveform, selectItem]
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
          ...getItem(stretch.clipId),
          [stretch.originKey]: stretch.end,
        }

        const overlaps = stretch.overlaps.flatMap((id) => {
          const item = getItem(id)
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
          stretch.overlaps.map((ol) => getItem(ol))
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
        const newRegions = recalculateRegions(regions, getItem, [
          {
            id: clipToStretchId,
            newItem: {
              ...getItem(clipToStretchId),
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
    [dispatch, getItem, regions, waveform]
  )

  if (!currentProject) return <Redirect to="/projects" />

  return (
    <div className={css.container} id={$.container}>
      <DarkTheme>
        <Header
          currentProjectId={currentProject.id}
          currentMediaFile={currentMediaFile}
          waveform={waveform}
          playerRef={playerRef}
        />
      </DarkTheme>

      <section
        className={cn(css.middle, {
          [css.horizontal]: viewMode === 'HORIZONTAL',
        })}
      >
        {mediaIsEffectivelyLoading ? (
          <div
            className={css.media}
            style={{ alignItems: 'center', margin: '2rem' }}
          >
            <CircularProgress variant="indeterminate" />
          </div>
        ) : (
          <Media
            key={String(constantBitrateFilePath)}
            className={css.media}
            constantBitrateFilePath={constantBitrateFilePath}
            loop={loop}
            metadata={currentMediaFile}
            subtitles={subtitles}
            viewMode={viewMode}
            playerRef={playerRef}
            onMediaLoaded={handleMediaLoaded}
            onTimeUpdate={onTimeUpdate}
          />
        )}

        <FlashcardSection
          mediaFile={currentMediaFile}
          className={css.flashcardSection}
          projectFile={currentProject}
        />
      </section>

      {currentMediaFile && !mediaIsEffectivelyLoading ? (
        <Waveform
          waveform={waveform}
          playerRef={playerRef}
          key={currentMediaFile.id}
          images={waveformImagesWithUrls}
          onWaveformDrag={handleWaveformDrag}
          onClipDrag={handleClipDrag}
          onClipEdgeDrag={handleClipEdgeDrag}
        />
      ) : (
        // <div className={waveformCss.waveformPlaceholder} />
        <div />
      )}

      <KeyboardShortcuts />
    </div>
  )
}

const EMPTY: string[] = []

export default Main

export { $ as main$ }
