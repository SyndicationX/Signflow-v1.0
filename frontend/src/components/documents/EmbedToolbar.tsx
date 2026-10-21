import { Save } from 'lucide-react'
import { getSaveEmbedTemplateDisabledReason } from '../../utils/embedTemplate'
import type { DocumentField, Recipient } from '../../types'

interface EmbedToolbarProps {
  activeAssignRole: 'buyer' | 'seller'
  fields: DocumentField[]
  recipients: Recipient[]
  sponsorRecipients: Recipient[]
  selectedSponsorEmail: string
  canSaveTemplate: boolean
  isSaving?: boolean
  onSelectAssignRole: (role: 'buyer' | 'seller') => void
  onSelectSponsor: (email: string) => void
  onSaveTemplate: () => void
}

function sponsorChoiceLabel(recipient: Recipient): string {
  const email = recipient.email.trim().toLowerCase()
  if (!email || email.endsWith('@embed.local')) return 'Any sponsor'
  return recipient.name.trim() || email
}

export function EmbedToolbar({
  activeAssignRole,
  fields,
  recipients,
  sponsorRecipients,
  selectedSponsorEmail,
  canSaveTemplate,
  isSaving = false,
  onSelectAssignRole,
  onSelectSponsor,
  onSaveTemplate,
}: EmbedToolbarProps) {
  const saveDisabledReason = getSaveEmbedTemplateDisabledReason(fields, recipients)

  return (
    <div className="embed-builder-toolbar">
      <span className="embed-builder-toolbar-label">Place fields for</span>
      <div className="embed-builder-role-toggle" role="group" aria-label="Assign fields to">
        <button
          type="button"
          className={`embed-builder-role-btn embed-builder-role-btn--investor${
            activeAssignRole === 'buyer' ? ' is-active' : ''
          }`}
          onClick={() => onSelectAssignRole('buyer')}
        >
          Investor
        </button>
        <button
          type="button"
          className={`embed-builder-role-btn embed-builder-role-btn--sponsor${
            activeAssignRole === 'seller' ? ' is-active' : ''
          }`}
          onClick={() => onSelectAssignRole('seller')}
        >
          Sponsor
        </button>
      </div>
      {activeAssignRole === 'seller' && sponsorRecipients.length > 0 && (
        <label className="embed-builder-sponsor-picker">
          <span>Sponsor who signs</span>
          <select
            value={
              sponsorRecipients.some((recipient) => recipient.email === selectedSponsorEmail)
                ? selectedSponsorEmail
                : sponsorRecipients[0]?.email ?? ''
            }
            onChange={(event) => onSelectSponsor(event.target.value)}
            aria-label="Choose which sponsor signs this field"
          >
            {sponsorRecipients.map((recipient) => (
              <option key={recipient.id} value={recipient.email}>
                {sponsorChoiceLabel(recipient)}
              </option>
            ))}
          </select>
        </label>
      )}
      <span className="embed-builder-toolbar-hint">Click the PDF to place fields</span>
      <button
        type="button"
        className="embed-builder-save-btn"
        disabled={!canSaveTemplate || isSaving}
        title={saveDisabledReason}
        onClick={onSaveTemplate}
      >
        <Save size={15} strokeWidth={2.25} aria-hidden />
        {isSaving ? 'Saving…' : 'Save template'}
      </button>
    </div>
  )
}
