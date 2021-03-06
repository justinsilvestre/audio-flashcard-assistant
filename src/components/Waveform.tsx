import React, {
  useRef,
  useCallback,
  useMemo,
  EventHandler,
  MutableRefObject,
  useEffect,
} from 'react'
import cn from 'classnames'
import { useSelector, useDispatch } from 'react-redux'
import r from '../redux'
import css from './Waveform.module.css'
import { waveformTimeAtMousePosition } from '../utils/waveformCoordinates'
import WaveformMousedownEvent, {
  WaveformDragAction,
  WaveformDragEvent,
} from '../utils/WaveformMousedownEvent'
import {
  msToPixels,
  msToSeconds,
  secondsToMs,
  secondsToPixels,
  SELECTION_BORDER_MILLISECONDS,
  setCursorX,
  SUBTITLES_CHUNK_HEIGHT,
  WAVEFORM_HEIGHT,
} from '../utils/waveform'
import { SubtitlesTimelines } from './WaveformSubtitlesTimelines'
import { Clips } from './WaveformClips'
import { useWaveform, WaveformAction } from './useWaveform'
import { limitSelectorToDisplayedItems } from '../selectors/limitSelectorToDisplayedItems'
import { elementWidth } from '../utils/media'
import { SubtitlesCardBase } from '../selectors'

export enum $ {
  container = 'waveform-container',
  subtitlesTimelinesContainer = 'subtitles-timelines-container',
  subtitlesTimelines = 'subtitles-timeline',
  waveformClipsContainer = 'waveform-clips-container',
  waveformClip = 'waveform-clip',
}

const Cursor = ({
  x,
  height,
  strokeWidth,
}: {
  x: number
  height: number
  strokeWidth: number
}) => (
  <line
    className="cursor"
    stroke="white"
    x1={x}
    y1="-1"
    x2={x}
    y2={height}
    shapeRendering="crispEdges"
    strokeWidth={strokeWidth}
    style={{ pointerEvents: 'none' }}
  />
)
const getViewBoxString = (xMin: number, height: number) =>
  `${xMin} 0 ${3000} ${height}`

const limitSubtitlesCardsBasesCardsToDisplayed = limitSelectorToDisplayedItems(
  (cb: SubtitlesCardBase) => cb.start,
  (cb: SubtitlesCardBase) => cb.end
)

const Waveform = ({
  playerRef,
  waveform,
}: {
  playerRef: MutableRefObject<HTMLVideoElement | HTMLAudioElement | null>
  waveform: ReturnType<typeof useWaveform>
}) => {
  const {
    images,
    clips,
    highlightedClipId,
    allSubtitles,
    highlightedChunkIndex,
    mediaIsLoaded,
  } = useSelector((state: AppState) => ({
    images: r.getWaveformImages(state),
    clips: r.getCurrentFileClips(state),
    highlightedClipId: r.getHighlightedClipId(state),
    allSubtitles: r.getSubtitlesCardBases(state),
    highlightedChunkIndex: r.getHighlightedChunkIndex(state),
    mediaIsLoaded: r.isMediaFileLoaded(state),
  }))

  const {
    state: waveformState,
    dispatch: dispatchViewState,
    svgRef,
    visibleWaveformItems,
  } = waveform

  const dispatch = useDispatch()
  const goToSubtitlesChunk = useCallback(
    (trackId: string, chunkIndex: number) => {
      dispatch(r.goToSubtitlesChunk(trackId, chunkIndex))
    },
    [dispatch]
  )

  const { viewBoxStartMs, pixelsPerSecond } = waveformState
  const subtitles = useMemo(() => {
    return {
      ...allSubtitles,
      cards: limitSubtitlesCardsBasesCardsToDisplayed(
        allSubtitles.cards,
        viewBoxStartMs,
        pixelsPerSecond
      ),
    }
  }, [allSubtitles, pixelsPerSecond, viewBoxStartMs])

  const height =
    WAVEFORM_HEIGHT + subtitles.totalTracksCount * SUBTITLES_CHUNK_HEIGHT
  const viewBoxString = getViewBoxString(
    msToPixels(viewBoxStartMs, pixelsPerSecond),
    height
  )

  const { handleMouseDown, pendingActionRef } = useWaveformMouseActions(
    svgRef,
    waveformState,
    pixelsPerSecond,
    playerRef,
    dispatchViewState
  )

  const imageBitmaps = useMemo(() => {
    return images.map(({ path, file }) => (
      <image
        key={file.id}
        xlinkHref={new URL(`file://${path}`).toString()}
        style={{ pointerEvents: 'none' }}
        x={secondsToPixels(file.startSeconds, pixelsPerSecond)}
        preserveAspectRatio="none"
        width={secondsToPixels(
          file.endSeconds - file.startSeconds,
          pixelsPerSecond
        )}
        height={WAVEFORM_HEIGHT}
      />
    ))
  }, [images, pixelsPerSecond])

  const handleMouseWheel: React.WheelEventHandler = useCallback(
    (e) => {
      if (svgRef.current)
        dispatchViewState({
          type: 'ZOOM',
          delta: e.deltaY,
          svgWidth: elementWidth(svgRef.current),
        })
    },
    [dispatchViewState, svgRef]
  )

  return (
    <svg
      ref={svgRef}
      id="waveform-svg"
      viewBox={viewBoxString}
      preserveAspectRatio="xMinYMin slice"
      className={cn(css.waveformSvg, $.container)}
      onMouseDown={handleMouseDown}
      height={height}
      style={mediaIsLoaded ? undefined : { pointerEvents: 'none' }}
      onWheel={handleMouseWheel}
    >
      <g>
        <rect
          fill="#222222"
          x={0}
          y={0}
          width={secondsToPixels(
            waveformState.durationSeconds,
            pixelsPerSecond
          )}
          height={height}
        />
        <Clips
          clips={clips}
          highlightedClipId={highlightedClipId}
          height={height}
          playerRef={playerRef}
          pixelsPerSecond={pixelsPerSecond}
        />
        {waveformState.pendingAction && (
          <PendingWaveformItem
            action={waveformState.pendingAction}
            height={height}
            rectRef={pendingActionRef}
            pixelsPerSecond={pixelsPerSecond}
          />
        )}
        {imageBitmaps}

        {Boolean(subtitles.cards.length || subtitles.excludedTracks.length) && (
          <SubtitlesTimelines
            pixelsPerSecond={pixelsPerSecond}
            subtitles={subtitles}
            goToSubtitlesChunk={goToSubtitlesChunk}
            highlightedChunkIndex={highlightedChunkIndex}
            waveformItems={visibleWaveformItems}
          />
        )}
        <Cursor
          x={msToPixels(waveformState.cursorMs, pixelsPerSecond)}
          height={height}
          strokeWidth={1}
        />
      </g>
    </svg>
  )
}

