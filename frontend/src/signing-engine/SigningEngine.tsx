import { useEffect, useCallback, useMemo, useRef, useState } from 'react'
import { api } from '../api/client'
import { useNavigate } from 'react-router-dom'
import { useSigningStore } from '../stores/signingStore'
import { SignatureModal } from './SignatureModal'
import { SigningSidebar } from './SigningSidebar'
import { SigningDocumentViewer } from './SigningDocumentViewer'
import { saveSigningCompletion, clearPdfDocumentCache, getSigningDocumentFileUrl } from '../utils/pdf'
import {
  areRequiredFieldsComplete,
  buildRadioGroupSelectionUpdates,
  getRadioGroupId,
  restoreSavedRadioValues,
} from '../utils/radioField'
import { formatDisplayDate } from '../utils/date'
import { fieldAppliesToProfile } from '../utils/profileField'
import {
  isSpouseSignatureField,
  replicateRecipientSigningFieldValues,
  replicateRecipientSigningSignedAt,
} from '../utils/replicateSigningFieldValues'
import { getRecipientRoleColor } from '../constants/fieldTypes'
import {
  navigationFieldsForSigner,
  nextFieldIndex,
  previousRequiredIndex,
} from '../utils/signingFieldNavigation'
import { Button } from '../components/ui/Button'
import type { Document, SigningMode } from '../types'
import './signing.css'

interface SigningEngineProps {
  document: Document
  recipientId: string
  investorRecipientId?: string
  mode: SigningMode
  token?: string
  onComplete?: (fieldValues: Record<string, string>) => void | Promise<unknown>
  onDecline?: () => void
  onEvent?: (event: string, data?: Record<string, unknown>) => void
  /** Page saved the last time this signer left the document. */
  resumePage?: number
  branding?: {
    primaryColor?: string
    buttonColor?: string
    logoUrl?: string
  }
}

