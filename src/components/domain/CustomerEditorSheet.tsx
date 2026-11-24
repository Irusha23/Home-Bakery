import { useEffect, useState } from "react"
import Button from "../ui/Button"
import Field from "../ui/Field"
import Sheet from "../ui/Sheet"
import { createId } from "../../lib/id"
import { useAppState } from "../../state/AppState"
import type { Customer } from "../../types"

type CustomerEditorSheetProps = {
  open: boolean
  customer?: Customer | null
  onClose: () => void
  onSaved?: (customer: Customer) => void
}

export default function CustomerEditorSheet({
  open,
  customer,
  onClose,
  onSaved,
}: CustomerEditorSheetProps) {
  const { dispatchIfAccepted } = useAppState()
  const [name, setName] = useState("")
  const [phone, setPhone] = useState("")
  const [error, setError] = useState("")

  useEffect(() => {
    if (!open) return
    setError("")
    setName(customer?.name ?? "")
    setPhone(customer?.phone ?? "")
  }, [customer, open])

  const handleSave = () => {
    const trimmedName = name.trim()
    if (!trimmedName) {
      setError("Enter the customer's name.")
      return
    }
    const nextCustomer: Customer = {
      id: customer?.id ?? createId("customer"),
      name: trimmedName,
      phone: phone.trim(),
    }
    const ok = dispatchIfAccepted(
      customer
        ? { type: "UPDATE_CUSTOMER", customer: nextCustomer }
        : { type: "ADD_CUSTOMER", customer: nextCustomer },
    )
    if (!ok) {
      setError("Could not save customer details.")
      return
    }
    onSaved?.(nextCustomer)
    onClose()
  }

  return (
    <Sheet
      open={open}
      title={customer ? "Edit customer" : "New customer"}
      subtitle="Save contact details for faster repeat orders"
      onClose={onClose}
      footer={
        <div className="flex gap-2">
          <Button variant="secondary" className="flex-1" onClick={onClose}>
            Cancel
          </Button>
          <Button className="flex-1" onClick={handleSave}>
            Save
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <Field
          label="Full name"
          placeholder="e.g., Nadeesha Perera"
          value={name}
          onChange={(e) => {
            setName(e.target.value)
            setError("")
          }}
        />
        <Field
          label="Phone number"
          type="tel"
          placeholder="077 123 4567"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
        />
        {error ? (
          <p className="text-sm font-medium text-error">{error}</p>
        ) : null}
      </div>
    </Sheet>
  )
}
