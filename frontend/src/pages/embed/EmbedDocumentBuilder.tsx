import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { EmbedToolbar } from '../../components/documents/EmbedToolbar'
import { FieldTypePanel } from '../../components/documents/FieldTypePanel'
import { ProfileScopeModal } from '../../components/documents/ProfileScopeModal'
import { useDocument } from '../../hooks/useDocuments'
import { useDocumentBuilder } from '../../hooks/useDocumentBuilder'
import { useUploadDocumentFile } from '../../hooks/useDocumentMutations'
import { getDocumentFileUrl } from '../../utils/pdf'

const PdfCanvas = lazy(() =>
  import('../../components/documents/PdfCanvas').then((module) => ({
    default: module.PdfCanvas,
  })),
)

function EmbedBuilderLoading({ message }: { message: string }) {
  return (
    <div className="embed-builder-loading" role="status" aria-live="polite">
      <Loader2 className="embed-builder-spin" size={26} strokeWidth={2} aria-hidden />
      <p>{message}</p>
    </div>
  )
}

function notifyEmbedParent(event: string, payload?: Record<string, unknown>) {
  if (typeof window === 'undefined' || window.parent === window) return
  window.parent.postMessage({ source: 'signflow-embed', event, ...payload }, '*')
}

function readRequestedEmbedPage(searchParams: URLSearchParams): number {
  const page = Math.floor(Number(searchParams.get('page')))
  return Number.isFinite(page) && page >= 1 ? page : 1
}

