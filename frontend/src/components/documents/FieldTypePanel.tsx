import { useState } from 'react'
import { createPortal } from 'react-dom'
import { Info, Pencil, Trash2 } from 'lucide-react'
import {
  FIELD_TYPES,
  PROFILE_TYPE_OPTIONS,
  colorWithAlpha,
  getProfileTypeStyle,
} from '../../constants/fieldTypes'
import { getRadioGroupFields, getRadioGroupId } from '../../utils/radioField'
import { formatFieldProfileScope } from '../../utils/profileField'
import { namedSponsorLabel } from '../../utils/investorSponsorWorkflow'
import { IconButton } from '../ui/IconButton'
import type { DocumentField, FieldType, ProfileType, Recipient } from '../../types'

const FIELD_TYPES_INFO = 'Fields will have to be filled manually.'

function FieldTypesInfo() {
  const [tip, setTip] = useState<{ top: number; left: number } | null>(null)

  const showTip = (target: HTMLButtonElement) => {
    const rect = target.getBoundingClientRect()
    const width = 220
    const left = Math.max(12, Math.min(rect.left, window.innerWidth - width - 12))
    const top = Math.min(rect.bottom + 8, window.innerHeight - 72)
    setTip({ top, left })
  }

  return (
    <>
      <button
        type="button"
        className="field-types-info"
        aria-label={FIELD_TYPES_INFO}
        onMouseEnter={(event) => showTip(event.currentTarget)}
        onMouseLeave={() => setTip(null)}
        onFocus={(event) => showTip(event.currentTarget)}
        onBlur={() => setTip(null)}
      >
        <Info size={15} strokeWidth={2} aria-hidden />
      </button>
      {tip
        ? createPortal(
            <div
              className="field-types-tip"
              role="tooltip"
              style={{ top: tip.top, left: tip.left }}
            >
              {FIELD_TYPES_INFO}
            </div>,
            document.body,
          )
        : null}
    </>
  )
}

interface FieldTypePanelProps {
  activeProfileType: ProfileType
  canUseProfilePreview: boolean
  previewProfileMode: boolean
  isProfilePreviewEnabled: boolean
  selectedFieldType: FieldType
  newFieldRequired: boolean
  fields: DocumentField[]
  recipients: Recipient[]
  getFieldColor: (field: DocumentField) => string
  onSelectProfileType: (profileType: ProfileType) => void
  onProfilePreviewModeChange: (enabled: boolean) => void
  onSelectFieldType: (type: FieldType) => void
  onNewFieldRequiredChange: (required: boolean) => void
  onToggleFieldRequired: (fieldId: string, required: boolean) => void
  onRemoveField: (fieldId: string) => void
  onAddChoiceOption: (
    fieldId: string,
    options?: { pageCount?: number; placement?: 'below' | 'nextPage' },
  ) => void
  pageCount?: number
  onUpdateFieldLabel: (fieldId: string, label: string) => void
  onEditFieldProfileScope: (fieldId: string) => void
  isFieldVisible?: (field: DocumentField) => boolean
  partyLabel?: string
}

