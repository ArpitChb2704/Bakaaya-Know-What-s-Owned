import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../../lib/api'

export default function CreateBill() {
  const navigate = useNavigate()

  const [parties, setParties] = useState([])
  const [skus, setSkus] = useState([])
  const [recentBills, setRecentBills] = useState([])

  const [partyId, setPartyId] = useState('')
  const [items, setItems] = useState([
    {
      sku_id: '',
      item_name: '',
      quantity: 1,
      unit_price: 0
    }
  ])

  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [loadingBills, setLoadingBills] = useState(true)
  const [created, setCreated] = useState(null)

  // -----------------------------
  // INITIAL LOAD
  // -----------------------------

  useEffect(() => {
    loadParties()
    loadSkus()
    loadRecentBills()
  }, [])

  async function loadParties() {
    try {
      const data = await api.listParties({
        party_type: 'customer'
      })

      setParties(data || [])
    } catch (err) {
      console.error('Failed to load customers:', err)
    }
  }

  async function loadSkus() {
    try {
      const data = await api.listSkus?.()

      setSkus(data || [])
    } catch (err) {
      console.error('Failed to load SKUs:', err)
    }
  }

  // -----------------------------
  // RECENT BILLS
  // -----------------------------

  async function loadRecentBills() {
    setLoadingBills(true)

    try {
      const result = await api.listTransactions()

      // Support either:
      // [ ...transactions ]
      // OR
      // { items: [...] }
      // OR
      // { transactions: [...] }

      const transactions = Array.isArray(result)
        ? result
        : result?.items ||
          result?.transactions ||
          []

      const bills = transactions
        .filter(txn => txn.invoice_number)
        .sort((a, b) => {
          const dateA = new Date(
            a.transaction_date ||
            a.created_at ||
            0
          )

          const dateB = new Date(
            b.transaction_date ||
            b.created_at ||
            0
          )

          return dateB - dateA
        })
        .slice(0, 10)

      setRecentBills(bills)

    } catch (err) {
      console.error(
        'Failed to load recent bills:',
        err
      )

      setRecentBills([])
    } finally {
      setLoadingBills(false)
    }
  }

  // -----------------------------
  // FORM FUNCTIONS
  // -----------------------------

  function updateItem(idx, field, value) {
    setItems(prev =>
      prev.map((it, i) =>
        i === idx
          ? { ...it, [field]: value }
          : it
      )
    )
  }

  function addRow() {
    setItems(prev => [
      ...prev,
      {
        sku_id: '',
        item_name: '',
        quantity: 1,
        unit_price: 0
      }
    ])
  }

  function removeRow(idx) {
    setItems(prev =>
      prev.filter((_, i) => i !== idx)
    )
  }

  function onSkuPick(idx, skuId) {
    const sku = skus.find(
      s => String(s.id) === String(skuId)
    )

    setItems(prev =>
      prev.map((it, i) =>
        i === idx
          ? {
              ...it,
              sku_id: skuId,
              item_name: sku
                ? sku.name
                : it.item_name,
              unit_price: sku
                ? sku.selling_price
                : it.unit_price
            }
          : it
      )
    )
  }

  const total = items.reduce(
    (sum, it) =>
      sum +
      (Number(it.quantity) || 0) *
      (Number(it.unit_price) || 0),
    0
  )

  // -----------------------------
  // CREATE BILL
  // -----------------------------

  async function handleCreate() {
    if (!partyId) {
      alert('Select a customer')
      return
    }

    if (!items.some(it => it.item_name)) {
      alert('Add at least one item')
      return
    }

    setSaving(true)

    try {
      const payload = {
        party_id: Number(partyId),

        transaction_type: 'sale',

        amount: total,

        notes: notes || null,

        items: items
          .filter(it => it.item_name)
          .map(it => ({
            sku_id: it.sku_id
              ? Number(it.sku_id)
              : null,

            item_name: it.item_name,

            quantity: Number(it.quantity),

            unit_price: Number(it.unit_price)
          }))
      }

      const txn =
        await api.createTransaction(payload)

      setCreated(txn)

      // Refresh Recent Bills immediately
      await loadRecentBills()

    } catch (err) {
      alert(err.message)
    } finally {
      setSaving(false)
    }
  }

  // -----------------------------
  // PDF HELPERS
  // -----------------------------

  async function getInvoicePdfUrl(transactionId) {
    const pdfBytes =
      await api.getInvoicePdf(transactionId)

    const blob = new Blob(
      [pdfBytes],
      {
        type: 'application/pdf'
      }
    )

    return URL.createObjectURL(blob)
  }

  async function handleViewInvoice(bill) {
    try {
      const url =
        await getInvoicePdfUrl(bill.id)

      window.open(url, '_blank')
    } catch (err) {
      alert(err.message)
    }
  }

  async function handlePrint(bill) {
    try {
      const url =
        await getInvoicePdfUrl(bill.id)

      const printWindow =
        window.open(url, '_blank')

      if (!printWindow) {
        alert(
          'Please allow pop-ups to print the invoice.'
        )
        return
      }

      printWindow.onload = () => {
        printWindow.print()
      }

    } catch (err) {
      alert(err.message)
    }
  }

  async function handleDownloadPdf(bill) {
    try {
      const pdfBytes =
        await api.getInvoicePdf(bill.id)

      const blob = new Blob(
        [pdfBytes],
        {
          type: 'application/pdf'
        }
      )

      const url =
        URL.createObjectURL(blob)

      const link =
        document.createElement('a')

      link.href = url

      link.download =
        `${bill.invoice_number}.pdf`

      document.body.appendChild(link)

      link.click()

      document.body.removeChild(link)

      URL.revokeObjectURL(url)

    } catch (err) {
      alert(err.message)
    }
  }

  // -----------------------------
  // DISPLAY HELPERS
  // -----------------------------

  function getPartyName(bill) {
    // If backend already returns nested party
    if (bill.party?.name) {
      return bill.party.name
    }

    // If backend returns party_name
    if (bill.party_name) {
      return bill.party_name
    }

    // Otherwise find customer locally
    const party = parties.find(
      p =>
        String(p.id) ===
        String(bill.party_id)
    )

    return party?.name || 'Unknown customer'
  }

  function formatDate(date) {
    if (!date) return '—'

    return new Date(date).toLocaleDateString(
      'en-IN',
      {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
      }
    )
  }

  // -----------------------------
  // SUCCESS SCREEN
  // -----------------------------

  if (created) {
    return (
      <div className="max-w-md mx-auto mt-16 text-center">

        <div className="text-2xl mb-2">
          ✓ Bill Created Successfully
        </div>

        <div className="text-stone mb-6">
          {created.invoice_number}
        </div>

        <div className="flex flex-col gap-2">

          <button
            onClick={() =>
              handleViewInvoice(created)
            }
            className="border border-rule py-2 rounded-sm hover:bg-paperdim"
          >
            View Invoice
          </button>

          <button
            onClick={() =>
              handlePrint(created)
            }
            className="border border-rule py-2 rounded-sm hover:bg-paperdim"
          >
            Print
          </button>

          <button
            onClick={() =>
              handleDownloadPdf(created)
            }
            className="border border-rule py-2 rounded-sm hover:bg-paperdim"
          >
            Download PDF
          </button>

          <button
            onClick={() => {
              setCreated(null)

              setPartyId('')

              setItems([
                {
                  sku_id: '',
                  item_name: '',
                  quantity: 1,
                  unit_price: 0
                }
              ])

              setNotes('')

              // Refresh once more
              loadRecentBills()
            }}
            className="bg-ink text-paper py-2 rounded-sm"
          >
            Done
          </button>

        </div>
      </div>
    )
  }

  // -----------------------------
  // MAIN PAGE
  // -----------------------------

  return (
    <div className="max-w-2xl mx-auto p-6">

      {/* ========================= */}
      {/* CREATE BILL */}
      {/* ========================= */}

      <h2 className="font-display text-xl mb-4">
        Create Bill
      </h2>

      <label className="block text-xs uppercase tracking-widest text-stone mb-1.5">
        Customer
      </label>

      <select
        value={partyId}
        onChange={e =>
          setPartyId(e.target.value)
        }
        className="w-full border border-rule rounded-sm px-3 py-2.5 mb-4 bg-transparent"
      >
        <option value="">
          Select customer
        </option>

        {parties.map(p => (
          <option
            key={p.id}
            value={p.id}
          >
            {p.name}
          </option>
        ))}
      </select>


      {/* ITEMS */}

      <div className="mb-4">

        <div className="text-xs uppercase tracking-widest text-stone mb-2">
          Items
        </div>

        {items.map((it, idx) => (

          <div
            key={idx}
            className="grid grid-cols-12 gap-2 mb-2 items-center"
          >

            <select
              value={it.sku_id}
              onChange={e =>
                onSkuPick(
                  idx,
                  e.target.value
                )
              }
              className="col-span-4 border border-rule rounded-sm px-2 py-2 bg-transparent text-sm"
            >

              <option value="">
                No SKU (type name)
              </option>

              {skus.map(s => (
                <option
                  key={s.id}
                  value={s.id}
                >
                  {s.name}
                </option>
              ))}

            </select>


            <input
              placeholder="Item name"
              value={it.item_name}
              onChange={e =>
                updateItem(
                  idx,
                  'item_name',
                  e.target.value
                )
              }
              className="col-span-3 border border-rule rounded-sm px-2 py-2 bg-transparent text-sm"
            />


            <input
              type="number"
              placeholder="Qty"
              value={it.quantity}
              onChange={e =>
                updateItem(
                  idx,
                  'quantity',
                  e.target.value
                )
              }
              className="col-span-2 border border-rule rounded-sm px-2 py-2 bg-transparent text-sm"
            />


            <input
              type="number"
              placeholder="Rate"
              value={it.unit_price}
              onChange={e =>
                updateItem(
                  idx,
                  'unit_price',
                  e.target.value
                )
              }
              className="col-span-2 border border-rule rounded-sm px-2 py-2 bg-transparent text-sm"
            />


            <button
              onClick={() =>
                removeRow(idx)
              }
              className="col-span-1 text-stone hover:text-ink"
            >
              ×
            </button>

          </div>

        ))}


        <button
          onClick={addRow}
          className="text-sm text-stone hover:text-ink underline"
        >
          + Add item
        </button>

      </div>


      {/* NOTES */}

      <textarea
        placeholder="Notes"
        value={notes}
        onChange={e =>
          setNotes(e.target.value)
        }
        className="w-full border border-rule rounded-sm px-3 py-2.5 mb-4 bg-transparent text-sm"
        rows={2}
      />


      {/* TOTAL */}

      <div className="flex justify-between items-center mb-6">

        <div className="text-stone text-sm">
          Total
        </div>

        <div className="text-xl font-semibold">
          ₹{total.toLocaleString('en-IN')}
        </div>

      </div>


      {/* CREATE */}

      <button
        onClick={handleCreate}
        disabled={saving}
        className="w-full bg-ink text-paper py-3 rounded-sm disabled:opacity-50"
      >
        {saving
          ? 'Creating…'
          : 'Create Bill'}
      </button>


      {/* ========================= */}
      {/* RECENT BILLS */}
      {/* ========================= */}

      <div className="mt-12 pt-8 border-t border-rule">

        <div className="flex items-center justify-between mb-4">

          <div>
            <h3 className="font-display text-lg">
              Recent Bills
            </h3>

            <p className="text-xs text-stone mt-1">
              Your latest invoices
            </p>
          </div>

          <button
            onClick={loadRecentBills}
            className="text-sm text-stone hover:text-ink underline"
          >
            Refresh
          </button>

        </div>


        {loadingBills ? (

          <div className="text-sm text-stone py-6 text-center">
            Loading bills…
          </div>

        ) : recentBills.length === 0 ? (

          <div className="border border-rule rounded-sm p-6 text-center">

            <div className="text-sm">
              No bills created yet.
            </div>

            <div className="text-xs text-stone mt-1">
              Your invoices will appear here.
            </div>

          </div>

        ) : (

          <div className="space-y-3">

            {recentBills.map(bill => (

              <div
                key={bill.id}
                className="border border-rule rounded-sm p-4"
              >

                {/* BILL INFO */}

                <div className="flex items-start justify-between gap-4">

                  <div className="min-w-0">

                    <div className="font-medium">
                      {bill.invoice_number}
                    </div>

                    <div className="text-sm mt-1">
                      {getPartyName(bill)}
                    </div>

                    <div className="text-xs text-stone mt-1">
                      {formatDate(
                        bill.transaction_date ||
                        bill.created_at
                      )}
                    </div>

                  </div>


                  <div className="text-right shrink-0">

                    <div className="font-semibold">
                      ₹{Number(
                        bill.amount || 0
                      ).toLocaleString('en-IN')}
                    </div>

                  </div>

                </div>


                {/* ACTIONS */}

                <div className="flex gap-2 mt-4 pt-3 border-t border-rule">

                  <button
                    onClick={() =>
                      handleViewInvoice(bill)
                    }
                    className="flex-1 border border-rule py-1.5 rounded-sm text-xs hover:bg-paperdim"
                  >
                    View
                  </button>


                  <button
                    onClick={() =>
                      handlePrint(bill)
                    }
                    className="flex-1 border border-rule py-1.5 rounded-sm text-xs hover:bg-paperdim"
                  >
                    Print
                  </button>


                  <button
                    onClick={() =>
                      handleDownloadPdf(bill)
                    }
                    className="flex-1 border border-rule py-1.5 rounded-sm text-xs hover:bg-paperdim"
                  >
                    Download
                  </button>

                </div>

              </div>

            ))}

          </div>

        )}

      </div>

    </div>
  )
}
