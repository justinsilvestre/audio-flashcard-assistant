declare type SessionState = {
  waveformSelection: WaveformSelection | null
  defaultTags: Array<string>
  defaultIncludeStill: boolean
  tagsToClipIds: {
    [K: string]: Array<ClipId>
  }
  currentProjectId: ProjectId | null
  currentMediaFileId: MediaFileId | null
  workIsUnsaved: boolean
  loopMedia: LoopState
  mediaIsPlaying: boolean
  editingCards: boolean
  dictionaryPopoverIsOpen: boolean

  progress: ProgressInfo | null
}

declare type LoopState = LoopReason | false
declare type LoopReason = 'FOCUS' | 'EDIT' | 'KEYBOARD' | 'BUTTON'

declare type ProgressInfo = {
  message: string
  percentage: number
}

declare type WaveformSelection =
  | {
      type: 'Clip'
      /** delete index */
      index: number
      id: ClipId
    }
  | { type: 'Preview'; index: number; cardBaseIndex: number }
