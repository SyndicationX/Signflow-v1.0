import { useEffect, useRef, useState, type MouseEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import type { DocumentField, FieldType, ProfileType, Recipient } from '../types'
import { FIELD_TYPES, getAssignToLabel, getDefaultFieldSize, getProfileTypeColor, getProfileTypeStyle, getRecipientRoleColor, getRecipientRoleStyle, type ProfileScopeSelection } from '../constants/fieldTypes'
import {
  getNextRadioOptionLabel,
  getRadioGroupFields,
  getRadioGroupId,
} from '../utils/radioField'
import { getCheckboxColumnFields, getNextCheckboxOptionLabel } from '../utils/checkboxField'
import { placeNextChoiceOption, type ChoiceAddPlacement } from '../utils/choicePlacement'
import { fieldAppliesToProfile, getFieldProfileScope, getFieldProfileTypes } from '../utils/profileField'
import { fieldPartyMark, isInvestorSponsorWorkflow } from '../utils/investorSponsorWorkflow'
import { canSaveEmbedTemplate } from '../utils/embedTemplate'
import { EMBED_DEFAULT_RECIPIENTS } from '../constants/embedDefaults'
import { useUpdateDocument } from './useDocumentMutations'
import type { Document } from '../types'
import type { RecipientFormValues } from '../components/documents/RecipientFormModal'

export interface UseDocumentBuilderOptions {
  embedMode?: boolean
}

type RecipientModalState =
  | { mode: 'add' }
  | { mode: 'edit'; recipientId: string }
  | null

interface PendingFieldPlacement {
  x: number
  y: number
  page: number
  fieldLabel: string
}

function buildRecipient(
  values: RecipientFormValues,
  index: number,
  existing?: Recipient,
): Recipient {
  return {
    id: existing?.id ?? `rec_${Date.now()}`,
    name: values.name,
    email: values.email,
    role: values.role,
    color:
      existing && existing.role === values.role
        ? existing.color
        : getRecipientRoleColor(values.role, index),
    order: existing?.order ?? index + 1,
    ...(values.role === 'buyer'
      ? { profileType: values.profileType ?? existing?.profileType ?? 'individual' }
      : {}),
  }
}

export function useDocumentBuilder(
  document: Document | undefined,
  documentId: string,
  options?: UseDocumentBuilderOptions,
) {
  const embedMode = options?.embedMode ?? false
  const navigate = useNavigate()
  const updateDocument = useUpdateDocument(documentId)
  const [selectedFieldType, setSelectedFieldType] = useState<FieldType>('signature')
  const [newFieldRequired, setNewFieldRequired] = useState(true)
  const [selectedRecipientEmail, setSelectedRecipientEmail] = useState('')
  const [selectedAssignRole, setSelectedAssignRole] = useState<'buyer' | 'seller'>('buyer')
  const [selectedProfileType, setSelectedProfileType] = useState<ProfileType>('individual')
  const [previewProfileType, setPreviewProfileType] = useState<ProfileType>('individual')
  const [defaultProfileScope, setDefaultProfileScope] = useState<ProfileScopeSelection>('all')
  const [previewProfileMode, setPreviewProfileMode] = useState(false)
  const [pendingFieldPlacement, setPendingFieldPlacement] = useState<PendingFieldPlacement | null>(null)
  const [pendingCheckboxAdd, setPendingCheckboxAdd] = useState<{
    fieldId: string
    placement: ChoiceAddPlacement
    pageCount: number
  } | null>(null)
  const [editingFieldProfileId, setEditingFieldProfileId] = useState<string | null>(null)
  const [recipientModal, setRecipientModal] = useState<RecipientModalState>(null)
  const [choicePageFocus, setChoicePageFocus] = useState<{ page: number; seq: number } | null>(
    null,
  )
  const choicePageSeqRef = useRef(0)
  const hasPromptedFirstRecipient = useRef(false)
  const isSeedingEmbedRecipients = useRef(false)
  const previewProfileTouched = useRef(false)
  const latestFieldsRef = useRef<DocumentField[]>([])
  const latestRecipientsRef = useRef<Recipient[]>([])
  const layoutReadyRef = useRef(false)
  const revisionRef = useRef(0)
  const saveQueueRef = useRef<Promise<void>>(Promise.resolve())

  const persistLayout = (nextRecipients: Recipient[], nextFields: DocumentField[]) => {
    revisionRef.current += 1
    layoutReadyRef.current = true
    latestRecipientsRef.current = nextRecipients
    latestFieldsRef.current = nextFields
    const run = saveQueueRef.current.then(() => {
      const revisionAtStart = revisionRef.current
      return updateDocument
        .mutateAsync({
          recipients: latestRecipientsRef.current,
          fields: latestFieldsRef.current,
        })
        .then((saved) => {
          if (revisionRef.current !== revisionAtStart) return
          latestFieldsRef.current = saved.fields
          latestRecipientsRef.current = saved.recipients
          revisionRef.current = 0
        })
    })
    saveQueueRef.current = run.then(
      () => undefined,
      () => undefined,
    )
    return run
  }

  const flushPendingSave = () => saveQueueRef.current

  useEffect(() => {
    if (!document) return
    const fields = document.fields
    const recipients = document.recipients
    let cancelled = false
    void saveQueueRef.current.then(() => {
      if (cancelled || revisionRef.current !== 0) return
      const radioSize = getDefaultFieldSize('radio')
      const restored = fields.map((field) => {
        if (field.type !== 'radio' || field.width < 8) return field
        return { ...field, width: radioSize.width, height: radioSize.height }
      })
      const radiosRestored = restored.some(
        (field, index) =>
          field.width !== fields[index]?.width || field.height !== fields[index]?.height,
      )
      if (radiosRestored) {
        persistLayout(recipients, restored)
        return
      }
      latestFieldsRef.current = fields
      latestRecipientsRef.current = recipients
      layoutReadyRef.current = true
    })
    return () => {
      cancelled = true
    }
  }, [document])

  useEffect(() => {
    if (embedMode) return
    if (!document || document.recipients.length > 0 || hasPromptedFirstRecipient.current) return

    hasPromptedFirstRecipient.current = true
    setRecipientModal({ mode: 'add' })
  }, [document, embedMode])

  useEffect(() => {
    if (!embedMode || !document || isSeedingEmbedRecipients.current) return

    const hasBuyer = document.recipients.some((r) => r.role === 'buyer')
    const hasSeller = document.recipients.some((r) => r.role === 'seller')
    if (hasBuyer && hasSeller) return

    isSeedingEmbedRecipients.current = true
    const recipients = [...document.recipients]
    if (!hasBuyer) recipients.push(EMBED_DEFAULT_RECIPIENTS[0])
    if (!hasSeller) recipients.push(EMBED_DEFAULT_RECIPIENTS[1])
    void persistLayout(recipients, latestFieldsRef.current.length ? latestFieldsRef.current : document.fields)
  }, [document, embedMode, persistLayout])

  useEffect(() => {
    if (!document?.recipients.length) return

    const buyer = document.recipients.find((recipient) => recipient.role === 'buyer')
    if (buyer?.profileType && !previewProfileTouched.current) {
      setSelectedProfileType(buyer.profileType)
      setPreviewProfileType(buyer.profileType)
    }

    const seller = document.recipients.find((recipient) => recipient.role === 'seller')
    const roleRecipient = document.recipients.find((recipient) => recipient.role === selectedAssignRole)

    if (!roleRecipient) {
      const fallbackRole = buyer ? 'buyer' : seller ? 'seller' : selectedAssignRole
      setSelectedAssignRole(fallbackRole)
      const fallbackRecipient =
        fallbackRole === 'seller' ? seller : buyer ?? seller
      if (fallbackRecipient) setSelectedRecipientEmail(fallbackRecipient.email)
      return
    }

    const selectedStillExists = document.recipients.some(
      (recipient) => recipient.email === selectedRecipientEmail,
    )
    if (!selectedRecipientEmail || !selectedStillExists) {
      setSelectedRecipientEmail(roleRecipient.email)
    }
  }, [document?.recipients, selectedAssignRole, selectedRecipientEmail])

  if (!document) {
    return null
  }

  const recipients = document.recipients
  const roleRecipients = recipients.filter((recipient) => recipient.role === selectedAssignRole)
  const activeProfileRecipient =
    roleRecipients.find((recipient) => recipient.email === selectedRecipientEmail) ??
    roleRecipients[0]
  const activeRecipientId = activeProfileRecipient?.id ?? ''
  const canPlaceFields = Boolean(activeProfileRecipient)
  const placementBlockedMessage = canPlaceFields
    ? undefined
    : `Add an ${getAssignToLabel(selectedAssignRole)} recipient to place fields on the document.`

  const getRecipientColor = (recipientId: string) => {
    const recipient = recipients.find((r) => r.id === recipientId)
    if (!recipient) return '#64748b'
    return getRecipientRoleColor(recipient.role)
  }

  const isProfileTypeEnabled = selectedAssignRole === 'buyer'
  const usesInvestorSponsorWorkflow = isInvestorSponsorWorkflow(recipients)
  const canSaveTemplate = embedMode
    ? canSaveEmbedTemplate(document.fields, recipients)
    : false
  const canUseProfilePreview = embedMode
    ? usesInvestorSponsorWorkflow
    : recipients.some((recipient) => recipient.role === 'buyer')
  const isProfilePreviewEnabled = previewProfileMode && canUseProfilePreview
  const activeProfileColor = isProfilePreviewEnabled
    ? getProfileTypeColor(previewProfileType)
    : getRecipientRoleColor(selectedAssignRole)

  const getFieldColor = (field: DocumentField) => {
    const recipient = recipients.find((r) => r.id === field.recipientId)
    const party = fieldPartyMark(recipient?.role)
    if (party === 'investor') return '#dc2626'
    if (party === 'sponsor') return '#2563eb'
    const types = getFieldProfileTypes(field)
    if (types?.length === 1) {
      return getProfileTypeStyle(types[0]).color
    }
    if (!types?.length) {
      return '#64748b'
    }
    if (recipient?.color) return recipient.color
    return recipient ? getRecipientRoleStyle(recipient.role).color : '#64748b'
  }

  const isFieldVisibleInPreview = (field: DocumentField) => {
    const recipient = recipients.find((item) => item.id === field.recipientId)
    const fieldRole =
      recipient?.role === 'seller' ? 'seller' : recipient?.role === 'buyer' ? 'buyer' : null
    if (fieldRole !== selectedAssignRole) return false

    if (selectedAssignRole === 'buyer' && isProfilePreviewEnabled) {
      return fieldAppliesToProfile(field, previewProfileType)
    }

    return true
  }

  const handlePreviewProfileTypeChange = (profileType: ProfileType) => {
    previewProfileTouched.current = true
    setPreviewProfileType(profileType)
  }

  const normalizeFieldRecipientIds = (nextRecipients: Recipient[], nextFields: DocumentField[]) => {
    const soleRecipientId = nextRecipients.length === 1 ? nextRecipients[0].id : undefined

    return nextFields.map((field) => {
      if (nextRecipients.some((recipient) => recipient.id === field.recipientId)) {
        return field
      }

      const resolvedRecipientId =
        nextRecipients.find((recipient) => recipient.email === selectedRecipientEmail)?.id ??
        soleRecipientId

      if (resolvedRecipientId && field.recipientId.startsWith('rec_')) {
        return { ...field, recipientId: resolvedRecipientId }
      }

      return field
    })
  }

  const saveBuilderState = (nextRecipients: Recipient[], nextFields: DocumentField[]) => {
    void persistLayout(
      nextRecipients,
      normalizeFieldRecipientIds(nextRecipients, nextFields),
    )
  }

  const openAddRecipientModal = () => {
    setRecipientModal({ mode: 'add' })
  }

  const openEditRecipientModal = (recipientId: string) => {
    setRecipientModal({ mode: 'edit', recipientId })
  }

  const closeRecipientModal = () => {
    setRecipientModal(null)
  }

  const saveRecipient = (values: RecipientFormValues) => {
    if (recipientModal?.mode === 'edit') {
      const existing = recipients.find((recipient) => recipient.id === recipientModal.recipientId)
      if (!existing) return

      const nextRecipients = recipients.map((recipient, index) =>
        recipient.id === existing.id ? buildRecipient(values, index, existing) : recipient,
      )
      const updatedRecipient = nextRecipients.find((recipient) => recipient.id === existing.id)
      if (updatedRecipient?.profileType) {
        setSelectedProfileType(updatedRecipient.profileType)
      }
      saveBuilderState(nextRecipients, document.fields)
      closeRecipientModal()
      return
    }

    const newRecipient = buildRecipient(values, recipients.length)
    saveBuilderState([...recipients, newRecipient], document.fields)
    if (newRecipient.role === 'buyer' || newRecipient.role === 'seller') {
      setSelectedAssignRole(newRecipient.role)
    }
    if (newRecipient.profileType) {
      setSelectedProfileType(newRecipient.profileType)
    }
    setSelectedRecipientEmail(newRecipient.email)
    closeRecipientModal()
  }

  const getRecipientFormInitialValues = (): RecipientFormValues | undefined => {
    if (recipientModal?.mode === 'edit') {
      const recipient = recipients.find((item) => item.id === recipientModal.recipientId)
      if (!recipient) return undefined

      return {
        name: recipient.name,
        email: recipient.email,
        role: recipient.role,
        ...(recipient.role === 'buyer'
          ? { profileType: recipient.profileType ?? 'individual' }
          : {}),
      }
    }

    if (recipientModal?.mode === 'add') {
      return {
        name: '',
        email: '',
        role: selectedAssignRole,
        ...(selectedAssignRole === 'buyer' ? { profileType: selectedProfileType } : {}),
      }
    }

    return undefined
  }

  const createFieldAt = (
    placement: PendingFieldPlacement,
    profileScope: ProfileScopeSelection,
    required: boolean,
  ) => {
    if (!activeProfileRecipient) return

    const recipientId = activeProfileRecipient.id
    const { width, height } = getDefaultFieldSize(selectedFieldType)
    const fieldId = `f_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
    const choiceGroupId =
      selectedFieldType === 'radio'
        ? `rg_${fieldId}`
        : selectedFieldType === 'checkbox'
          ? `cg_${fieldId}`
          : undefined
    const profileTypes =
      selectedAssignRole === 'buyer' && profileScope !== 'all' ? profileScope : undefined

    const newField: DocumentField = {
      id: fieldId,
      type: selectedFieldType,
      label:
        selectedFieldType === 'radio'
          ? 'Option 1'
          : selectedFieldType === 'checkbox'
            ? 'Checkbox 1'
            : FIELD_TYPES.find((f) => f.type === selectedFieldType)?.label || selectedFieldType,
      x: placement.x,
      y: placement.y,
      width,
      height,
      page: placement.page,
      recipientId,
      required,
      ...(profileTypes ? { profileTypes } : {}),
      ...(choiceGroupId ? { radioGroupId: choiceGroupId } : {}),
    }

    saveBuilderState(recipients, [...document.fields, newField])
  }

  const placeField = (event: MouseEvent<HTMLDivElement>, page: number) => {
    if (recipients.length === 0 || !activeProfileRecipient) {
      openAddRecipientModal()
      return
    }

    const rect = event.currentTarget.getBoundingClientRect()
    const clickX = ((event.clientX - rect.left) / rect.width) * 100
    const clickY = ((event.clientY - rect.top) / rect.height) * 100
    const { width, height } = getDefaultFieldSize(selectedFieldType)
    const fieldLabel =
      selectedFieldType === 'radio'
        ? 'Radio option'
        : FIELD_TYPES.find((f) => f.type === selectedFieldType)?.label || selectedFieldType

    const placement: PendingFieldPlacement = {
      x: Math.max(0, Math.min(clickX - width / 2, 100 - width)),
      y: Math.max(0, Math.min(clickY - height / 2, 100 - height)),
      page,
      fieldLabel,
    }

    if (selectedAssignRole === 'buyer') {
      setPendingFieldPlacement(placement)
      return
    }

    createFieldAt(placement, 'all', newFieldRequired)
  }

  const applyProfileScopeToField = (
    field: DocumentField,
    scope: ProfileScopeSelection,
  ): DocumentField => {
    const { profileType: _legacy, profileTypes: _existing, ...rest } = field
    if (scope === 'all') {
      return rest as DocumentField
    }
    return { ...rest, profileTypes: scope }
  }

  const updateFieldsProfileScope = (
    fieldId: string,
    scope: ProfileScopeSelection,
    required: boolean,
  ) => {
    const field = document.fields.find((item) => item.id === fieldId)
    if (!field) return

    const groupId = getRadioGroupId(field, document.fields)

    const nextFields = document.fields.map((item) => {
      const isTarget = item.id === fieldId
      const isSameRadioGroup =
        groupId && item.type === 'radio' && getRadioGroupId(item, document.fields) === groupId

      if (!isTarget && !isSameRadioGroup) {
        return item
      }

      return { ...applyProfileScopeToField(item, scope), required }
    })

    saveBuilderState(recipients, nextFields)
  }

  const confirmProfileScope = (scope: ProfileScopeSelection, required: boolean) => {
    setNewFieldRequired(required)
    if (pendingCheckboxAdd) {
      appendCheckboxFromPlus(pendingCheckboxAdd, scope, required)
      setPendingCheckboxAdd(null)
      return
    }
    if (editingFieldProfileId) {
      updateFieldsProfileScope(editingFieldProfileId, scope, required)
      setEditingFieldProfileId(null)
      return
    }

    if (!pendingFieldPlacement) return

    setDefaultProfileScope(scope)
    createFieldAt(pendingFieldPlacement, scope, required)
    setPendingFieldPlacement(null)
  }

  const cancelProfileScope = () => {
    setPendingFieldPlacement(null)
    setPendingCheckboxAdd(null)
    setEditingFieldProfileId(null)
  }

  const openEditFieldProfileScope = (fieldId: string) => {
    setEditingFieldProfileId(fieldId)
  }

  const getProfileScopeModalState = () => {
    if (pendingCheckboxAdd) {
      const field = document.fields.find((item) => item.id === pendingCheckboxAdd.fieldId)
      return {
        mode: 'place' as const,
        fieldLabel: 'Checkbox',
        initialScope: field ? getFieldProfileScope(field) : 'all',
        initialRequired: field ? field.required !== false : true,
      }
    }

    if (pendingFieldPlacement) {
      return {
        mode: 'place' as const,
        fieldLabel: pendingFieldPlacement.fieldLabel,
        initialScope: defaultProfileScope,
        initialRequired: newFieldRequired,
      }
    }

    if (editingFieldProfileId) {
      const field = document.fields.find((item) => item.id === editingFieldProfileId)
      if (!field) {
        return null
      }
      return {
        mode: 'edit' as const,
        fieldLabel: field.label,
        initialScope: getFieldProfileScope(field),
        initialRequired: field.required !== false,
      }
    }

    return null
  }

  const moveField = (fieldId: string, x: number, y: number) => {
    const nextFields = document.fields.map((field) =>
      field.id === fieldId
        ? {
            ...field,
            x: Math.max(0, Math.min(x, 100 - field.width)),
            y: Math.max(0, Math.min(y, 100 - field.height)),
          }
        : field,
    )
    saveBuilderState(recipients, nextFields)
  }

  const resizeField = (fieldId: string, width: number, height: number) => {
    const nextFields = document.fields.map((field) =>
      field.id === fieldId
        ? {
            ...field,
            width: Math.max(3, Math.min(width, 100 - field.x)),
            height: Math.max(2, Math.min(height, 100 - field.y)),
          }
        : field,
    )
    saveBuilderState(recipients, nextFields)
  }

  const setFieldRequired = (fieldId: string, required: boolean) => {
    const field = document.fields.find((item) => item.id === fieldId)
    const groupId = field ? getRadioGroupId(field, document.fields) : undefined

    const nextFields = document.fields.map((item) => {
      if (groupId && item.type === 'radio' && getRadioGroupId(item, document.fields) === groupId) {
        return { ...item, required }
      }
      if (item.id === fieldId) return { ...item, required }
      return item
    })
    saveBuilderState(recipients, nextFields)
  }

  const updateFieldLabel = (fieldId: string, label: string) => {
    const nextFields = document.fields.map((field) =>
      field.id === fieldId ? { ...field, label } : field,
    )
    saveBuilderState(recipients, nextFields)
  }

  const fieldsNow = () =>
    layoutReadyRef.current ? latestFieldsRef.current : document.fields
  const recipientsNow = () =>
    layoutReadyRef.current ? latestRecipientsRef.current : recipients

  const removeField = (fieldId: string) => {
    saveBuilderState(
      recipientsNow(),
      fieldsNow().filter((field) => field.id !== fieldId),
    )
  }

  const appendCheckboxFromPlus = (
    pending: { fieldId: string; placement: ChoiceAddPlacement; pageCount: number },
    scope: ProfileScopeSelection,
    required: boolean,
  ) => {
    let fields = fieldsNow()
    const source = fields.find((field) => field.id === pending.fieldId)
    if (!source || source.type !== 'checkbox') return

    let groupId = source.radioGroupId?.trim()
    if (!groupId) {
      groupId = `cg_${source.id}`
      fields = fields.map((field) =>
        field.id === source.id ? { ...field, radioGroupId: groupId } : field,
      )
    }

    const groupedSource = fields.find((field) => field.id === source.id) ?? source
    const siblings = getCheckboxColumnFields(fields, groupedSource)
    const fallbackSize = getDefaultFieldSize('checkbox')
    const width = source.width > 0 ? source.width : fallbackSize.width
    const height = source.height > 0 ? source.height : fallbackSize.height
    const slot = placeNextChoiceOption({
      siblings,
      source: groupedSource,
      width,
      height,
      pageCount: pending.pageCount,
      placement: pending.placement,
    })
    const profileTypes = scope === 'all' ? undefined : scope
    const newField: DocumentField = {
      id: `f_${Date.now()}`,
      type: 'checkbox',
      label: getNextCheckboxOptionLabel(siblings),
      x: slot.x,
      y: slot.y,
      width,
      height,
      page: slot.page,
      recipientId: source.recipientId,
      required,
      ...(profileTypes ? { profileTypes } : {}),
      radioGroupId: groupId,
    }

    choicePageSeqRef.current += 1
    setChoicePageFocus({ page: slot.page, seq: choicePageSeqRef.current })
    saveBuilderState(recipientsNow(), [...fields, newField])
  }

  /** Add another radio option or checkbox in the same group, on this page or the next one. */
  const addChoiceOption = (
    fieldId: string,
    options?: { pageCount?: number; placement?: ChoiceAddPlacement },
  ) => {
    let fields = fieldsNow()
    const source = fields.find((field) => field.id === fieldId)
    if (!source) return
    if (source.type === 'checkbox') {
      setPendingFieldPlacement(null)
      setEditingFieldProfileId(null)
      setPendingCheckboxAdd({
        fieldId,
        placement: options?.placement ?? 'below',
        pageCount: Math.max(1, options?.pageCount ?? document?.pages ?? 1),
      })
      return
    }
    if (source.type !== 'radio') return

    let groupId = source.radioGroupId?.trim()
    if (!groupId) {
      groupId = source.type === 'radio' ? `rg_${source.id}` : `cg_${source.id}`
      fields = fields.map((field) =>
        field.id === source.id ? { ...field, radioGroupId: groupId } : field,
      )
    }

    const groupedSource = fields.find((field) => field.id === source.id) ?? source
    const siblings =
      source.type === 'radio'
        ? getRadioGroupFields(fields, groupId!)
        : getCheckboxColumnFields(fields, groupedSource)
    const fallbackSize = getDefaultFieldSize(source.type)
    const width = source.width > 0 ? source.width : fallbackSize.width
    const height = source.height > 0 ? source.height : fallbackSize.height
    const slot = placeNextChoiceOption({
      siblings,
      source: groupedSource,
      width,
      height,
      pageCount: Math.max(1, options?.pageCount ?? document?.pages ?? 1),
      placement: options?.placement ?? 'below',
    })

    const newField: DocumentField = {
      id: `f_${Date.now()}`,
      type: source.type,
      label:
        source.type === 'radio'
          ? getNextRadioOptionLabel(fields, groupId!)
          : getNextCheckboxOptionLabel(siblings),
      x: slot.x,
      y: slot.y,
      width,
      height,
      page: slot.page,
      recipientId: source.recipientId,
      required: source.required,
      profileTypes: source.profileTypes,
      profileType: source.profileType,
      ...(groupId ? { radioGroupId: groupId } : {}),
    }

    choicePageSeqRef.current += 1
    setChoicePageFocus({ page: slot.page, seq: choicePageSeqRef.current })
    saveBuilderState(recipientsNow(), [...fields, newField])
  }

  const removeRecipient = (recipientId: string) => {
    if (recipients.length <= 1) return

    const nextRecipients = recipients.filter((r) => r.id !== recipientId)
    const nextFields = document.fields.filter((field) => field.recipientId !== recipientId)

    if (activeRecipientId === recipientId) {
      const nextRoleRecipient = nextRecipients.find(
        (recipient) => recipient.role === selectedAssignRole,
      )
      setSelectedRecipientEmail(nextRoleRecipient?.email ?? nextRecipients[0]?.email ?? '')
    }

    saveBuilderState(nextRecipients, nextFields)
  }

  const setSelectedRecipientId = (recipientId: string) => {
    const recipient = recipients.find((item) => item.id === recipientId)
    if (recipient) setSelectedRecipientEmail(recipient.email)
  }

  const setSelectedRecipientRole = (role: 'buyer' | 'seller') => {
    setSelectedAssignRole(role)
    const matches = recipients.filter((item) => item.role === role)
    const current = matches.find((item) => item.email === selectedRecipientEmail)
    const recipient = current ?? matches[0]
    if (recipient) setSelectedRecipientEmail(recipient.email)
  }

  const setSelectedSponsorEmail = (email: string) => {
    const sponsor = recipients.find(
      (item) => item.role === 'seller' && item.email === email,
    )
    if (!sponsor) return
    setSelectedAssignRole('seller')
    setSelectedRecipientEmail(sponsor.email)
  }

  return {
    document,
    selectedFieldType,
    setSelectedFieldType,
    newFieldRequired,
    setNewFieldRequired,
    setFieldRequired,
    activeRecipientId,
    activeAssignRole: selectedAssignRole,
    sponsorRecipients: recipients.filter((recipient) => recipient.role === 'seller'),
    selectedSponsorEmail: selectedRecipientEmail,
    setSelectedSponsorEmail,
    isProfileTypeEnabled,
    canUseProfilePreview,
    previewProfileMode,
    setPreviewProfileMode,
    isProfilePreviewEnabled,
    activeProfileType: previewProfileType,
    activeProfileColor,
    setSelectedProfileType: handlePreviewProfileTypeChange,
    pendingFieldPlacement,
    editingFieldProfileId,
    defaultProfileScope,
    getProfileScopeModalState,
    confirmProfileScope,
    cancelProfileScope,
    openEditFieldProfileScope,
    isFieldVisibleInPreview,
    canPlaceFields,
    placementBlockedMessage,
    canSaveTemplate,
    setSelectedRecipientId,
    setSelectedRecipientRole,
    recipientModal,
    openAddRecipientModal,
    openEditRecipientModal,
    closeRecipientModal,
    saveRecipient,
    getRecipientFormInitialValues,
    removeRecipient,
    placeField,
    moveField,
    resizeField,
    removeField,
    flushPendingSave,
    addChoiceOption,
    choicePageFocus,
    updateFieldLabel,
    getRecipientColor,
    getFieldColor,
    navigate,
    isSaving: updateDocument.isPending,
  }
}
