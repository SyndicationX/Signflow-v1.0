import type { DocumentField, FieldType } from '../types'
import { formatDisplayDateTime } from '../utils/date'
import { sanitizeNumberInput } from '../utils/numberField'
import { formatFieldDisplayValue, getSignatureImageSrc } from '../utils/pdf'
import { getRadioGroupFields, getRadioGroupId, isRadioGroupFilled } from '../utils/radioField'

interface SigningFieldOverlayProps {
  field: DocumentField
  allFields?: DocumentField[]
  value?: string
  fieldValues?: Record<string, string>
  signedAt?: string
  isActive: boolean
  borderColor: string
  readOnly?: boolean
  onActivate: () => void
  onValueChange: (value: string) => void
  onSignatureRequest: () => void
}

function getInputType(type: FieldType): string {
  switch (type) {
    case 'email':
      return 'email'
    case 'phone':
      return 'tel'
    default:
      return 'text'
  }
}

function isSignatureField(type: FieldType): boolean {
  return type === 'signature' || type === 'initial'
}

/** Red star on fields this signer still has to complete. One star per radio group. */
export function showsRequiredStar(
  field: DocumentField,
  allFields: DocumentField[] | undefined,
  value: string | undefined,
  fieldValues: Record<string, string> | undefined,
  readOnly: boolean,
): boolean {
  if (readOnly) return false

  if (field.type === 'radio') {
    const fields = allFields ?? [field]
    const groupId = getRadioGroupId(field, fields)
    const group = groupId ? getRadioGroupFields(fields, groupId) : [field]
    if (!group.some((item) => item.required)) return false
    const values = fieldValues ?? { [field.id]: value ?? '' }
    if (groupId && isRadioGroupFilled(fields, values, groupId)) return false
    const anchor = [...group].sort((a, b) => a.y - b.y || a.x - b.x)[0]
    return anchor?.id === field.id
  }

  if (!field.required) return false
  return !String(value ?? '').trim()
}

function RequiredMark({ choice = false }: { choice?: boolean }) {
  return (
    <span className={choice ? 'signing-field-req signing-field-req--choice' : 'signing-field-req'} aria-hidden>
      *
    </span>
  )
}

function EmptyFieldHint({ label, required }: { label: string; required: boolean }) {
  return (
    <span className="signing-field-hint">
      <span className="signing-field-hint-text">{label}</span>
      {required ? <RequiredMark /> : null}
    </span>
  )
}

function SignatureTimestamp({ signedAt }: { signedAt: string }) {
  return (
    <span className="signing-field-timestamp" title={`Signed ${formatDisplayDateTime(signedAt)}`}>
      {formatDisplayDateTime(signedAt)}
    </span>
  )
}

function SignatureFieldContent({
  field,
  value,
  signedAt,
  imageSrc,
}: {
  field: DocumentField
  value: string
  signedAt?: string
  imageSrc: string | null
}) {
  return (
    <div className="signing-field-signature-content">
      {imageSrc ? (
        <img src={imageSrc} alt={field.label} className="signing-field-image" />
      ) : (
        <span className="signing-field-text">{formatFieldDisplayValue(value)}</span>
      )}
      {signedAt ? <SignatureTimestamp signedAt={signedAt} /> : null}
    </div>
  )
}

