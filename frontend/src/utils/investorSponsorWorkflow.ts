import type { Recipient } from '../types'

/** Corner mark on a placed field. */
export function fieldPartyMark(
  role: string | null | undefined,
): 'investor' | 'sponsor' | null {
  const value = String(role ?? '').trim().toLowerCase()
  if (value === 'buyer' || value.includes('investor')) return 'investor'
  if (value === 'seller' || value.includes('sponsor')) return 'sponsor'
  return null
}

/** True when the document uses investor (buyer) + sponsor (seller) roles. */
export function isInvestorSponsorWorkflow(
  recipients: Pick<Recipient, 'role'>[],
): boolean {
  const hasBuyer = recipients.some((recipient) => recipient.role === 'buyer')
  const hasSeller = recipients.some((recipient) => recipient.role === 'seller')
  return hasBuyer && hasSeller
}

/** "Any sponsor" slot. Any seller may sign these fields until one signature is stored. */
export function isSharedSponsorRecipient(
  recipient: Pick<Recipient, 'role' | 'email' | 'name'>,
): boolean {
  const role = recipient.role.trim().toLowerCase()
  if (role !== 'seller' && !role.includes('sponsor')) return false
  const email = recipient.email.trim().toLowerCase()
  const name = recipient.name.trim().toLowerCase()
  if (!email || email.endsWith('@embed.local')) return true
  if (recipient.name.includes('\u2060')) return true
  return name === 'anyone can sign' || name === 'any sponsor' || name === 'sponsor'
}

/** Name shown on a signature field when a specific sponsor is selected. */
export function namedSponsorLabel(
  recipient: Pick<Recipient, 'role' | 'email' | 'name'> | null | undefined,
): string | null {
  if (!recipient || isSharedSponsorRecipient(recipient)) return null
  const role = recipient.role.trim().toLowerCase()
  if (role !== 'seller' && !role.includes('sponsor')) return null
  const name = recipient.name.trim()
  if (name) return name
  const email = recipient.email.trim()
  return email || null
}
