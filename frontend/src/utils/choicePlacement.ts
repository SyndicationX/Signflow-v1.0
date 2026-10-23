import type { DocumentField } from '../types'

const STACK_GAP = 0.5
const NEXT_PAGE_TOP = 2

export interface ChoiceSlot {
  x: number
  y: number
  page: number
}

export type ChoiceAddPlacement = 'below' | 'nextPage'

/** True for the lowest option of this group on its page, where "Next page" is shown. */
export function isLastChoiceOnPage(field: DocumentField, fields: DocumentField[]): boolean {
  if (field.type !== 'radio' && field.type !== 'checkbox') return false
  const groupId = field.radioGroupId?.trim() || field.id
  let tail = field
  for (const item of fields) {
    if (item.type !== field.type || item.page !== field.page) continue
    if (item.recipientId !== field.recipientId) continue
    if ((item.radioGroupId?.trim() || item.id) !== groupId) continue
    if (item.y > tail.y || (item.y === tail.y && item.x > tail.x)) tail = item
  }
  return tail.id === field.id
}

function stackOnPage(params: {
  siblings: DocumentField[]
  source: DocumentField
  page: number
  width: number
  height: number
  emptyY: number
}): ChoiceSlot {
  const { siblings, source, page, width, height, emptyY } = params
  const onPage = siblings.filter((field) => field.page === page)
  if (onPage.length === 0) {
    return {
      x: Math.max(0, Math.min(source.x, 100 - width)),
      y: Math.max(0, Math.min(emptyY, 100 - height)),
      page,
    }
  }

  const tail = onPage.reduce((best, field) =>
    field.y + field.height > best.y + best.height ? field : best,
  )
  const below = tail.y + tail.height + STACK_GAP
  const x = Math.max(0, Math.min(tail.x, 100 - width))
  if (below + height <= 100) return { x, y: below, page }
  return { x, y: Math.max(0, 100 - height), page }
}

/**
 * Add a radio or checkbox in the same group.
 * "below" stays on this page. "nextPage" starts the group on the following page.
 */
export function placeNextChoiceOption(params: {
  siblings: DocumentField[]
  source: DocumentField
  width: number
  height: number
  pageCount: number
  placement?: ChoiceAddPlacement
}): ChoiceSlot {
  const { siblings, source, width, height, pageCount } = params
  const maxPage = Math.max(1, pageCount)
  const sourcePage = Math.min(Math.max(1, source.page), maxPage)

  if (params.placement === 'nextPage' && sourcePage < maxPage) {
    return stackOnPage({
      siblings,
      source,
      page: sourcePage + 1,
      width,
      height,
      emptyY: NEXT_PAGE_TOP,
    })
  }

  return stackOnPage({
    siblings,
    source,
    page: sourcePage,
    width,
    height,
    emptyY: source.y + source.height + STACK_GAP,
  })
}
