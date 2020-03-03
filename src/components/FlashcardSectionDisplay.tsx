import React, { ReactChild } from 'react'
import cn from 'classnames'
import css from './FlashcardSectionDisplay.module.css'
import { TransliterationFlashcardFields } from '../types/Project'
import FlashcardDisplayField from './FlashcardSectionDisplayField'
import { ClozeTextInputActions } from '../utils/useClozeUi'
import ClozeField from './FlashcardSectionDisplayClozeField'

const empty: ClozeDeletion[] = []

const FlashcardSectionDisplay = ({
  mediaFile,
  fieldsToTracks,
  fields,
  viewMode,
  menuItems,
  className,
  onDoubleClickField,
  fieldHoverText,
  clozeIndex = -1,
  previewClozeIndex = -1,
  clozeDeletions = empty,
  fieldValueRef,
  clozeTextInputActions,
}: {
  fields: TransliterationFlashcardFields
  viewMode: ViewMode

  mediaFile: MediaFile
  fieldsToTracks: SubtitlesFlashcardFieldsLinks
  menuItems: ReactChild
  className?: string
  onDoubleClickField?: (fn: TransliterationFlashcardFieldName) => void
  fieldHoverText?: string
  clozeIndex?: number
  previewClozeIndex?: number
  clozeDeletions?: ClozeDeletion[]
  confirmSelection?: (e: any) => void
  fieldValueRef: React.RefObject<HTMLSpanElement>
  clozeTextInputActions?: ClozeTextInputActions
}) => {
  return (
    <section
      className={cn(css.container, className, {
        [css.horizontalPreview]: viewMode === 'HORIZONTAL',
      })}
    >
      <section className={cn(css.previewFields)}>
        {clozeDeletions && fieldValueRef && fields.transcription.trim() ? (
          <div
            className={cn(css.clozeField, {
              [css.clozeFieldEditing]: clozeIndex !== -1,
            })}
          >
            {clozeTextInputActions && (
              <ClozeField
                className={css.previewFieldTranscription}
                fieldName={'transcription'}
                subtitles={mediaFile.subtitles}
                linkedTracks={fieldsToTracks}
                mediaFileId={mediaFile.id}
                value={fields.transcription}
                clozeIndex={clozeIndex}
                deletions={clozeDeletions || []}
                previewClozeIndex={previewClozeIndex}
                fieldValueRef={fieldValueRef}
                clozeTextInputActions={clozeTextInputActions}
              />
            )}
          </div>
        ) : (
          <FlashcardDisplayField
            fieldName="transcription"
            subtitles={mediaFile.subtitles}
            linkedTracks={fieldsToTracks}
            mediaFileId={mediaFile.id}
            onDoubleClick={onDoubleClickField}
            title={fieldHoverText}
            className={cn(css.previewFieldTranscription)}
            fieldValueRef={fieldValueRef}
          >
            {fields.transcription || null}
          </FlashcardDisplayField>
        )}
        {'pronunciation' in fields && fields.pronunciation && (
          <FlashcardDisplayField
            fieldName="pronunciation"
            subtitles={mediaFile.subtitles}
            linkedTracks={fieldsToTracks}
            mediaFileId={mediaFile.id}
            onDoubleClick={onDoubleClickField}
            title={fieldHoverText}
            className={css.previewFieldPronunciation}
          >
            {fields.pronunciation}
          </FlashcardDisplayField>
        )}
        <FlashcardDisplayField
          fieldName="meaning"
          subtitles={mediaFile.subtitles}
          linkedTracks={fieldsToTracks}
          mediaFileId={mediaFile.id}
          onDoubleClick={onDoubleClickField}
          title={fieldHoverText}
        >
          {fields.meaning || null}
        </FlashcardDisplayField>
        {fields.notes && (
          <FlashcardDisplayField
            fieldName="notes"
            subtitles={mediaFile.subtitles}
            linkedTracks={fieldsToTracks}
            mediaFileId={mediaFile.id}
            onDoubleClick={onDoubleClickField}
            title={fieldHoverText}
            className={cn(css.previewFieldNotes)}
          >
            {fields.notes}
          </FlashcardDisplayField>
        )}
      </section>

      <section className={css.menu}>{menuItems}</section>
    </section>
  )
}

export default FlashcardSectionDisplay
