import {
  formatDate,
  formatLkr,
  formatQuantity,
  formatTime,
  getColomboTodayIso,
} from "../format"
import { FINANCIAL_REPORT_TIME_ZONE } from "../financialReports"
import { outstandingOrderBalance } from "../financials"
import { selectMonthlyBudgetReport } from "../budget"
import { selectManualShoppingList } from "../inventory"
import type {
  AppData,
  Order,
  PreparationRecord,
  StarterAction,
  TabId,
} from "../../types"

export { getColomboTodayIso }

export type TodayGreeting = {
  greeting: string
  subtitle: string
  todayIso: string
}

export type TodayHeroItem = {
  kind: "prep-in-progress" | "prep-todo" | "ready-collection"
  order: Order
  preparationRecord?: PreparationRecord
  itemTitle: string
  customerName: string
  dueLabel: string
  statusLabel: string
  ctaLabel: string
}

export type TodayWorkload = {
  dueTodayCount: number
  inProgressCount: number
  readyCount: number
  shortagesCount: number
}

export type UpcomingCollectionItem = {
  orderId: string
  reference: string
  customerName: string
  itemSummary: string
  collectionDate: string
  collectionTime: string
  timeLabel: string
  status: Order["status"]
  preparationStatus: Order["preparationStatus"]
  agreedPrice: number
  isOverdue: boolean
  isToday: boolean
}

export type AttentionItem = {
  id: string
  kind: "shortage" | "low-stock" | "order-due" | "payment-due" | "budget-over" | "backup"
  tone: "warning" | "sage"
  title: string
  detail: string
  targetTab: TabId
  starterAction?: StarterAction
  orderId?: string
}

function getColomboHour(now = new Date()): number {
  const hourStr = new Intl.DateTimeFormat("en-GB", {
    timeZone: FINANCIAL_REPORT_TIME_ZONE,
    hour: "numeric",
    hour12: false,
  }).format(now)
  const parsed = Number(hourStr)
  return Number.isFinite(parsed) ? parsed : 9
}

export function selectGreeting(
  state: AppData,
  now = new Date(),
): TodayGreeting {
  const todayIso = getColomboTodayIso(now)
  const hour = getColomboHour(now)
  const periodGreeting =
    hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening"
  const owner = state.settings.ownerName.trim()
  const greeting = owner ? `${periodGreeting}, ${owner}` : periodGreeting

  const workload = selectWorkload(state, todayIso)
  const parts: string[] = []
  if (workload.dueTodayCount > 0) {
    parts.push(
      `${workload.dueTodayCount} ${
        workload.dueTodayCount === 1 ? "order" : "orders"
      } due today`,
    )
  }
  if (workload.shortagesCount > 0) {
    parts.push(
      `${workload.shortagesCount} ${
        workload.shortagesCount === 1 ? "item" : "items"
      } to buy`,
    )
  }
  const subtitle =
    parts.length > 0 ? parts.join(" · ") : "No urgent deadlines right now"

  return {
    greeting,
    subtitle,
    todayIso,
  }
}

function isActiveOrder(order: Order): boolean {
  return (
    order.status !== "Draft" &&
    order.status !== "Completed" &&
    order.status !== "Cancelled"
  )
}

function compareCollectionSchedule(a: Order, b: Order): number {
  const keyA = `${a.collectionDate}T${a.collectionTime || "23:59"}`
  const keyB = `${b.collectionDate}T${b.collectionTime || "23:59"}`
  return keyA.localeCompare(keyB)
}

function formatShortDate(date: string): string {
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return "Date not set"
  const parsed = new Date(`${date}T00:00:00+05:30`)
  if (!Number.isFinite(parsed.getTime())) return "Date not set"
  return new Intl.DateTimeFormat("en-LK", {
    timeZone: FINANCIAL_REPORT_TIME_ZONE,
    day: "numeric",
    month: "short",
  }).format(parsed)
}

function formatDueRelative(order: Order, todayIso: string): string {
  if (!order.collectionDate) {
    return `Date not set · ${formatTime(order.collectionTime)}`
  }
  if (order.collectionDate < todayIso) {
    return `Overdue · ${formatShortDate(order.collectionDate)} · ${formatTime(order.collectionTime)}`
  }
  if (order.collectionDate === todayIso) {
    return `Today · ${formatTime(order.collectionTime)}`
  }
  return `${formatShortDate(order.collectionDate)} · ${formatTime(order.collectionTime)}`
}