const WAVEFORM_ACTION_TYPE_TO_CLASSNAMES: Record<
  WaveformDragAction['type'],
  string
> = {
  CREATE: css.waveformPendingClip,
  MOVE: css.waveformPendingClipMove,
  STRETCH: css.waveformPendingStretch,
}

const getClipRectProps = (start: number, end: number, height: number) => ({
  x: Math.min(start, end),
  y: 0,
  width: Math.abs(start - end),
  height,
})

function PendingWaveformItem({
  action,
  height,
  rectRef,
  pixelsPerSecond,
}: {
  action: WaveformDragAction
  height: number
  rectRef: MutableRefObject<SVGRectElement | null>
  pixelsPerSecond: number
}) {
  if (action.type === 'MOVE') {
    const { start, end, clipToMove } = action
    const deltaX = start - end

    return (
      <rect
        ref={rectRef}
        className={WAVEFORM_ACTION_TYPE_TO_CLASSNAMES[action.type]}
        {...getClipRectProps(
          msToPixels(clipToMove.start - deltaX, pixelsPerSecond),
          msToPixels(clipToMove.end - deltaX, pixelsPerSecond),
          height
        )}
      />
    )
  }

  if (action.type === 'STRETCH') {
    const { start, end, clipToStretch } = action
    const originKey =
      Math.abs(start - clipToStretch.start) <
      Math.abs(start - clipToStretch.end)
        ? 'start'
        : 'end'
    const edge = clipToStretch[originKey]

    const deltaX = start - end

    return (
      <rect
        ref={rectRef}
        className={WAVEFORM_ACTION_TYPE_TO_CLASSNAMES[action.type]}
        {...getClipRectProps(
          msToPixels(edge, pixelsPerSecond),
          msToPixels(edge - deltaX, pixelsPerSecond),
          height
        )}
      />
    )
  }
  return (
    <rect
      ref={rectRef}
      className={WAVEFORM_ACTION_TYPE_TO_CLASSNAMES[action.type]}
      {...getClipRectProps(
        msToPixels(action.start, pixelsPerSecond),
        msToPixels(action.end, pixelsPerSecond),
        height
      )}
    />
  )
}

