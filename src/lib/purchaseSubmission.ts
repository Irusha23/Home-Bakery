import type { PurchaseRecord } from "../types"

export type RecordPurchaseAction = {
  type: "RECORD_PURCHASE"

  purchase: PurchaseRecord
}

export function submitPurchaseIfAccepted<Action>(
  action: Action,

  dispatchIfAccepted: (action: Action) => boolean,

  onAccepted: () => void,
): boolean {
  const accepted = dispatchIfAccepted(action)

  if (accepted) onAccepted()

  return accepted
}
