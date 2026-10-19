import { ChevronLeft, ChevronRight, CircleCheck, XCircle } from 'lucide-react'
import { Button } from '../components/ui/Button'
import { collapseRadioGroupsForValidation, areRequiredFieldsComplete } from '../utils/radioField'
import { isSignerFieldComplete } from '../utils/signingFieldNavigation'
import type { DocumentField } from '../types'

interface SigningSidebarProps {
  fields: DocumentField[]
  /** Sponsor navigation uses signature fields. Other signers use required fields. */
  navigationFields?: DocumentField[]
  fieldValues: Record<string, string>
  currentFieldIndex: number
  progress: number
  onNext: () => void
  onPrevious: () => void
  onComplete: () => void
  onDecline?: () => void
}

export function SigningSidebar({
  fields,
  navigationFields,
  fieldValues,
  currentFieldIndex,
  progress,
  onNext,
  onPrevious,
  onComplete,
  onDecline,
}: SigningSidebarProps) {
  const requiredFields = collapseRadioGroupsForValidation(fields.filter((field) => field.required))
  const fieldsToVisit = navigationFields ?? requiredFields
  const currentField = fieldsToVisit[currentFieldIndex]
  const canComplete = areRequiredFieldsComplete(fields, fieldValues)
  const canGoNext = currentFieldIndex < fieldsToVisit.length - 1

  return (
    <aside className="signing-sidebar">
      <h3>Signing Guide</h3>

      <div className="progress-section">
        <div className="progress-bar">
          <div className="progress-fill" style={{ width: `${progress}%` }} />
        </div>
        <span className="progress-text">{progress}% complete</span>
      </div>

      {currentField && (
        <div className="current-field-info">
          <span className="field-step">Field {currentFieldIndex + 1} of {fieldsToVisit.length}</span>
          <strong>{currentField.label}</strong>
          <span className="field-type-tag">{currentField.type}</span>
        </div>
      )}

      <div className="sidebar-nav-buttons">
        <Button variant="secondary" size="sm" className="signing-field-nav-btn" icon={ChevronLeft} onClick={onPrevious} disabled={currentFieldIndex <= 0}>
          Previous field
        </Button>
        <Button variant="secondary" size="sm" className="signing-field-nav-btn" iconRight={ChevronRight} onClick={onNext} disabled={!canGoNext}>
          Next field
        </Button>
      </div>

      <ul className="field-checklist">
        {requiredFields.map((field) => {
          const done = isSignerFieldComplete(field, fields, fieldValues)
          return (
            <li key={field.id} className={done ? 'done' : field.id === currentField?.id ? 'current' : ''}>
              {done ? '✓' : '○'} {field.label}
            </li>
          )
        })}
      </ul>

      <div className="sidebar-actions">
        <Button
          fullWidth
          icon={CircleCheck}
          onClick={onComplete}
          disabled={!canComplete}
          title={canComplete ? undefined : 'Complete all required fields to enable signing'}
        >
          Complete Signing
        </Button>
        {onDecline && (
          <Button fullWidth variant="ghost" icon={XCircle} onClick={onDecline}>
            Decline
          </Button>
        )}
      </div>
    </aside>
  )
}
