import { useEffect, useState } from "react"
import { Capacitor } from "@capacitor/core"
import { Share } from "@capacitor/share"
import {
  BellOff,
  Download,
  RefreshCw,
  RotateCcw,
  Save,
  Share2,
  ShieldAlert,
} from "lucide-react"
import BackupRestorePanel from "../components/BackupRestorePanel"
import ScreenHeader from "../components/ScreenHeader"
import Button from "../components/ui/Button"
import Card from "../components/ui/Card"
import Dialog from "../components/ui/Dialog"
import Field from "../components/ui/Field"
import { GroupedList, ListRow } from "../components/ui/GroupedList"
import SegmentedControl from "../components/ui/SegmentedControl"
import SelectField from "../components/ui/SelectField"
import { useToast } from "../components/ui/Toast"
import {
  APP_BUILD_CODE,
  APP_VERSION,
  checkForAppUpdate,
  type UpdateCheckResult,
} from "../lib/appVersion"
import { LATEST_DB_SCHEMA_VERSION } from "../db/migrator"
import { formatDate, formatLkr } from "../lib/format"
import { calculateSuggestedPrice } from "../lib/pricing"
import { useAppState } from "../state/AppState"
import type { PricingMode } from "../types"

type SettingsScreenProps = {
  onBack: () => void
}