export function SigningEngine({
  document,
  recipientId,
  investorRecipientId,
  mode,
  token,
  onComplete,
  onDecline,
  onEvent,
  resumePage,
  branding,
}: SigningEngineProps) {
  const navigate = useNavigate()
  const {
    setMode,
    fieldValues,
    fieldSignedAt,
    setFieldValue,
    setFieldValues,
    setFieldSignedAt,
    currentFieldIndex,
    setCurrentFieldIndex,
    openSignatureModal,
    isSignatureModalOpen,
    activeSignatureFieldId,
    closeSignatureModal,
    getProgress,
    reset,
  } = useSigningStore()

  const recipient = document.recipients.find((item) => item.id === recipientId)
  const investorRecipient = investorRecipientId
    ? document.recipients.find((item) => item.id === investorRecipientId)
    : undefined

  const investorFields =
    recipient?.role === 'seller' && investorRecipient
      ? document.fields.filter((field) => {
          if (field.recipientId !== investorRecipientId) return false
          if (investorRecipient.profileType) {
            return fieldAppliesToProfile(field, investorRecipient.profileType)
          }
          return true
        })
      : []

  const previouslySignedFields = document.fields.filter((field) => {
    if (field.recipientId === recipientId) return false
    const owner = document.recipients.find((item) => item.id === field.recipientId)
    if (!owner || (owner.signingStatus !== 'signed' && owner.signed !== true)) {
      return false
    }
    if (owner.role === 'buyer' && owner.profileType) {
      return fieldAppliesToProfile(field, owner.profileType)
    }
    return true
  })

  const recipientFields = document.fields.filter((field) => {
    if (field.recipientId !== recipientId) {
      return false
    }

    if (recipient?.role === 'buyer' && recipient.profileType) {
      return fieldAppliesToProfile(field, recipient.profileType)
    }

    return true
  })

  const viewerFields = [...previouslySignedFields, ...investorFields, ...recipientFields]
  const readOnlyFieldIds = new Set([
    ...previouslySignedFields.map((field) => field.id),
    ...investorFields.map((field) => field.id),
  ])
  const navigationFields = navigationFieldsForSigner(recipient?.role, recipientFields)
  const progress = getProgress(recipientFields)
  const [fieldNavigationRequest, setFieldNavigationRequest] = useState(0)
  const [visiblePage, setVisiblePage] = useState(() =>
    resumePage && resumePage > 0 ? Math.floor(resumePage) : 1,
  )
  const draftReadyRef = useRef(false)
  const pendingDraftRef = useRef<{
    token: string
    payload: { fieldValues?: Record<string, string>; page?: number }
  } | null>(null)
  const nextFieldIndexValue = nextFieldIndex(navigationFields.length, currentFieldIndex)
  const previousFieldIndex = previousRequiredIndex(navigationFields.length, currentFieldIndex)

  const pdfRevision = useMemo(
    () =>
      [
        ...document.recipients
          .filter((item) => item.signed || item.signingStatus === 'signed')
          .map((item) => `${item.id}:${item.signedAt ?? ''}`),
        ...document.fields
          .filter((field) => field.value)
          .map((field) => `${field.id}:${field.value}`),
      ].join('|'),
    [document.recipients, document.fields],
  )

  useEffect(() => {
    const updates: Record<string, string> = {}
    const signedAtUpdates: Record<string, string> = {}
    const restoredRadios = restoreSavedRadioValues(document.fields)

    for (const field of document.fields) {
      if (field.recipientId === recipientId) continue

      const owner = document.recipients.find((item) => item.id === field.recipientId)
      const ownerSigned = owner?.signingStatus === 'signed' || owner?.signed === true
      const isInvestorField =
        Boolean(investorRecipientId) && field.recipientId === investorRecipientId
      const isOtherSignedField = ownerSigned && field.recipientId !== recipientId

      if (!isInvestorField && !isOtherSignedField) continue

      if (owner?.role === 'buyer' && owner.profileType && !fieldAppliesToProfile(field, owner.profileType)) {
        continue
      }

      if (field.type === 'radio') {
        if (field.id in restoredRadios) updates[field.id] = restoredRadios[field.id]
        continue
      }

      if (!field.value) continue

      updates[field.id] = field.value

      if (owner?.signedAt && (field.type === 'signature' || field.type === 'initial')) {
        signedAtUpdates[field.id] = owner.signedAt
      }
    }

    if (Object.keys(updates).length > 0) {
      setFieldValues(updates)
    }
    for (const [fieldId, signedAt] of Object.entries(signedAtUpdates)) {
      setFieldSignedAt(fieldId, signedAt)
    }
  }, [pdfRevision, document, recipientId, investorRecipientId, setFieldValues, setFieldSignedAt])

  useEffect(() => {
    if (!token) return
    clearPdfDocumentCache(getSigningDocumentFileUrl(token))
  }, [pdfRevision, token])

  useEffect(() => {
    setMode(mode)
    onEvent?.('loaded', { documentId: document.id })

    const initialValues: Record<string, string> = {
      ...restoreSavedRadioValues(document.fields),
    }
    const initialSignedAt: Record<string, string> = {}
    for (const field of document.fields) {
      if (field.type === 'radio' || !field.value) continue

      initialValues[field.id] = field.value

      const owner = document.recipients.find((item) => item.id === field.recipientId)
      if (owner?.signedAt && (field.type === 'signature' || field.type === 'initial')) {
        initialSignedAt[field.id] = owner.signedAt
      }
    }
    if (Object.keys(initialValues).length > 0) {
      setFieldValues(initialValues)
    }
    if (Object.keys(initialSignedAt).length > 0) {
      for (const [fieldId, signedAt] of Object.entries(initialSignedAt)) {
        setFieldSignedAt(fieldId, signedAt)
      }
    }

    if (mode === 'embedded' || mode === 'iframe') {
      window.parent.postMessage({ event: 'signflow.loaded', documentId: document.id }, '*')
    }
    draftReadyRef.current = true
    return () => {
      draftReadyRef.current = false
      reset()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- initialize once per document session
  }, [document.id, investorRecipientId, mode])

  useEffect(() => {
    if (!token || !draftReadyRef.current) return
    const hasValues = Object.keys(fieldValues).length > 0
    if (!hasValues && visiblePage <= 1) return

    const scoped: Record<string, string> = {}
    if (hasValues) {
      const ownIds = new Set(
        document.fields
          .filter((field) => field.recipientId === recipientId)
          .map((field) => field.id),
      )
      for (const [fieldId, value] of Object.entries(fieldValues)) {
        if (ownIds.has(fieldId)) scoped[fieldId] = value
      }
    }

    const payload = {
      ...(Object.keys(scoped).length > 0 ? { fieldValues: scoped } : {}),
      ...(visiblePage > 0 ? { page: visiblePage } : {}),
    }
    pendingDraftRef.current = { token, payload }
    const timer = window.setTimeout(() => {
      void api.signing.saveProgress(token, payload).catch(() => undefined)
    }, 500)

    return () => window.clearTimeout(timer)
  }, [fieldValues, visiblePage, token, recipientId, document.fields])

  useEffect(() => {
    return () => {
      const pending = pendingDraftRef.current
      if (!pending?.token) return
      void api.signing.saveProgress(pending.token, pending.payload).catch(() => undefined)
    }
  }, [])

  const applyBranding = useCallback(() => {
    if (branding?.primaryColor) {
      window.document.documentElement.style.setProperty('--color-primary', branding.primaryColor)
      window.document.documentElement.style.setProperty('--color-button', branding.buttonColor || branding.primaryColor)
    }
  }, [branding])

  useEffect(() => {
    applyBranding()
  }, [applyBranding])

  const handleFieldActivate = (fieldId: string) => {
    const navigationIndex = navigationFields.findIndex((field) => field.id === fieldId)
    if (navigationIndex >= 0) {
      setCurrentFieldIndex(navigationIndex)
    }
  }

  const handleFieldValueChange = (fieldId: string, value: string) => {
    const field = document.fields.find((item) => item.id === fieldId)
    if (field?.type === 'radio' && value === 'selected') {
      const updates = buildRadioGroupSelectionUpdates(document.fields, fieldId)
      setFieldValues(updates)
      onEvent?.('signed', { fieldId, groupId: getRadioGroupId(field, document.fields) })
      return
    }

    setFieldValue(fieldId, value)
    onEvent?.('signed', { fieldId })
  }

  const handleSignatureRequest = (fieldId: string) => {
    openSignatureModal(fieldId)
  }

  const handleSignatureSave = (value: string) => {
    if (activeSignatureFieldId) {
      const signedAt = new Date().toISOString()
      const replicatedValues = replicateRecipientSigningFieldValues(
        recipientFields,
        fieldValues,
        activeSignatureFieldId,
        value,
      )
      const replicatedSignedAt = replicateRecipientSigningSignedAt(
        recipientFields,
        fieldSignedAt,
        activeSignatureFieldId,
        signedAt,
      )

      const dateUpdates: Record<string, string> = {}
      for (const field of recipientFields) {
        if (field.type === 'date' && !replicatedValues[field.id]) {
          dateUpdates[field.id] = formatDisplayDate(signedAt)
        }
      }

      setFieldValues({ ...replicatedValues, ...dateUpdates })
      for (const [fieldId, fieldSignedAtValue] of Object.entries(replicatedSignedAt)) {
        setFieldSignedAt(fieldId, fieldSignedAtValue)
      }

      onEvent?.('signed', { fieldId: activeSignatureFieldId, signedAt })
    }
    closeSignatureModal()
  }

  const focusFieldAt = (index: number) => {
    if (index < 0) return
    const field = navigationFields[index]
    setCurrentFieldIndex(index)
    setFieldNavigationRequest((request) => request + 1)
    if (
      field &&
      (field.type === 'signature' || field.type === 'initial') &&
      !String(fieldValues[field.id] ?? '').trim()
    ) {
      openSignatureModal(field.id)
    }
  }

  const goToNextField = () => {
    focusFieldAt(nextFieldIndexValue)
  }

  const goToPrevField = () => {
    focusFieldAt(previousFieldIndex)
  }

  const handleComplete = async () => {
    if (!areRequiredFieldsComplete(recipientFields, fieldValues)) {
      alert('Please complete all required fields before signing.')
      return
    }
    onEvent?.('completed', { documentId: document.id, fieldValues })
    if (mode === 'embedded' || mode === 'iframe') {
      window.parent.postMessage(
        { event: 'document.completed', documentId: document.id },
        '*',
      )
    }

    saveSigningCompletion({
      documentId: document.id,
      title: document.title,
      fileUrl: document.fileUrl,
      token,
      completedAt: new Date().toISOString(),
    })

    const completedAt = new Date().toISOString()
    let mergedFieldValues = { ...fieldValues }
    for (const field of recipientFields) {
      if (field.type === 'date' && !mergedFieldValues[field.id]) {
        mergedFieldValues[field.id] = formatDisplayDate(completedAt)
      }
    }

    const primarySignatureField = recipientFields.find(
      (field) =>
        (field.type === 'signature' || field.type === 'initial') &&
        !isSpouseSignatureField(field) &&
        String(mergedFieldValues[field.id] ?? '').trim(),
    )
    if (primarySignatureField) {
      mergedFieldValues = replicateRecipientSigningFieldValues(
        recipientFields,
        mergedFieldValues,
        primarySignatureField.id,
        mergedFieldValues[primarySignatureField.id]!,
      )
    }

    const valuesToSubmit = Object.fromEntries(
      Object.entries(mergedFieldValues).filter(([fieldId]) =>
        recipientFields.some((field) => field.id === fieldId),
      ),
    )

    await onComplete?.(valuesToSubmit)

    if (token) {
      clearPdfDocumentCache(getSigningDocumentFileUrl(token))
    }

    if (token && (mode === 'public' || mode === 'iframe')) {
      navigate(`/sign/${token}/complete`)
    }
  }

  const getRecipientColor = (fieldRecipientId: string) => {
    const recipient = document.recipients.find((r) => r.id === fieldRecipientId)
    return recipient?.color || getRecipientRoleColor(recipient?.role ?? 'buyer')
  }

  const canComplete = areRequiredFieldsComplete(recipientFields, fieldValues)

  const containerClass = `signing-engine signing-engine-${mode}`
  const isIframeMode = mode === 'iframe'

  useEffect(() => {
    if (!isIframeMode) return

    const onWheel = (event: WheelEvent) => {
      const scroller = window.document.querySelector('.signing-embed-body')
      if (!(scroller instanceof HTMLElement)) return
      const target = event.target
      if (
        target instanceof Element &&
        target.closest('input, textarea, select, .signature-pad')
      ) {
        return
      }

      const maxScroll = scroller.scrollHeight - scroller.clientHeight
      if (maxScroll <= 0) return

      const line = event.deltaMode === WheelEvent.DOM_DELTA_LINE ? 16 : 1
      const page = event.deltaMode === WheelEvent.DOM_DELTA_PAGE ? scroller.clientHeight : 1
      const delta = event.deltaY * line * page
      const next = Math.max(0, Math.min(maxScroll, scroller.scrollTop + delta))
      if (next === scroller.scrollTop) return

      scroller.scrollTop = next
      event.preventDefault()
    }

    window.addEventListener('wheel', onWheel, { passive: false })
    return () => window.removeEventListener('wheel', onWheel)
  }, [isIframeMode])

  const signingViewer = (
    <SigningDocumentViewer
      documentId={document.id}
      fileUrl={document.fileUrl}
      signingToken={token}
      title={document.title}
      pages={document.pages}
      fields={viewerFields}
      fieldValues={fieldValues}
      fieldSignedAt={fieldSignedAt}
      activeFieldId={navigationFields[currentFieldIndex]?.id}
      readOnlyFieldIds={readOnlyFieldIds}
      getRecipientColor={getRecipientColor}
      onFieldActivate={handleFieldActivate}
      onFieldValueChange={handleFieldValueChange}
      onSignatureRequest={handleSignatureRequest}
      fieldNavigationRequest={fieldNavigationRequest}
      showAllPages={isIframeMode}
      pdfRevision={pdfRevision}
      resumePage={resumePage}
      onVisiblePageChange={setVisiblePage}
    />
  )

  return (
    <div className={containerClass}>
      {branding?.logoUrl && (
        <div className="signing-brand">
          <img src={branding.logoUrl} alt="Organization logo" />
        </div>
      )}

      {isIframeMode ? (
        <div className="signing-embed-layout">
          <header className="signing-embed-chrome">
            <div className="signing-embed-chrome-main">
              <h2 className="signing-embed-title">{document.title}</h2>
              {investorRecipient && recipient?.role === 'seller' && (
                <p className="signing-embed-counter-sign">
                  Counter-signing for <strong>{investorRecipient.name}</strong>
                </p>
              )}
              <div className="signing-embed-progress-row">
                <div className="progress-bar signing-embed-progress-bar">
                  <div className="progress-fill" style={{ width: `${progress}%` }} />
                </div>
                <span className="progress-text">{progress}% complete</span>
              </div>
            </div>
            <div className="signing-embed-actions">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="signing-field-nav-btn"
                onClick={goToPrevField}
                disabled={previousFieldIndex < 0}
              >
                Previous field
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="signing-field-nav-btn"
                onClick={goToNextField}
                disabled={nextFieldIndexValue < 0}
              >
                Next field
              </Button>
              <Button
                type="button"
                onClick={handleComplete}
                disabled={!canComplete}
                className="signing-embed-finish-btn"
              >
                Finish signing
              </Button>
            </div>
          </header>
          <div className="signing-embed-body">{signingViewer}</div>
        </div>
      ) : (
        <div className="signing-layout">
          <SigningSidebar
            fields={recipientFields}
            navigationFields={navigationFields}
            fieldValues={fieldValues}
            currentFieldIndex={currentFieldIndex}
            progress={progress}
            onNext={goToNextField}
            onPrevious={goToPrevField}
            onComplete={handleComplete}
            onDecline={onDecline}
          />

          <div className="signing-viewer">
            <div className="signing-doc-header">
              <h2>{document.title}</h2>
              {investorRecipient && recipient?.role === 'seller' && (
                <p className="signing-counter-sign-notice">
                  Counter-signing for investor: <strong>{investorRecipient.name}</strong>
                </p>
              )}
              <span className="signing-progress-badge">{progress}% complete</span>
            </div>

            {signingViewer}
          </div>
        </div>
      )}

      <SignatureModal
        open={isSignatureModalOpen}
        onClose={closeSignatureModal}
        onSave={handleSignatureSave}
      />
    </div>
  )
}