function useWaveformMouseActions(
  svgRef: React.RefObject<SVGSVGElement>,
  waveform: WaveformState,
  pixelsPerSecond: number,
  playerRef: React.MutableRefObject<HTMLVideoElement | HTMLAudioElement | null>,
  dispatch: (action: WaveformAction) => void
) {
  const { pendingAction } = waveform
  const pendingActionRef = useRef<SVGRectElement | null>(null)

  const mouseIsDown = useRef(false)

  const durationMilliseconds = secondsToMs(waveform.durationSeconds)

  useEffect(() => {
    const handleMouseMoves = (e: MouseEvent) => {
      if (!mouseIsDown.current) return

      e.preventDefault()
      const svg = svgRef.current
      if (svg) {
        const msAtMouse = waveformTimeAtMousePosition(
          e,
          svg,
          waveform.viewBoxStartMs,
          pixelsPerSecond
        )
        const ms = Math.min(durationMilliseconds, msAtMouse)
        dispatch({ type: 'CONTINUE_WAVEFORM_MOUSE_ACTION', ms })
      }
    }
    document.addEventListener('mousemove', handleMouseMoves)
    return () => document.removeEventListener('mousemove', handleMouseMoves)
  }, [
    dispatch,
    svgRef,
    waveform.viewBoxStartMs,
    waveform.durationSeconds,
    durationMilliseconds,
    pixelsPerSecond,
  ])

  const handleMouseDown: EventHandler<React.MouseEvent<
    SVGElement
  >> = useCallback(
    (e) => {
      e.preventDefault()
      const msAtMouse = waveformTimeAtMousePosition(
        e,
        e.currentTarget,
        waveform.viewBoxStartMs,
        pixelsPerSecond
      )
      const ms = Math.min(durationMilliseconds, msAtMouse)
      const waveformMousedown = new WaveformMousedownEvent(e, ms)
      document.dispatchEvent(waveformMousedown)
      const { dataset } = e.target as SVGGElement | SVGRectElement

      const mousedownAction = getWaveformMousedownAction(dataset, ms, waveform)
      if (mousedownAction)
        dispatch({
          type: 'START_WAVEFORM_MOUSE_ACTION',
          action: mousedownAction,
        })

      mouseIsDown.current = true
    },
    [waveform, durationMilliseconds, pixelsPerSecond, dispatch]
  )

  useEffect(() => {
    const handleMouseUps = (e: MouseEvent) => {
      if (!mouseIsDown.current) return
      mouseIsDown.current = false
      dispatch({
        type: 'START_WAVEFORM_MOUSE_ACTION' as const,
        action: null,
      })

      const svg = svgRef.current
      if (!svg) return

      const msAtMouse = waveformTimeAtMousePosition(
        e,
        svg,
        waveform.viewBoxStartMs,
        pixelsPerSecond
      )
      const ms = Math.min(durationMilliseconds, msAtMouse)
      const { dataset } = e.target as SVGGElement | SVGRectElement

      if (playerRef.current) {
        const newTime = getTimeAfterMouseUp(
          pendingAction,
          waveform.selection,
          dataset,
          ms
        )

        playerRef.current.currentTime = msToSeconds(newTime)
        if (!pendingAction) setCursorX(msToPixels(newTime, pixelsPerSecond))
      }
      if (pendingAction) {
        const finalAction = {
          ...pendingAction,
          end: ms,
          waveformState: waveform,
        }
        document.dispatchEvent(new WaveformDragEvent(finalAction))
      }
    }
    document.addEventListener('mouseup', handleMouseUps)
    return () => document.removeEventListener('mouseup', handleMouseUps)
  }, [
    dispatch,
    durationMilliseconds,
    pendingAction,
    pixelsPerSecond,
    playerRef,
    svgRef,
    waveform,
    waveform.durationSeconds,
  ])

  return {
    handleMouseDown,
    pendingActionRef,
  }
}

export default Waveform

export { $ as waveform$ }

function getWaveformMousedownAction(
  dataset: DOMStringMap,
  ms: number,
  waveform: WaveformState
) {
  if (
    dataset &&
    dataset.clipId &&
    (Math.abs(Number(dataset.clipStart) - ms) <=
      SELECTION_BORDER_MILLISECONDS ||
      Math.abs(Number(dataset.clipEnd) - ms) <= SELECTION_BORDER_MILLISECONDS)
  ) {
    return {
      type: 'STRETCH' as const,
      start: ms,
      end: ms,
      clipToStretch: {
        id: dataset.clipId,
        start: Number(dataset.clipStart),
        end: Number(dataset.clipEnd),
      },
      waveformState: waveform,
    }
  } else if (dataset && dataset.clipId)
    return {
      type: 'MOVE' as const,
      start: ms,
      end: ms,
      clipToMove: {
        id: dataset.clipId,
        start: Number(dataset.clipStart),
        end: Number(dataset.clipEnd),
      },
      waveformState: waveform,
    }
  else
    return {
      type: 'CREATE' as const,
      start: ms,
      end: ms,
      waveformState: waveform,
    }
}

function getTimeAfterMouseUp(
  pendingAction: WaveformDragAction | null,
  waveformSelection: WaveformSelection | null,
  dataset: DOMStringMap,
  mouseMilliseconds: number
) {
  const clipIsToBeNewlySelected =
    dataset.clipId &&
    (waveformSelection?.type !== 'Clip' ||
      waveformSelection.id !== dataset.clipId)
  if (clipIsToBeNewlySelected) {
    return Number(dataset.clipStart)
  }

  const itemAtMouse = Boolean(
    dataset &&
      ((dataset.clipId && !dataset.clipIsHighlighted) || dataset.chunkIndex)
  )

  return !pendingAction && itemAtMouse
    ? Number(dataset.clipStart || dataset.chunkStart)
    : mouseMilliseconds
}
