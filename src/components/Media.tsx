import React, {
  useEffect,
  useRef,
  MutableRefObject,
  AudioHTMLAttributes,
  VideoHTMLAttributes,
  useCallback,
} from 'react'
import { useDispatch, useSelector } from 'react-redux'
import cn from 'classnames'
import r from '../redux'
import css from './Media.module.css'
import { Tooltip, IconButton } from '@material-ui/core'
import { VerticalSplitSharp, HorizontalSplitSharp } from '@material-ui/icons'
import { KEYS } from '../utils/keyboard'
import { MediaSubtitles, SubtitlesFileWithTrack } from '../selectors'

export const MEDIA_PLAYER_ID = 'mediaPlayer'

type MediaProps = {
  constantBitrateFilePath: string | null
  loop: LoopState
  metadata: MediaFile | null
  subtitles: MediaSubtitles
  className?: string
  viewMode: ViewMode
  playerRef: MutableRefObject<HTMLAudioElement | HTMLVideoElement | null>
  onMediaLoaded: (mediael: HTMLAudioElement | HTMLVideoElement | null) => void
  onTimeUpdate: (
    mediaEl: HTMLVideoElement | HTMLAudioElement,
    seeking: MutableRefObject<boolean>,
    looping: boolean
  ) => void
}
let clicked = false
const setClicked = (c: boolean) => {
  clicked = c
}
const Media = ({
  constantBitrateFilePath,
  metadata,
  subtitles,
  className,
  viewMode,
  onTimeUpdate,
  playerRef,
  onMediaLoaded,
  loop,
}: MediaProps) => {
  const seeking = useRef(false)
  const seekOn = useCallback((_e) => {
    seeking.current = true
  }, [])
  const seekOff = useCallback((_e) => {
    seeking.current = false
  }, [])

  const setUpBlur = useCallback(
    (_e) => {
      setClicked(true)
      if (playerRef.current) playerRef.current.blur()
    },
    [playerRef]
  )
  const blur = useCallback(
    (_e) => {
      if (playerRef.current && clicked) {
        playerRef.current.blur()
        // setClicked(false)
      }
    },
    [playerRef]
  )
  const stopBlur = useCallback(
    (_e) => {
      if (playerRef.current && clicked) {
        setClicked(false)
      }
    },
    [playerRef]
  )

  const looping = Boolean(loop)
  const props:
    | AudioHTMLAttributes<HTMLAudioElement>
    | VideoHTMLAttributes<HTMLVideoElement> = {
    loop: false,
    controls: true,
    // disablePictureInPicture: true,
    id: MEDIA_PLAYER_ID,
    controlsList: 'nodownload nofullscreen',
    src: constantBitrateFilePath
      ? new URL(`file://${constantBitrateFilePath}`).toString()
      : '',
    // @ts-ignore
    playbackspeed: 1,

    onSeeking: seekOn,
    onSeeked: seekOff,

    onLoadedMetadata: useCallback(
      (e) => {
        onMediaLoaded(e.target)
      },
      [onMediaLoaded]
    ),

    // prevent accidental scrub after play/pause with mouse
    onMouseEnter: setUpBlur,
    onMouseLeave: stopBlur,
    onPlay: blur,
    onPause: blur,
    onClick: blur,
    onVolumeChange: blur,
    onTimeUpdate: useCallback(
      (e) => {
        const media = e.target as HTMLVideoElement | HTMLAudioElement
        const wasSeeking = seeking.current
        onTimeUpdate(media, seeking, looping)
        if (wasSeeking) blur(e)
      },
      [onTimeUpdate, looping, blur, seeking]
    ),

    onKeyDown: useCallback((e) => {
      if (e.key === KEYS.arrowLeft || e.key === KEYS.arrowRight) {
        if (e.altKey) e.preventDefault()
        else e.stopPropagation()
      }
    }, []),
  }

  useEffect(() => {
    if (props.src) {
      setTimeout(() => {
        const player = document.getElementById('mediaPlayer') as
          | HTMLAudioElement
          | HTMLVideoElement
          | null
        if (player) player.src = props.src || ''
      }, 0)
    }
  }, [props.src])

  useSyncSubtitlesVisibility(subtitles.all, playerRef)

  const dispatch = useDispatch()
  const toggleViewMode = useCallback(() => {
    dispatch(
      r.setViewMode(viewMode === 'HORIZONTAL' ? 'VERTICAL' : 'HORIZONTAL')
    )
  }, [dispatch, viewMode])

  if (!metadata)
    return (
      <section className={className}>
        <div />
      </section>
    )

  return (
    <section className={cn(className, css.container)}>
      <Tooltip
        title={
          viewMode === 'HORIZONTAL'
            ? 'Switch to vertical view'
            : 'Switch to horizontal view'
        }
      >
        <IconButton
          style={{ transform: 'rotate(180deg)' }}
          onClick={toggleViewMode}
          className={css.viewModeButton}
        >
          {viewMode === 'HORIZONTAL' ? (
            <VerticalSplitSharp />
          ) : (
            <HorizontalSplitSharp />
          )}
        </IconButton>
      </Tooltip>

      {metadata.isVideo ? (
        <video
          {...props}
          ref={playerRef as MutableRefObject<HTMLVideoElement>}
          className={cn(css.video, css.mediaPlayer)}
        >
          {subtitles.all.map((track, index) => {
            const displayFile = track.displayFile
            return (
              <Subtitles
                track={track.track}
                index={index}
                displayFile={displayFile}
                key={track.id}
                isDefault={index === 0}
              />
            )
          })}
        </video>
      ) : (
        <audio
          {...(props as AudioHTMLAttributes<HTMLAudioElement>)}
          ref={playerRef as MutableRefObject<HTMLAudioElement>}
          className={cn(css.audio, css.mediaPlayer)}
        />
      )}
    </section>
  )
}