export function SigningFieldOverlay({
  field,
  allFields,
  value,
  fieldValues,
  signedAt,
  isActive,
  borderColor,
  readOnly = false,
  onActivate,
  onValueChange,
  onSignatureRequest,
}: SigningFieldOverlayProps) {
  const isFilled = Boolean(value)
  const imageSrc = value ? getSignatureImageSrc(value) : null
  const showRequiredStar = showsRequiredStar(field, allFields, value, fieldValues, readOnly)
  const accessibleLabel = field.required ? `${field.label}, required` : field.label

  const handleSignatureClick = () => {
    if (readOnly) return
    onActivate()
    onSignatureRequest()
  }

  if (readOnly) {
    const completedLabel = isFilled ? `${field.label} (completed)` : field.label
    if (isSignatureField(field.type) && isFilled) {
      return (
        <div
          className="signing-field signing-field--readonly signing-field--signature filled"
          style={{
            borderColor,
          }}
          aria-label={completedLabel}
          title={`${field.label} — already completed on the document`}
        >
          <SignatureFieldContent
            field={field}
            value={value!}
            signedAt={signedAt}
            imageSrc={imageSrc}
          />
        </div>
      )
    }

    if (field.type === 'checkbox') {
      return (
        <div
          className={`signing-field signing-field--readonly signing-field--checkbox ${isFilled ? 'filled' : ''}`}
          style={{
            borderColor,
          }}
          aria-label={completedLabel}
        >
          <span className="signing-field-checkbox" aria-hidden>
            <input type="checkbox" checked={value === 'true'} readOnly tabIndex={-1} />
          </span>
        </div>
      )
    }

    if (field.type === 'radio') {
      const isSelected = value === 'selected'
      return (
        <div
          className={`signing-field signing-field--readonly signing-field--radio ${isSelected ? 'filled' : ''}`}
          style={{
            borderColor,
          }}
          aria-label={completedLabel}
        >
          <span className="signing-field-radio-option">
            <input type="radio" checked={isSelected} readOnly tabIndex={-1} aria-label={field.label} />
            <span className={`signing-radio-dot${isSelected ? ' signing-radio-dot--on' : ''}`} />
          </span>
        </div>
      )
    }

    return (
      <div
        className={`signing-field signing-field--readonly ${isFilled ? 'filled' : ''}`}
        style={{
          borderColor,
        }}
        aria-label={completedLabel}
        title={isFilled ? `${field.label} — already completed on the document` : undefined}
      >
        {isFilled ? (
          <span className="signing-field-text">{formatFieldDisplayValue(value!)}</span>
        ) : null}
      </div>
    )
  }

  if (isSignatureField(field.type)) {
    return (
      <button
        type="button"
        className={`signing-field signing-field--signature ${isActive ? 'active' : ''} ${isFilled ? 'filled' : ''}`}
        style={{
          borderColor,
        }}
        onClick={handleSignatureClick}
        aria-label={accessibleLabel}
        aria-required={field.required || undefined}
      >
        {isFilled ? (
          <SignatureFieldContent
            field={field}
            value={value!}
            signedAt={signedAt}
            imageSrc={imageSrc}
          />
        ) : (
          <span className="signing-field-text">
            {field.label}
            {showRequiredStar ? <RequiredMark /> : null}
          </span>
        )}
      </button>
    )
  }

  if (field.type === 'checkbox') {
    return (
      <>
      <div
        className={`signing-field signing-field--checkbox ${isActive ? 'active' : ''} ${isFilled ? 'filled' : ''}`}
        style={{
          borderColor: '#3b6cf5',
        }}
        onMouseDown={(event) => event.preventDefault()}
        onClick={(event) => {
          onActivate()
          if ((event.target as HTMLElement).closest('input')) return
          onValueChange(value === 'true' ? '' : 'true')
        }}
      >
        <label className="signing-field-checkbox">
          <input
            type="checkbox"
            checked={value === 'true'}
            onChange={(event) => onValueChange(event.target.checked ? 'true' : '')}
            onFocus={onActivate}
            aria-label={accessibleLabel}
            aria-required={field.required || undefined}
          />
        </label>
      </div>
      {showRequiredStar ? <RequiredMark choice /> : null}
      </>
    )
  }

  if (field.type === 'radio') {
    const groupId = getRadioGroupId(field, allFields)
    const isSelected = value === 'selected'

    const selectOption = () => {
      onActivate()
      if (!isSelected) {
        onValueChange('selected')
      }
    }

    return (
      <>
      <div
        className={`signing-field signing-field--radio ${isActive ? 'active' : ''} ${isSelected ? 'filled' : ''}`}
        style={{
          borderColor: '#3b6cf5',
        }}
        onClick={selectOption}
      >
        <label className="signing-field-radio-option">
          <input
            type="radio"
            name={`radio-${groupId ?? field.id}`}
            checked={isSelected}
            readOnly
            onChange={selectOption}
            onClick={(event) => event.preventDefault()}
            aria-label={accessibleLabel}
            aria-required={field.required || undefined}
          />
          <span
            className={`signing-radio-dot${isSelected ? ' signing-radio-dot--on' : ''}`}
            aria-hidden
          />
        </label>
      </div>
      {showRequiredStar ? <RequiredMark choice /> : null}
      </>
    )
  }

  const inputValue = value ? formatFieldDisplayValue(value) : ''

  if (field.type === 'date') {
    return (
      <div
        className={`signing-field signing-field--input signing-field--date ${isActive ? 'active' : ''} ${isFilled ? 'filled' : ''}`}
        style={{
          borderColor,
        }}
        onClick={onActivate}
      >
        {!isFilled ? <EmptyFieldHint label={field.label} required={showRequiredStar} /> : null}
        <input
          type="text"
          className="signing-field-input"
          value={inputValue}
          onChange={(event) => onValueChange(event.target.value)}
          onFocus={onActivate}
          aria-label={accessibleLabel}
          aria-required={field.required || undefined}
        />
      </div>
    )
  }

  if (field.type === 'number') {
    return (
      <div
        className={`signing-field signing-field--input signing-field--number ${isActive ? 'active' : ''} ${isFilled ? 'filled' : ''}`}
        style={{
          borderColor,
        }}
        onClick={onActivate}
      >
        {!isFilled ? <EmptyFieldHint label={field.label} required={showRequiredStar} /> : null}
        <input
          type="text"
          inputMode="decimal"
          className="signing-field-input"
          value={inputValue}
          onChange={(event) => onValueChange(sanitizeNumberInput(event.target.value))}
          onFocus={onActivate}
          aria-label={accessibleLabel}
          aria-required={field.required || undefined}
        />
      </div>
    )
  }

  return (
    <div
      className={`signing-field signing-field--input ${isActive ? 'active' : ''} ${isFilled ? 'filled' : ''}`}
      style={{
        borderColor,
      }}
      onClick={onActivate}
    >
      {!isFilled ? <EmptyFieldHint label={field.label} required={showRequiredStar} /> : null}
      <input
        type={getInputType(field.type)}
        className="signing-field-input"
        value={inputValue}
        onChange={(event) => onValueChange(event.target.value)}
        onFocus={onActivate}
        aria-label={accessibleLabel}
        aria-required={field.required || undefined}
      />
    </div>
  )
}