function summarizeOrderLines(order: Order): string {
  const firstLine = order.lines[0]
  if (!firstLine) return "Custom order"
  const extraCount = order.lines.length - 1
  const base = `${firstLine.productName}${
    firstLine.variantName ? ` · ${firstLine.variantName}` : ""
  }`
  return extraCount > 0 ? `${base} (+${extraCount} more)` : base
}

export function selectNextUp(
  state: AppData,
  now = new Date(),
): TodayHeroItem | null {
  const todayIso = getColomboTodayIso(now)
  const activeOrders = state.orders
    .filter(isActiveOrder)
    .sort(compareCollectionSchedule)

  if (activeOrders.length === 0) return null

  const orderById = new Map(activeOrders.map((order) => [order.id, order]))

  const inProgressRecords = state.preparationRecords
    .filter(
      (record) =>
        record.status === "In progress" && orderById.has(record.orderId),
    )
    .sort((a, b) => {
      const orderA = orderById.get(a.orderId)!
      const orderB = orderById.get(b.orderId)!
      return compareCollectionSchedule(orderA, orderB)
    })

  if (inProgressRecords.length > 0) {
    const record = inProgressRecords[0]
    const order = orderById.get(record.orderId)!
    const line = order.lines.find((item) => item.id === record.orderLineId)
    return {
      kind: "prep-in-progress",
      order,
      preparationRecord: record,
      itemTitle: line
        ? `${line.productName} · ${line.variantName}`
        : summarizeOrderLines(order),
      customerName: order.customerName,
      dueLabel: formatDueRelative(order, todayIso),
      statusLabel: "In progress",
      ctaLabel: "Continue prep",
    }
  }

  const unreadyOrder = activeOrders.find(
    (order) => order.preparationStatus !== "Ready",
  )
  if (unreadyOrder) {
    const nextRecord = state.preparationRecords.find(
      (record) =>
        record.orderId === unreadyOrder.id && record.status !== "Ready",
    )
    return {
      kind: "prep-todo",
      order: unreadyOrder,
      preparationRecord: nextRecord,
      itemTitle: summarizeOrderLines(unreadyOrder),
      customerName: unreadyOrder.customerName,
      dueLabel: formatDueRelative(unreadyOrder, todayIso),
      statusLabel: "Needs prep",
      ctaLabel: "Start prep",
    }
  }

  const readyOrder = activeOrders[0]
  return {
    kind: "ready-collection",
    order: readyOrder,
    itemTitle: summarizeOrderLines(readyOrder),
    customerName: readyOrder.customerName,
    dueLabel: formatDueRelative(readyOrder, todayIso),
    statusLabel: "Ready",
    ctaLabel: "View order",
  }
}

export function selectWorkload(
  state: AppData,
  todayIso = getColomboTodayIso(new Date()),
): TodayWorkload {
  const activeOrders = state.orders.filter(isActiveOrder)
  const dueTodayCount = activeOrders.filter(
    (order) => order.collectionDate === todayIso,
  ).length
  const inProgressCount = activeOrders.filter(
    (order) =>
      order.preparationStatus === "In progress" ||
      (order.status === "In Progress" && order.preparationStatus !== "Ready"),
  ).length
  const readyCount = activeOrders.filter(
    (order) => order.preparationStatus === "Ready",
  ).length
  const shoppingItems = selectManualShoppingList(state)
  const shortagesCount = shoppingItems.length

  return {
    dueTodayCount,
    inProgressCount,
    readyCount,
    shortagesCount,
  }
}

