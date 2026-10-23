import type { RecipientRow } from './mappers';

export function isInvestorSponsorWorkflow(recipients: Pick<RecipientRow, 'role'>[]): boolean {
  const buyers = recipients.filter((recipient) => recipient.role === 'buyer');
  const sellers = recipients.filter((recipient) => recipient.role === 'seller');
  return buyers.length > 0 && sellers.length > 0;
}

export function getBuyers(recipients: RecipientRow[]): RecipientRow[] {
  return recipients.filter((recipient) => recipient.role === 'buyer');
}

export function getSeller(recipients: RecipientRow[]): RecipientRow | undefined {
  return recipients.find((recipient) => recipient.role === 'seller');
}

/** "Any sponsor" slot. Any seller may sign these fields until one signature is stored. */
export function isSharedSponsorRecipient(recipient: {
  role?: string | null;
  email?: string | null;
  name?: string | null;
}): boolean {
  const role = String(recipient.role ?? '').trim().toLowerCase();
  if (role !== 'seller' && !role.includes('sponsor')) return false;
  const email = String(recipient.email ?? '').trim().toLowerCase();
  const name = String(recipient.name ?? '').trim().toLowerCase();
  if (!email || email.endsWith('@embed.local')) return true;
  if (String(recipient.name ?? '').includes('\u2060')) return true;
  return name === 'anyone can sign' || name === 'any sponsor' || name === 'sponsor';
}
