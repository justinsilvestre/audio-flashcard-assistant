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
  usePlayButtonSync,
  WAVEFORM_HEIGHT,
  SUBTITLES_CHUNK_HEIGHT,
  calculateRegions,
  secondsToMs,
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
import { usePrevious } from '../utils/usePrevious'
import { useRenderSecondaryClip } from './WaveformSubtitlesTimelines'
import { useWaveformEventHandlers } from './useWaveformEventHandlers'
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
    (id: string): WaveformItem | null => {
      const clip: Clip | null = clipsMap[id] || null
      if (clip)
        return {
          clipwaveType: 'Primary',
          id: clip.id,
          start: clip.start,
          end: clip.end,
        }

      const subsBase: SubtitlesCardBase | null = subsBases.cardsMap[id]
      if (subsBase)
        return {
          clipwaveType: 'Secondary',
          id,
          start: subsBase.start,
          end: subsBase.end,
        }

      return null
    },
    [clipsMap, subsBases]
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
  usePlayButtonSync(waveform.state.pixelsPerSecond, playerRef)

  const prevSubsBases = usePrevious(subsBases)
  useEffect(() => {
    if (subsBases !== prevSubsBases) {
      const sortedItems = sortWaveformItems([
        ...Object.values(clipsMap),
        ...subsBases.cards,
      ])
      const { regions } = calculateRegions(
        sortedItems,
        secondsToMs(waveform.state.durationSeconds)
      )

      waveform.dispatch({
        type: 'SET_REGIONS',
        regions,
      })
    }
  }, [subsBases, prevSubsBases, clipsMap, waveform])

  const dispatch = useDispatch()

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

  const {
    handleWaveformDrag,
    handleClipDrag,
    handleClipEdgeDrag,
  } = useWaveformEventHandlers(playerRef, dispatch, waveform, highlightedClipId)

  const renderSecondaryClip = useRenderSecondaryClip(waveform)

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
          renderSecondaryClip={renderSecondaryClip}
          height={
            WAVEFORM_HEIGHT +
            subsBases.linkedTrackIds.length * SUBTITLES_CHUNK_HEIGHT
          }
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
