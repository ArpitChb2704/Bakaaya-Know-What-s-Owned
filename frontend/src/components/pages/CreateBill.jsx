import { useState, useEffect } from 'react'
import { Capacitor } from '@capacitor/core'
import { api } from '../../lib/api'
import { formatINR } from '../../lib/format'
import { useAuth } from '../../lib/AuthContext'
import { saveInvoice } from '../../lib/invoiceActions'
import { openWhatsApp, billMessage } from '../../lib/whatsapp'

// Local calendar date as YYYY-MM-DD (not UTC, so it's correct in India after midnight)
function localToday() {
  const now = new Date()
  return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10)
}

const emptyRow = () => ({ sku_id: '', item_name: '', quantity: 1, unit_price: 0 })
const isNative = Capacitor.isNativePlatform()

export default function CreateBill() {
  const { businessName } = useAuth()
  const [parties, setParties] = useState([])
  const [skus, setSkus] = useState([])
  const [recent, setRecent] = useState([])
  const [partyId, setPartyId] = useState('')
  const [billDate, setBillDate] = useState(localToday())
  const [items, setItems] = useState([emptyRow()])
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [created, setCreated] = useState(null) // details of the bill just created

  function loadRecent() {
    api.listInvoices().then(setRecent).catch(() => {})
  }

  useEffect(() => {
    api.listParties({ party_type: 'customer' }).then(setParties).catch(() => {})
    api.listSkus().then(setSkus).catch(() => {})
    loadRecent()
  }, [])

  function updateItem(idx, field, value) {
    setItems(prev => prev.map((it, i) => (i === idx ? { ...it, [field]: value } : it)))
  }

  function onSkuPick(idx, skuId) {
    const sku = skus.find(s => String(s.id) === String(skuId))
    setItems(prev => prev.map((it, i) => (i === idx
      ? { ...it, sku_id: skuId, item_name: sku ? sku.name : it.item_name, unit_price: sku ? sku.selling_price : it.unit_price }
      : it)))
  }

  function resetForm() {
    setCreated(null)
    setPartyId('')
    setBillDate(localToday())
    setItems([emptyRow()])
    setNotes('')
  }

  const total = items.reduce((sum, it) => sum + (Number(it.quantity) || 0) * (Number(it.unit_price) || 0), 0)

  async function handleCreate() {
    if (!partyId) { alert('Select a customer'); return }
    const validItems = items.filter(it => it.item_name)
    if (validItems.length === 0) { alert('Add at least one item'); return }
    setSaving(true)
    try {
      const txn = await api.createTransaction({
        party_id: Number(partyId),
        transaction_type: 'sale',
        amount: total,
        transaction_date: billDate,
        notes: notes || null,
        items: validItems.map(it => ({
          sku_id: it.sku_id ? Number(it.sku_id) : null,
          item_name: it.item_name,
          quantity: Number(it.quantity),
          unit_price: Number(it.unit_price),
        })),
      })
      const party = parties.find(p => String(p.id) === String(partyId))
      setCreated({
        id: txn.id,
        invoice_number: txn.invoice_number,
        party_name: party?.name || '',
        party_phone: party?.phone || '',
        amount: total,
        date: billDate,
      })
      loadRecent()
    } catch (err) {
      alert(err?.message || String(err))
    } finally {
      setSaving(false)
    }
  }

  async function handleInvoice(id, invoiceNumber, openAfter) {
    try {
      await saveInvoice(id, invoiceNumber, { openAfter })
    } catch (err) {
      alert(err?.message || String(err))
    }
  }

  async function handleWhatsApp({ partyName, phone, invoiceNumber, amount, date }) {
    try {
      await openWhatsApp(phone, billMessage({ businessName, partyName, invoiceNumber, amount, date }))
    } catch (err) {
      alert(err?.message || String(err))
    }
  }

  return (
    <div className="max-w-2xl mx-auto p-4 sm:p-6">
      {created ? (
        <div className="text-center mb-10">
          <div className="text-2xl mb-2">✓ Bill Created Successfully</div>
          <div className="text-stone mb-6">{created.invoice_number}</div>
          <div className="flex flex-col gap-2 max-w-xs mx-auto">
            <button onClick={() => handleInvoice(created.id, created.invoice_number, true)}
              className="border border-rule py-3 rounded-sm hover:bg-paperdim">View Invoice</button>
            <button onClick={() => handleInvoice(created.id, created.invoice_number, true)}
              className="border border-rule py-3 rounded-sm hover:bg-paperdim">Print</button>
            <button onClick={() => handleInvoice(created.id, created.invoice_number, false)}
              className="border border-rule py-3 rounded-sm hover:bg-paperdim">Download PDF</button>
            <button
              onClick={() => handleWhatsApp({
                partyName: created.party_name, phone: created.party_phone,
                invoiceNumber: created.invoice_number, amount: created.amount, date: created.date,
              })}
              className="border border-rule py-3 rounded-sm hover:bg-paperdim">Send on WhatsApp</button>
            <button onClick={resetForm} className="bg-ink text-paper py-3 rounded-sm">Done</button>
          </div>
          {isNative && (
            <p className="text-xs text-stone mt-4">
              View, Print and Download open your phone's share menu: choose Print, Save to Files, or WhatsApp to send the PDF itself.
            </p>
          )}
          {!created.party_phone && (
            <p className="text-xs text-stone mt-2">
              No phone number saved for this customer, so you'll pick the contact in WhatsApp.
            </p>
          )}
        </div>
      ) : (
        <div className="mb-10">
          <h2 className="font-display text-xl mb-4">Create Bill</h2>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
            <div className="sm:col-span-2">
              <label className="block text-xs uppercase tracking-widest text-stone mb-1.5">Customer</label>
              <select value={partyId} onChange={e => setPartyId(e.target.value)}
                className="w-full border border-rule rounded-sm px-3 py-2.5 bg-transparent">
                <option value="">Select customer</option>
                {parties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs uppercase tracking-widest text-stone mb-1.5">Date</label>
              <input type="date" value={billDate} onChange={e => setBillDate(e.target.value)}
                className="w-full border border-rule rounded-sm px-3 py-2.5 bg-transparent" />
            </div>
          </div>

          <div className="mb-4">
            <div className="text-xs uppercase tracking-widest text-stone mb-2">Items</div>
            {items.map((it, idx) => (
              <div key={idx}
                className="grid grid-cols-6 sm:grid-cols-12 gap-2 mb-3 sm:mb-2 items-center border border-rule sm:border-0 rounded-sm p-3 sm:p-0">
                <select value={it.sku_id} onChange={e => onSkuPick(idx, e.target.value)}
                  className="col-span-6 sm:col-span-4 border border-rule rounded-sm px-2 py-2.5 bg-transparent text-sm">
                  <option value="">No SKU (type name)</option>
                  {skus.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
                <input placeholder="Item name" value={it.item_name}
                  onChange={e => updateItem(idx, 'item_name', e.target.value)}
                  className="col-span-6 sm:col-span-3 border border-rule rounded-sm px-2 py-2.5 bg-transparent text-sm" />
                <input type="number" inputMode="decimal" placeholder="Qty" value={it.quantity}
                  onChange={e => updateItem(idx, 'quantity', e.target.value)}
                  className="col-span-2 sm:col-span-2 border border-rule rounded-sm px-2 py-2.5 bg-transparent text-sm" />
                <input type="number" inputMode="decimal" placeholder="Rate" value={it.unit_price}
                  onChange={e => updateItem(idx, 'unit_price', e.target.value)}
                  className="col-span-3 sm:col-span-2 border border-rule rounded-sm px-2 py-2.5 bg-transparent text-sm" />
                <button onClick={() => setItems(prev => prev.filter((_, i) => i !== idx))}
                  className="col-span-1 text-stone hover:text-ink text-lg">×</button>
              </div>
            ))}
            <button onClick={() => setItems(prev => [...prev, emptyRow()])}
              className="text-sm text-stone hover:text-ink underline py-1">+ Add item</button>
          </div>

          <textarea placeholder="Notes" value={notes} onChange={e => setNotes(e.target.value)}
            className="w-full border border-rule rounded-sm px-3 py-2.5 mb-4 bg-transparent text-sm" rows={2} />

          <div className="flex justify-between items-center mb-6">
            <div className="text-stone text-sm">Total</div>
            <div className="text-xl font-semibold">{formatINR(total)}</div>
          </div>

          <button onClick={handleCreate} disabled={saving}
            className="w-full bg-ink text-paper py-3.5 rounded-sm disabled:opacity-50">
            {saving ? 'Creating…' : 'Create Bill'}
          </button>
        </div>
      )}

      <div>
        <h3 className="font-display text-lg mb-3">Recent Bills</h3>
        {recent.length === 0 ? (
          <p className="text-stone text-sm">No bills yet. Bills you create will appear here.</p>
        ) : (
          <div className="border border-rule rounded-sm overflow-hidden">
            {recent.map((b, i) => (
              <div key={b.id}
                className={`flex flex-wrap items-center justify-between gap-x-3 gap-y-1 px-4 py-3 text-sm border-b border-rule last:border-0 ${i % 2 === 1 ? 'bg-paper/40' : ''}`}>
                <div className="min-w-0">
                  <div className="font-medium">{b.invoice_number}</div>
                  <div className="text-xs text-stone truncate">{b.party_name} · {b.transaction_date}</div>
                </div>
                <div className="font-medium num">{formatINR(b.amount)}</div>
                <div className="flex gap-4 text-sm w-full sm:w-auto justify-end">
                  <button onClick={() => handleInvoice(b.id, b.invoice_number, true)}
                    className="text-stone hover:text-ink underline py-1">View</button>
                  <button onClick={() => handleInvoice(b.id, b.invoice_number, false)}
                    className="text-stone hover:text-ink underline py-1">Download</button>
                  <button
                    onClick={() => handleWhatsApp({
                      partyName: b.party_name, phone: b.party_phone,
                      invoiceNumber: b.invoice_number, amount: b.amount, date: b.transaction_date,
                    })}
                    className="text-stone hover:text-ink underline py-1">WhatsApp</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}