export default function SettingsScreen({ onBack }: SettingsScreenProps) {
  const {
    state,
    dispatch,
    dispatchIfAccepted,
    restoreBackupFromRaw,
    storageInfo,
  } = useAppState()
  const { showToast } = useToast()

  const [businessName, setBusinessName] = useState(state.settings.businessName)
  const [ownerName, setOwnerName] = useState(state.settings.ownerName)
  const [labourRate, setLabourRate] = useState(
    String(state.settings.defaultLabourRatePerHour),
  )
  const [pricingMode, setPricingMode] = useState<PricingMode>(
    state.settings.defaultPricingMode,
  )
  const [marginPercent, setMarginPercent] = useState(
    String(state.settings.defaultMarginPercent),
  )
  const [markupPercent, setMarkupPercent] = useState(
    String(state.settings.defaultMarkupPercent),
  )
  const [roundingStep, setRoundingStep] = useState<1 | 50 | 100>(
    state.settings.priceRoundingStep,
  )
  const [error, setError] = useState("")
  const [resetMode, setResetMode] = useState<"empty" | "starter" | null>(null)
  const [checkingUpdate, setCheckingUpdate] = useState(false)
  const [updateResult, setUpdateResult] = useState<UpdateCheckResult | null>(
    null,
  )

  const handleCheckUpdate = async () => {
    if (checkingUpdate) return
    setCheckingUpdate(true)
    const result = await checkForAppUpdate()
    setCheckingUpdate(false)
    setUpdateResult(result)
    if (result.status === "up-to-date") {
      showToast({
        message: `You're on the latest version (v${result.currentVersion})`,
        tone: "success",
      })
    }
  }

  useEffect(() => {
    setBusinessName(state.settings.businessName)
    setOwnerName(state.settings.ownerName)
    setLabourRate(String(state.settings.defaultLabourRatePerHour))
    setPricingMode(state.settings.defaultPricingMode)
    setMarginPercent(String(state.settings.defaultMarginPercent))
    setMarkupPercent(String(state.settings.defaultMarkupPercent))
    setRoundingStep(state.settings.priceRoundingStep)
  }, [state.settings])

  const handleSaveSettings = () => {
    const trimmedBusiness = businessName.trim()
    if (!trimmedBusiness) {
      setError("Business name cannot be blank.")
      return
    }
    const parsedLabour = Number(labourRate)
    const parsedMargin = Number(marginPercent)
    const parsedMarkup = Number(markupPercent)

    if (!Number.isFinite(parsedLabour) || parsedLabour < 0) {
      setError("Labour rate per hour must be 0 or greater.")
      return
    }
    if (
      !Number.isFinite(parsedMargin) ||
      parsedMargin < 0 ||
      parsedMargin >= 100
    ) {
      setError("Default margin % must be between 0 and 99.9.")
      return
    }
    if (!Number.isFinite(parsedMarkup) || parsedMarkup < 0) {
      setError("Default markup % must be 0 or greater.")
      return
    }

    const accepted = dispatchIfAccepted({
      type: "UPDATE_SETTINGS",
      patch: {
        businessName: trimmedBusiness,
        ownerName: ownerName.trim(),
        defaultLabourRatePerHour: Math.round(parsedLabour),
        defaultPricingMode: pricingMode,
        defaultMarginPercent: parsedMargin,
        defaultMarkupPercent: parsedMarkup,
        priceRoundingStep: roundingStep,
      },
    })

    if (!accepted) {
      setError("Settings could not be saved. Review the values and try again.")
      return
    }
    setError("")
    showToast({ message: "Settings saved", tone: "success" })
  }

  const snoozeReminder = () => {
    const until = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
    dispatch({
      type: "UPDATE_SETTINGS",
      patch: {
        backupReminderSnoozedUntil: until,
        backupReminderDismissedAt: null,
      },
    })
    showToast({ message: "Backup reminder snoozed for 7 days", tone: "info" })
  }

  const toggleDismissReminder = () => {
    if (state.settings.backupReminderDismissedAt) {
      dispatch({
        type: "UPDATE_SETTINGS",
        patch: {
          backupReminderDismissedAt: null,
          backupReminderSnoozedUntil: null,
        },
      })
      showToast({ message: "Weekly backup reminders enabled", tone: "info" })
    } else {
      dispatch({
        type: "UPDATE_SETTINGS",
        patch: {
          backupReminderDismissedAt: new Date().toISOString(),
        },
      })
      showToast({ message: "Backup reminder turned off", tone: "info" })
    }
  }

  const reminderStatusLabel = state.settings.backupReminderDismissedAt
    ? "Reminders turned off"
    : state.settings.backupReminderSnoozedUntil &&
        Date.parse(state.settings.backupReminderSnoozedUntil) > Date.now()
      ? `Snoozed until ${formatDate(state.settings.backupReminderSnoozedUntil.slice(0, 10))}`
      : "Active every 7 days"

  return (
    <div className="pb-8 space-y-5">
      <ScreenHeader
        eyebrow="Bakery preferences"
        title="Settings"
        subtitle="Defaults, pricing rules, and local backups"
        onBack={onBack}
        backLabel="Back to Today"
      />

      {error ? (
        <div
          className="rounded-control border border-error-border bg-error-soft p-3 text-sm text-cocoa"
          role="alert"
        >
          {error}
        </div>
      ) : null}

      <Card className="space-y-4">
        <div>
          <h2 className="text-base font-semibold text-cocoa">
            Business profile
          </h2>
          <p className="mt-0.5 text-xs text-muted">
            Shown in your greeting and exported summaries.
          </p>
        </div>
        <Field
          label="Bakery / business name"
          value={businessName}
          onChange={(event) => {
            setBusinessName(event.target.value)
            setError("")
          }}
        />
        <Field
          label="Owner / baker name"
          value={ownerName}
          onChange={(event) => {
            setOwnerName(event.target.value)
            setError("")
          }}
        />
      </Card>

      <Card className="space-y-4">
        <div>
          <h2 className="text-base font-semibold text-cocoa">
            Pricing & labour defaults
          </h2>
          <p className="mt-0.5 text-xs text-muted">
            Pre-fills pricing suggestions when quoting new orders.
          </p>
        </div>
        <Field
          label="Default labour rate (LKR / hour)"
          type="number"
          min="0"
          step="50"
          inputMode="numeric"
          value={labourRate}
          onChange={(event) => {
            setLabourRate(event.target.value)
            setError("")
          }}
        />
        <SegmentedControl
          label="Default pricing mode"
          value={pricingMode}
          onChange={(value) => setPricingMode(value as PricingMode)}
          segments={[
            { value: "margin", label: "% of price" },
            { value: "markup", label: "% on cost" },
          ]}
        />
        {(() => {
          const parsedMargin = Number(marginPercent)
          const parsedMarkup = Number(markupPercent)
          const example = calculateSuggestedPrice(
            1000,
            pricingMode === "margin"
              ? {
                  mode: "margin",
                  marginPercent: Number.isFinite(parsedMargin) ? parsedMargin : 0,
                  markupPercent: 0,
                  roundingStep,
                }
              : {
                  mode: "markup",
                  marginPercent: 0,
                  markupPercent: Number.isFinite(parsedMarkup) ? parsedMarkup : 0,
                  roundingStep,
                },
          )
          if (pricingMode === "margin") {
            return (
              <Field
                label="Profit out of selling price (%)"
                type="number"
                min="0"
                max="99"
                step="1"
                inputMode="decimal"
                value={marginPercent}
                onChange={(event) => {
                  setMarginPercent(event.target.value)
                  setError("")
                }}
                helperText={
                  example.valid
                    ? `Example: Rs. 1,000 cost → sell at ${formatLkr(example.suggestedPrice)} (${Number.isFinite(parsedMargin) ? parsedMargin : 0}% of price is profit)`
                    : "Enter a percentage below 100%."
                }
              />
            )
          }
          return (
            <Field
              label="Extra added on cost (%)"
              type="number"
              min="0"
              step="1"
              inputMode="decimal"
              value={markupPercent}
              onChange={(event) => {
                setMarkupPercent(event.target.value)
                setError("")
              }}
              helperText={
                example.valid
                  ? `Example: Rs. 1,000 cost → sell at ${formatLkr(example.suggestedPrice)} (+${Number.isFinite(parsedMarkup) ? parsedMarkup : 0}% added on top)`
                  : "Enter 0% or higher."
              }
            />
          )
        })()}
        <SelectField
          label="Round suggested prices to nearest"
          value={String(roundingStep)}
          onChange={(event) =>
            setRoundingStep(Number(event.target.value) as 1 | 50 | 100)
          }
          options={[
            { value: "1", label: "Exact LKR 1" },
            { value: "50", label: "Nearest LKR 50" },
            { value: "100", label: "Nearest LKR 100" },
          ]}
        />
      </Card>

      <Button
        fullWidth
        leadingIcon={<Save aria-hidden="true" size={17} />}
        onClick={handleSaveSettings}
      >
        Save all preferences
      </Button>

      <section className="space-y-3 pt-2">
        <GroupedList title="Data & backup schedule">
          <ListRow
            title="Last backup exported"
            value={
              state.settings.lastBackupAt
                ? formatDate(state.settings.lastBackupAt.slice(0, 10))
                : "Not yet"
            }
          />
          <ListRow title="Weekly reminder" value={reminderStatusLabel} />
          <ListRow
            leading={
              <BellOff aria-hidden="true" size={17} className="text-muted" />
            }
            title="Snooze backup reminder for 7 days"
            onClick={snoozeReminder}
          />
          <ListRow
            title={
              state.settings.backupReminderDismissedAt
                ? "Re-enable weekly backup reminders"
                : "Turn off backup reminders"
            }
            onClick={toggleDismissReminder}
          />
        </GroupedList>

        <BackupRestorePanel
          data={state}
          onRestore={restoreBackupFromRaw}
          onExportComplete={(exportedAt) => {
            dispatch({ type: "RECORD_BACKUP_EXPORT", exportedAt })
            showToast({ message: "Backup exported", tone: "success" })
          }}
        />
      </section>

      <Card className="border-error/25 bg-error-soft/40 space-y-3">
        <div className="flex items-start gap-2.5">
          <ShieldAlert
            aria-hidden="true"
            size={19}
            className="mt-0.5 shrink-0 text-error"
          />
          <div>
            <h2 className="text-sm font-semibold text-cocoa">
              Reset workspace
            </h2>
            <p className="mt-0.5 text-xs text-muted">
              Start with a completely blank workspace or load the minimal
              1-item starter sample. Export a backup first if you want to keep
              your changes.
            </p>
          </div>
        </div>
        <div className="space-y-2">
          <Button
            fullWidth
            variant="secondary"
            className="border-error/30 text-error hover:bg-error-soft"
            leadingIcon={<RotateCcw aria-hidden="true" size={16} />}
            onClick={() => setResetMode("empty")}
          >
            Clear workspace (start empty)
          </Button>
          <Button
            fullWidth
            variant="ghost"
            onClick={() => setResetMode("starter")}
          >
            Load minimal starter sample
          </Button>
        </div>
      </Card>

      <GroupedList title="About">
        <ListRow
          title="App version"
          value={`v${APP_VERSION} (Build ${APP_BUILD_CODE})`}
        />
        <ListRow
          title="Storage engine"
          value={
            storageInfo.backendName === "capacitor-sqlite"
              ? "SQLite (Android)"
              : storageInfo.backendName === "indexeddb"
                ? "IndexedDB (Browser)"
                : storageInfo.backendName === "node-sqlite"
                  ? "SQLite (Node)"
                  : "LocalStorage (Fallback)"
          }
        />
        <ListRow
          title="Database schema"
          value={`v${storageInfo.schemaVersion ?? LATEST_DB_SCHEMA_VERSION}`}
        />
        <ListRow title="Currency & precision" value="Whole LKR" />
        <ListRow title="Business timezone" value="Asia/Colombo" />
        <ListRow
          leading={
            <RefreshCw
              aria-hidden="true"
              size={16}
              className={checkingUpdate ? "animate-spin text-sage-dark" : "text-muted"}
            />
          }
          title={checkingUpdate ? "Checking for updates..." : "Check for updates"}
          value={
            updateResult?.status === "update-available"
              ? `v${updateResult.latestVersion} available`
              : updateResult?.status === "up-to-date"
                ? "Up to date"
                : undefined
          }
          onClick={() => void handleCheckUpdate()}
        />
      </GroupedList>

      {updateResult && updateResult.status !== "up-to-date" ? (
        <Card
          tone={
            updateResult.status === "update-available" ? "sage" : "default"
          }
          className="space-y-2.5"
        >
          {updateResult.status === "update-available" ? (
            <>
              <p className="text-sm font-semibold text-cocoa">
                Update v{updateResult.latestVersion} is available
              </p>
              {updateResult.notes ? (
                <p className="text-xs leading-relaxed text-muted">
                  {updateResult.notes}
                </p>
              ) : null}
              <div className="flex flex-wrap gap-2">
                <a
                  href={updateResult.downloadUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(event) => {
                    if (Capacitor.isNativePlatform()) {
                      event.preventDefault()
                      window.open(
                        updateResult.downloadUrl,
                        "_system",
                        "noopener,noreferrer",
                      )
                    }
                  }}
                  className="inline-flex min-h-touch items-center justify-center gap-2 rounded-control bg-sage px-4 py-2 text-sm font-semibold text-white transition hover:opacity-95"
                >
                  <Download aria-hidden="true" size={16} />
                  Download updated APK
                </a>
                <Button
                  variant="secondary"
                  leadingIcon={<Share2 aria-hidden="true" size={16} />}
                  onClick={() => {
                    const shareUrl = updateResult.downloadUrl
                    if (Capacitor.isNativePlatform()) {
                      void Share.share({
                        title: `Udeni's Specials v${updateResult.latestVersion}`,
                        text: `Download Udeni's Specials v${updateResult.latestVersion} APK`,
                        url: shareUrl,
                        dialogTitle: "Open or share update link",
                      }).catch(() => undefined)
                    } else if (navigator.clipboard?.writeText) {
                      void navigator.clipboard
                        .writeText(shareUrl)
                        .then(() =>
                          showToast({
                            message: "Update link copied",
                            tone: "info",
                          }),
                        )
                        .catch(() => undefined)
                    }
                  }}
                >
                  Share / copy link
                </Button>
              </div>
            </>
          ) : (
            <p className="text-xs leading-relaxed text-muted">
              {updateResult.message}
            </p>
          )}
        </Card>
      ) : null}

      <Dialog
        open={resetMode !== null}
        title={
          resetMode === "empty"
            ? "Clear workspace and start empty?"
            : "Load minimal starter sample?"
        }
        description="This action cannot be undone unless you have saved a backup file."
        onClose={() => setResetMode(null)}
        footer={
          <div className="space-y-2">
            <Button
              fullWidth
              className="bg-error text-white hover:bg-error/90"
              onClick={() => {
                if (resetMode === "empty") {
                  dispatch({ type: "CLEAR_WORKSPACE" })
                  showToast({
                    message: "Workspace cleared",
                    tone: "info",
                  })
                } else {
                  dispatch({ type: "LOAD_STARTER_SAMPLE" })
                  showToast({
                    message: "Minimal starter sample loaded",
                    tone: "info",
                  })
                }
                setResetMode(null)
                onBack()
              }}
            >
              {resetMode === "empty"
                ? "Yes, clear workspace"
                : "Yes, load starter sample"}
            </Button>
            <Button
              fullWidth
              variant="ghost"
              onClick={() => setResetMode(null)}
            >
              Cancel
            </Button>
          </div>
        }
      >
        <p className="text-sm leading-relaxed text-muted">
          {resetMode === "empty"
            ? "All orders, recipes, products, customers, expenses, and stock records on this device will be cleared so you can start completely fresh."
            : "All current records on this device will be replaced with the minimal 1-customer, 1-product, 1-recipe, 1-order starter sample."}
        </p>
      </Dialog>
    </div>
  )
}