/** Slim field-placement UI for portal iframe embed — no SignFlow app chrome. */
export function EmbedDocumentBuilder() {
  const { id = '' } = useParams<{ id: string }>()
  const [searchParams] = useSearchParams()
  const { data: document, isLoading, isError, error, refetch } = useDocument(id)
  const builder = useDocumentBuilder(document, id, { embedMode: true })
  const builderRef = useRef(builder)
  builderRef.current = builder
  const uploadDocumentFile = useUploadDocumentFile(id)
  const readyNotifiedRef = useRef(false)
  const [currentPage, setCurrentPage] = useState(() => readRequestedEmbedPage(searchParams))

  const pdfUrl = document ? getDocumentFileUrl(id, document.fileUrl) : undefined

  const handlePdfReady = useCallback(() => {
    notifyEmbedParent('builder-ready', { documentId: id })
  }, [id])

  useEffect(() => {
    if (!document || readyNotifiedRef.current) return
    readyNotifiedRef.current = true
    notifyEmbedParent('builder-document-loaded', {
      documentId: document.id,
      title: document.title,
      hasFile: Boolean(pdfUrl),
    })
  }, [document, pdfUrl])

  useEffect(() => {
    if (!document) return
    notifyEmbedParent('builder-template-state', {
      documentId: document.id,
      canSaveTemplate: builder?.canSaveTemplate ?? false,
      currentPage,
    })
  }, [document, builder?.canSaveTemplate, currentPage])

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.source !== window.parent) return
      const data = event.data as { source?: string; event?: string; page?: number } | null
      if (!data || data.source !== 'signflow-parent') return
      if (data.event === 'set-page' || data.event === 'set-current-page') {
        const page = Math.floor(Number(data.page))
        if (Number.isFinite(page) && page >= 1) setCurrentPage(page)
        return
      }
      if (data.event === 'refresh-document') {
        void refetch()
        return
      }
      if (data.event === 'save-template' || data.event === 'request-save-template') {
        const current = builderRef.current
        const finish = () => {
          if (!document) return
          notifyEmbedParent('builder-save-template', {
            documentId: document.id,
            title: document.title,
          })
        }
        if (!current) {
          finish()
          return
        }
        void current.flushPendingSave().then(finish, finish)
      }
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [document, refetch])

  const handleSaveTemplate = useCallback(() => {
    if (!builder?.canSaveTemplate || !document) return
    notifyEmbedParent('builder-save-template', {
      documentId: document.id,
      title: document.title,
    })
  }, [builder?.canSaveTemplate, document])

  if (isLoading && !document) {
    return <EmbedBuilderLoading message="Loading document…" />
  }

  if (isError || !document) {
    const message =
      error instanceof Error
        ? error.message
        : 'Could not load this document. Check the embed API key and try again.'
    notifyEmbedParent('builder-error', { message })
    return (
      <div className="embed-error" role="alert">
        <p>{message}</p>
      </div>
    )
  }

  if (!builder) {
    return <EmbedBuilderLoading message="Preparing builder…" />
  }

  if (!pdfUrl) {
    notifyEmbedParent('builder-error', {
      message:
        'This template has no PDF file yet. Close the editor and upload the document again.',
    })
    return (
      <div className="embed-error" role="alert">
        <p>This template has no PDF file yet. Close the editor and upload the document again.</p>
      </div>
    )
  }

  const profileScopeModal = builder.getProfileScopeModalState()

  return (
    <div className="embed-builder">
      <EmbedToolbar
        activeAssignRole={builder.activeAssignRole}
        fields={builder.document.fields}
        recipients={builder.document.recipients}
        sponsorRecipients={builder.sponsorRecipients}
        selectedSponsorEmail={builder.selectedSponsorEmail}
        canSaveTemplate={builder.canSaveTemplate}
        isSaving={builder.isSaving}
        onSelectAssignRole={builder.setSelectedRecipientRole}
        onSelectSponsor={builder.setSelectedSponsorEmail}
        onSaveTemplate={handleSaveTemplate}
      />

      <div className="embed-builder-layout">
        <div className="embed-builder-pdf-stage">
          <Suspense fallback={<EmbedBuilderLoading message="Loading PDF…" />}>
            <PdfCanvas
              documentId={id}
              fileUrl={document.fileUrl}
              title={document.title}
              pages={document.pages}
              selectedFieldType={builder.selectedFieldType}
              fields={builder.document.fields}
              getFieldColor={builder.getFieldColor}
              isFieldVisibleInPreview={builder.isFieldVisibleInPreview}
              onPlaceField={builder.placeField}
              onMoveField={builder.moveField}
              onResizeField={builder.resizeField}
              onRemoveField={builder.removeField}
              onAddChoiceOption={builder.addChoiceOption}
              onReuploadFile={(file) => uploadDocumentFile.mutateAsync(file)}
              isReuploading={uploadDocumentFile.isPending}
              canPlaceFields={builder.canPlaceFields}
              placementBlockedMessage={builder.placementBlockedMessage}
              activeProfileColor={builder.activeProfileColor}
              page={currentPage}
              onPageChange={setCurrentPage}
              onPdfReady={handlePdfReady}
            />
          </Suspense>
        </div>

        <FieldTypePanel
          activeProfileType={builder.activeProfileType}
          canUseProfilePreview={builder.canUseProfilePreview}
          previewProfileMode={builder.previewProfileMode}
          isProfilePreviewEnabled={builder.isProfilePreviewEnabled}
          selectedFieldType={builder.selectedFieldType}
          newFieldRequired={builder.newFieldRequired}
          fields={builder.document.fields}
          recipients={builder.document.recipients}
          getFieldColor={builder.getFieldColor}
          onSelectProfileType={builder.setSelectedProfileType}
          onProfilePreviewModeChange={builder.setPreviewProfileMode}
          onSelectFieldType={builder.setSelectedFieldType}
          onNewFieldRequiredChange={builder.setNewFieldRequired}
          onToggleFieldRequired={builder.setFieldRequired}
          onRemoveField={builder.removeField}
          onAddChoiceOption={builder.addChoiceOption}
          onUpdateFieldLabel={builder.updateFieldLabel}
          onEditFieldProfileScope={builder.openEditFieldProfileScope}
          isFieldVisible={builder.isFieldVisibleInPreview}
          partyLabel={builder.activeAssignRole === 'buyer' ? 'investor' : 'sponsor'}
        />
      </div>

      <ProfileScopeModal
        open={profileScopeModal !== null}
        mode={profileScopeModal?.mode ?? 'place'}
        fieldLabel={profileScopeModal?.fieldLabel ?? 'Field'}
        initialScope={profileScopeModal?.initialScope ?? 'all'}
        initialRequired={profileScopeModal?.initialRequired ?? true}
        onClose={builder.cancelProfileScope}
        onConfirm={builder.confirmProfileScope}
      />
    </div>
  )
}