export function selectUpcomingCollections(
  state: AppData,
  todayIso = getColomboTodayIso(new Date()),
  limit = 4,
): UpcomingCollectionItem[] {
  return state.orders
    .filter(isActiveOrder)
    .sort(compareCollectionSchedule)
    .slice(0, limit)
    .map((order) => ({
      orderId: order.id,
      reference: order.reference,
      customerName: order.customerName,
      itemSummary: summarizeOrderLines(order),
      collectionDate: order.collectionDate,
      collectionTime: order.collectionTime,
      timeLabel:
        order.collectionDate === todayIso
          ? `Today · ${formatTime(order.collectionTime)}`
          : `${formatDate(order.collectionDate)} · ${formatTime(order.collectionTime)}`,
      status: order.status,
      preparationStatus: order.preparationStatus,
      agreedPrice: order.agreedPrice,
      isOverdue: Boolean(order.collectionDate) && order.collectionDate < todayIso,
      isToday: Boolean(order.collectionDate) && order.collectionDate === todayIso,
    }))
}

export function selectAttentionItems(
  state: AppData,
  now = new Date(),
): AttentionItem[] {
  const todayIso = getColomboTodayIso(now)
  const items: AttentionItem[] = []

  const shoppingItems = selectManualShoppingList(state)
  for (const item of shoppingItems) {
    items.push({
      id: `shortage-${item.inventoryId}`,
      kind: "shortage",
      tone: "warning",
      title: `Buy ${item.name}`,
      detail:
        item.orders.length > 0
          ? `Need ${formatQuantity(item.neededQuantity, item.unit)} for ${item.orders.length} ${
              item.orders.length === 1 ? "order" : "orders"
            }`
          : `Need ${formatQuantity(item.neededQuantity, item.unit)}`,
      targetTab: "kitchen",
      starterAction: "plan-shopping",
    })
  }

  for (const order of state.orders) {
    if (
      isActiveOrder(order) &&
      Boolean(order.collectionDate) &&
      order.collectionDate <= todayIso &&
      order.preparationStatus !== "Ready"
    ) {
      items.push({
        id: `due-${order.id}`,
        kind: "order-due",
        tone: order.collectionDate < todayIso ? "warning" : "sage",
        title:
          order.collectionDate < todayIso
            ? `${order.customerName}’s order is overdue`
            : `${order.customerName} collects today at ${formatTime(order.collectionTime)}`,
        detail: `${order.reference} · ${summarizeOrderLines(order)}`,
        targetTab: "orders",
        orderId: order.id,
      })
    }
  }

  for (const order of state.orders) {
    if (
      order.status === "Completed" ||
      (isActiveOrder(order) && order.paymentStatus === "Part paid")
    ) {
      const balance = outstandingOrderBalance(order, state.refunds)
      if (balance > 0) {
        items.push({
          id: `unpaid-${order.id}`,
          kind: "payment-due",
          tone: "warning",
          title:
            order.status === "Completed"
              ? `Payment pending from ${order.customerName}`
              : `Part paid · ${order.customerName}`,
          detail: `${order.reference} · ${formatLkr(balance)} balance due`,
          targetTab: "orders",
          orderId: order.id,
        })
      }
    }
  }

  const lastBackupMs = state.settings.lastBackupAt
    ? Date.parse(state.settings.lastBackupAt)
    : null
  const snoozedUntilMs = state.settings.backupReminderSnoozedUntil
    ? Date.parse(state.settings.backupReminderSnoozedUntil)
    : null
  const sevenDaysMs = 7 * 24 * 60 * 60 * 1000
  const isSnoozed =
    snoozedUntilMs !== null &&
    Number.isFinite(snoozedUntilMs) &&
    snoozedUntilMs > now.getTime()
  const needsBackup =
    !state.settings.backupReminderDismissedAt &&
    !isSnoozed &&
    (state.orders.length > 0 ||
      state.purchases.length > 0 ||
      state.expenses.length > 0) &&
    (lastBackupMs === null || now.getTime() - lastBackupMs > sevenDaysMs)

  if (needsBackup) {
    items.push({
      id: "backup-reminder",
      kind: "backup",
      tone: "sage",
      title: "Back up your bakery data",
      detail:
        "Save a copy of your orders, recipes, and accounts to your device.",
      targetTab: "today",
    })
  }

  const budgetReport = selectMonthlyBudgetReport(state, now)
  for (const alert of budgetReport.overLimitAlerts) {
    items.push({
      id: alert.id,
      kind: "budget-over",
      tone: "warning",
      title: `${alert.label} over monthly budget`,
      detail: `Spent ${formatLkr(alert.spent)} vs ${formatLkr(alert.limit)} limit`,
      targetTab: "money",
    })
  }

  return items
}