export function FieldTypePanel({
  activeProfileType,
  canUseProfilePreview,
  previewProfileMode,
  isProfilePreviewEnabled,
  selectedFieldType,
  newFieldRequired,
  fields,
  recipients,
  getFieldColor,
  onSelectProfileType,
  onProfilePreviewModeChange,
  onSelectFieldType,
  onNewFieldRequiredChange,
  onToggleFieldRequired,
  onRemoveField,
  onAddChoiceOption,
  pageCount = 1,
  onUpdateFieldLabel,
  onEditFieldProfileScope,
  isFieldVisible,
  partyLabel,
}: FieldTypePanelProps) {
  const visibleFields = isFieldVisible ? fields.filter(isFieldVisible) : fields
  return (
    <aside className="field-panel">
      <div className="field-panel-section-header">
        <h3>Preview Profile Type</h3>
        <label className="profile-preview-toggle">
          <input
            type="checkbox"
            checked={previewProfileMode}
            disabled={!canUseProfilePreview}
            onChange={(event) => onProfilePreviewModeChange(event.target.checked)}
          />
          <span>Preview</span>
        </label>
      </div>
      <p className="profile-type-preview-hint">
        {isProfilePreviewEnabled
          ? 'Preview which fields appear for each investor profile. When placing a field, choose its profile scope — click the profile badge on any placed field to change it later.'
          : 'All profile-specific fields are shown on the document. Enable preview to filter fields by investor profile.'}
      </p>
      <div className={`profile-type-list ${isProfilePreviewEnabled ? '' : 'profile-type-list--disabled'}`}>
        {PROFILE_TYPE_OPTIONS.map((option) => {
          const accent = getProfileTypeStyle(option.value)
          const isActive = isProfilePreviewEnabled && activeProfileType === option.value

          return (
            <button
              key={option.value}
              type="button"
              className={`profile-type-chip ${isActive ? 'active' : ''}`}
              style={{
                borderColor: isActive ? accent.border : accent.ring,
                color: isActive ? accent.color : 'var(--color-text)',
                backgroundColor: isActive ? accent.softBg : 'var(--input-bg)',
                boxShadow: isActive ? `inset 0 0 0 1px ${accent.ring}` : undefined,
              }}
              onClick={() => onSelectProfileType(option.value)}
              disabled={!isProfilePreviewEnabled}
              aria-pressed={isActive}
              aria-disabled={!isProfilePreviewEnabled}
            >
              <span className="profile-type-chip-label">
                <span
                  className="chip-dot chip-dot--accent"
                  style={{ background: accent.color, ['--chip-color' as string]: accent.color }}
                />
                {option.label}
              </span>
            </button>
          )
        })}
      </div>
      {!canUseProfilePreview && (
        <p className="profile-type-disabled-hint">
          {recipients.some((recipient) => recipient.role === 'buyer') &&
          !recipients.some((recipient) => recipient.role === 'seller')
            ? 'Add a sponsor recipient to preview investor profile fields in this workflow.'
            : 'Add an investor recipient to preview profile-specific fields.'}
        </p>
      )}

      <div className="field-types-heading">
        <h3 className="field-panel-section-title">Field Types</h3>
        <FieldTypesInfo />
      </div>
      <div className="field-type-grid">
        {FIELD_TYPES.map((fieldType) => (
          <button
            key={fieldType.type}
            type="button"
            className={`field-type-btn ${selectedFieldType === fieldType.type ? 'active' : ''}`}
            onClick={() => onSelectFieldType(fieldType.type)}
          >
            <span>{fieldType.icon}</span>
            {fieldType.label}
          </button>
        ))}
      </div>

      <label className="field-required-default">
        <input
          type="checkbox"
          checked={newFieldRequired}
          onChange={(event) => onNewFieldRequiredChange(event.target.checked)}
        />
        Required when placed
      </label>

      {selectedFieldType === 'radio' && (
        <p className="field-type-hint">
          Click the document to place the first option. Add below puts the next choice on this page. Add on page … continues the same group on the next page. The signer can select only one. Clicking the document again starts a separate group.
        </p>
      )}

      {selectedFieldType === 'checkbox' && (
        <p className="field-type-hint">
          Place the first checkbox. The plus button asks if the next one is required and which profile types see it. Clients can tick any number of them.
        </p>
      )}

      {selectedFieldType === 'number' && (
        <p className="field-type-hint">
          Signers can enter digits only. Formatting such as commas and decimals is preserved (e.g. 1,234.50).
        </p>
      )}

      <h3 className="field-panel-section-title">Placed Fields</h3>
      <ul className="placed-fields">
        {visibleFields.length === 0 ? (
          <li className="empty-hint">
            {fields.length === 0
              ? 'Click the document to place fields'
              : `No ${partyLabel ?? 'matching'} fields on this document`}
          </li>
        ) : (
          visibleFields.map((field) => {
            const groupId = getRadioGroupId(field, fields)
            const groupSize =
              field.type === 'radio' && groupId
                ? getRadioGroupFields(fields, groupId).length
                : 0
            const fieldColor = getFieldColor(field)
            const recipient = recipients.find((item) => item.id === field.recipientId)
            const showProfileScope = recipient?.role === 'buyer' && field.type !== 'radio'
            const sponsorName =
              field.type === 'signature' ? namedSponsorLabel(recipient) : null

            return (
              <li
                key={field.id}
                style={{
                  borderLeftColor: fieldColor,
                  backgroundColor: colorWithAlpha(fieldColor, 0.08),
                }}
              >
                <div className="placed-field-main">
                  <div className="placed-field-info">
                    <span className="field-type-tag">{field.type}</span>
                    {field.type === 'radio' ? (
                      <input
                        type="text"
                        className="radio-option-input"
                        value={field.label}
                        onChange={(event) => onUpdateFieldLabel(field.id, event.target.value)}
                        aria-label={`Radio option label for ${field.id}`}
                      />
                    ) : (
                      field.label
                    )}
                    {field.required && <span className="field-required-badge">Required</span>}
                    {showProfileScope && (
                      <button
                        type="button"
                        className="field-profile-type-badge field-profile-type-badge--editable"
                        onClick={() => onEditFieldProfileScope(field.id)}
                        title="Change profile types for this field"
                      >
                        <Pencil size={11} strokeWidth={2.25} aria-hidden />
                        {formatFieldProfileScope(field)}
                      </button>
                    )}
                    {groupSize > 1 && (
                      <span className="radio-group-badge">{groupSize} options</span>
                    )}
                  </div>
                  <div className="placed-field-actions">
                    {(field.type === 'radio' || field.type === 'checkbox') && (
                      <span className="choice-add-actions">
                        <span className="choice-page-tag">Page {field.page}</span>
                        <button
                          type="button"
                          className="choice-add-btn"
                          onClick={() =>
                            onAddChoiceOption(field.id, {
                              pageCount,
                              placement: 'below',
                            })
                          }
                        >
                          Add below
                        </button>
                        {field.page < pageCount && (
                          <button
                            type="button"
                            className="choice-add-btn"
                            title={`Add another in this group on page ${field.page + 1}`}
                            onClick={() =>
                              onAddChoiceOption(field.id, {
                                pageCount,
                                placement: 'nextPage',
                              })
                            }
                          >
                            Add on page {field.page + 1}
                          </button>
                        )}
                      </span>
                    )}
                    <label className="placed-field-required">
                      <input
                        type="checkbox"
                        checked={field.required}
                        onChange={(event) => onToggleFieldRequired(field.id, event.target.checked)}
                      />
                      Required
                    </label>
                  </div>
                </div>

                {sponsorName ? (
                  <span className="placed-field-sponsor-name" title={sponsorName}>
                    {sponsorName}
                  </span>
                ) : null}

                <IconButton
                  variant="ghost"
                  size="sm"
                  icon={Trash2}
                  label={`Remove ${field.label} field`}
                  className="placed-field-remove"
                  onClick={() => onRemoveField(field.id)}
                />
              </li>
            )
          })
        )}
      </ul>
    </aside>
  )
}