function useSyncSubtitlesVisibility(
  subtitles: SubtitlesFileWithTrack[],
  playerRef: React.MutableRefObject<HTMLAudioElement | HTMLVideoElement | null>
) {
  const dispatch = useDispatch()

  useEffect(() => {
    function syncReduxTracksToDom(event: Event) {
      Array.from(event.target as TextTrackList).forEach((domTrack) => {
        const track = subtitles.find((track) => track.id === domTrack.id)
        if (track && track.track && track.track.mode !== domTrack.mode)
          dispatch(
            domTrack.mode === 'showing'
              ? r.showSubtitles(track.id)
              : r.hideSubtitles(track.id)
          )
      })
    }
    if (playerRef.current)
      playerRef.current.textTracks.addEventListener(
        'change',
        syncReduxTracksToDom
      )
    const currentMediaRef = playerRef.current
    return () => {
      if (currentMediaRef)
        currentMediaRef.textTracks.removeEventListener(
          'change',
          syncReduxTracksToDom
        )
    }
  }, [subtitles, dispatch, playerRef])
  useEffect(() => {
    if (!playerRef.current) return
    for (const track of subtitles) {
      const domTrack = [...playerRef.current.textTracks].find(
        (domTrack) => domTrack.id === track.id
      )
      if (domTrack && track.track && domTrack.mode !== track.track.mode)
        domTrack.mode = track.track.mode
    }
  }, [subtitles, playerRef])
}

declare module 'react' {
  interface TrackHTMLAttributes<T> extends HTMLAttributes<T> {
    mode?: TextTrackMode
  }
}

const Subtitles = ({
  track,
  displayFile,
  isDefault,
}: {
  track: SubtitlesTrack | null
  displayFile: SubtitlesFile | null
  index: number
  isDefault: boolean
}) => {
  const { availability } = useSelector((state: AppState) => ({
    availability: displayFile
      ? r.getFileAvailability(state, displayFile)
      : null,
  }))

  if (!track || !availability || availability.status !== 'CURRENTLY_LOADED')
    return null

  return track.type === 'EmbeddedSubtitlesTrack' ? (
    <track
      id={track.id}
      kind="subtitles"
      src={new URL(`file://${availability.filePath}`).toString()}
      mode={track.mode}
      default={isDefault}
    />
  ) : (
    <track
      id={track.id}
      kind="subtitles"
      src={new URL(`file://${availability.filePath}`).toString()}
      mode={track.mode}
      default={isDefault}
    />
  )
}
export default Media
