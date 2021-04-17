declare type WaveformX = number

declare type ClipId = string

declare type Milliseconds = number

declare type Clip = {
  id: ClipId
  start: Milliseconds
  end: Milliseconds
  fileId: MediaFileId
  linkedSubtitlesChunk?: number
  clipwaveType: 'Primary'
}

declare type ClipsState = {
  byId: Record<ClipId, Clip>
  idsByMediaFileId: Record<MediaFileId, ClipId[]>
  flashcards: FlashcardsState
}

type TimeSpan = {
  start: number
  end: number
}

declare type ClipSpecs = {
  // for export?
  sourceFilePath: string
  outputFilename: string
  /** milliseconds */
  startTime: number
  /** milliseconds */
  endTime: number
  flashcardSpecs: FlashcardSpecs
}
declare type FlashcardSpecs = {
  id: string
  fields: Array<string>
  tags: string
  image: FlashcardImageSpecs | null
  clozeDeletions?: string
}

declare type ApkgExportData = {
  deckName: string
  projectId: number

  noteModel: ApkgExportNoteModel
  clozeNoteModel: ApkgExportClozeNoteModel
  clips: Array<ClipSpecs>
}

declare type ApkgExportNoteModel = {
  name: string
  id: number
  flds: Array<{ name: string }>
  req: Array<number, 'all' | 'any', number[]>
  css: string
  tmpls: Array<{
    name: string
    qfmt: string
    afmt: string
  }>
}

declare type FlashcardImageSpecs = {
  id: string
  seconds: number
}

declare type ApkgExportClozeNoteModel = {
  id: number
  name: string
  flds: Array<{ name: string }>
  css: string
  tmpl: {
    name: string
    qfmt: string
    afmt: string
  }
}

declare type ClipPre3_0_0 = {
  id: ClipId
  start: WaveformX
  end: WaveformX
  fileId: MediaFileId
  flashcard: FlashcardPre3_0_0
}

declare type FlashcardPre3_0_0 = {
  id: ClipId
  fields: {
    [K: string]: string
  }
  tags: Array<string>
}

// project file version 0.0.0
declare type ClipWithoutFilePath = {
  id: ClipId
  start: WaveformX
  end: WaveformX
  flashcard: {
    id: ClipId
    fields: {
      [NoteFieldId: string]: string
    }
    tags: Array<string> | null
  }
}
