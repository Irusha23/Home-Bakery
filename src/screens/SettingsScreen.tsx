import { useEffect, useState } from "react"
import { BellOff, RotateCcw, Save, ShieldAlert } from "lucide-react"
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
import { formatDate, formatLkr } from "../lib/format"
import { calculateSuggestedPrice } from "../lib/pricing"
import { useAppState } from "../state/AppState"
import type { PricingMode } from "../types"

type SettingsScreenProps = {
  onBack: () => void
}

export default function SettingsScreen({ onBack }: SettingsScreenProps) {
  const { state, dispatch, dispatchIfAccepted, restoreBackupFromRaw } =
    useAppState()
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
  const [resetOpen, setResetOpen] = useState(false)

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
              Replaces your current bakery records with the clean sample
              dataset. Export a backup first if you want to keep your changes.
            </p>
          </div>
        </div>
        <Button
          fullWidth
          variant="secondary"
          className="border-error/30 text-error hover:bg-error-soft"
          leadingIcon={<RotateCcw aria-hidden="true" size={16} />}
          onClick={() => setResetOpen(true)}
        >
          Reset demo data
        </Button>
      </Card>

      <GroupedList title="About">
        <ListRow title="Currency & precision" value="Whole LKR" />
        <ListRow title="Business timezone" value="Asia/Colombo" />
        <ListRow title="Schema version" value="v7" />
      </GroupedList>

      <Dialog
        open={resetOpen}
        title="Reset to sample bakery data?"
        description="This action cannot be undone unless you have saved a backup file."
        onClose={() => setResetOpen(false)}
        footer={
          <div className="space-y-2">
            <Button
              fullWidth
              className="bg-error text-white hover:bg-error/90"
              onClick={() => {
                dispatch({ type: "RESET_DEMO" })
                setResetOpen(false)
                showToast({
                  message: "Sample demo data restored",
                  tone: "info",
                })
                onBack()
              }}
            >
              Yes, reset demo data
            </Button>
            <Button
              fullWidth
              variant="ghost"
              onClick={() => setResetOpen(false)}
            >
              Cancel
            </Button>
          </div>
        }
      >
        <p className="text-sm leading-relaxed text-muted">
          All custom orders, recipes, customers, expenses, budget goals, and
          stock adjustments on this device will be replaced by the clean sample
          data.
        </p>
      </Dialog>
    </div>
  )
}
