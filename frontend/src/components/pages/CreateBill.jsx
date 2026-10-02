import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../../lib/api'
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../../lib/api'

export default function CreateBill() {
  const navigate = useNavigate()
  const [parties, setParties] = useState([])
  const [skus, setSkus] = useState([])
  const [partyId, setPartyId] = useState('')
  const [items, setItems] = useState([{ sku_id: '', item_name: '', quantity: 1, unit_price: 0 }])
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [created, setCreated] = useState(null) // { id, invoice_number }

  useEffect(() => {
    api.listParties({ party_type: 'customer' }).then(setParties).catch(() => {})
    api.listSkus?.().then(setSkus).catch(() => {})
  }, [])

  function updateItem(idx, field, value) {
    setItems(prev => prev.map((it, i) => i === idx ? { ...it, [field]: value } : it))
  }

  function addRow() {
    setItems(prev => [...prev, { sku_id: '', item_name: '', quantity: 1, unit_price: 0 }])
  }

  function removeRow(idx) {
    setItems(prev => prev.filter((_, i) => i !== idx))
  }

  function onSkuPick(idx, skuId) {
    const sku = skus.find(s => String(s.id) === String(skuId))
    setItems(prev => prev.map((it, i) => i === idx
      ? { ...it, sku_id: skuId, item_name: sku ? sku.name : it.item_name, unit_price: sku ? sku.selling_price : it.unit_price }
      : it))
  }

  const total = items.reduce((sum, it) => sum + (Number(it.quantity) || 0) * (Number(it.unit_price) || 0), 0)

  async function handleCreate() {
    if (!partyId) { alert('Select a customer'); return }
    setSaving(true)
    try {
      const payload = {
        party_id: Number(partyId),
        transaction_type: 'sale',
        amount: total,
        notes: notes || null,
        items: items.filter(it => it.item_name).map(it => ({
          sku_id: it.sku_id ? Number(it.sku_id) : null,
          item_name: it.item_name,
          quantity: Number(it.quantity),
          unit_price: Number(it.unit_price),
        })),
      }
      const txn = await api.createTransaction(payload)
      setCreated(txn)
    } catch (err) {
      alert(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleDownloadPdf() {
  try {
    const pdfBytes = await api.getInvoicePdf(created.id)

    const blob = new Blob([pdfBytes], {
      type: 'application/pdf',
    })

    const url = URL.createObjectURL(blob)

    const link = document.createElement('a')
    link.href = url
    link.download = `${created.invoice_number}.pdf`

    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)

    URL.revokeObjectURL(url)
  } catch (err) {
    alert(err.message)
  }
}

 async function handleViewPrint() {
  try {
    const pdfBytes = await api.getInvoicePdf(created.id)

    const blob = new Blob([pdfBytes], {
      type: 'application/pdf',
    })

    const url = URL.createObjectURL(blob)

    window.open(url, '_blank')
  } catch (err) {
    alert(err.message)
  }
}

  if (created) {
    return (
      <div className="max-w-md mx-auto mt-16 text-center">
        <div className="text-2xl mb-2">✓ Bill Created Successfully</div>
        <div className="text-stone mb-6">{created.invoice_number}</div>
        <div className="flex flex-col gap-2">
          <button onClick={handleViewPrint} className="border border-rule py-2 rounded-sm hover:bg-paperdim"> View Invoice </button>
          <button onClick={handleViewPrint} className="border border-rule py-2 rounded-sm hover:bg-paperdim"> Print </button>
          <button onClick={handleDownloadPdf} className="border border-rule py-2 rounded-sm hover:bg-paperdim"> Download PDF </button>
          <button onClick={() => navigate('/')} className="bg-ink text-paper py-2 rounded-sm">Done</button>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto p-6">
      <h2 className="font-display text-xl mb-4">Create Bill</h2>

      <label className="block text-xs uppercase tracking-widest text-stone mb-1.5">Customer</label>
      <select value={partyId} onChange={e => setPartyId(e.target.value)}
        className="w-full border border-rule rounded-sm px-3 py-2.5 mb-4 bg-transparent">
        <option value="">Select customer</option>
        {parties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
      </select>

      <div className="mb-4">
        <div className="text-xs uppercase tracking-widest text-stone mb-2">Items</div>
        {items.map((it, idx) => (
          <div key={idx} className="grid grid-cols-12 gap-2 mb-2 items-center">
            <select value={it.sku_id} onChange={e => onSkuPick(idx, e.target.value)}
              className="col-span-4 border border-rule rounded-sm px-2 py-2 bg-transparent text-sm">
              <option value="">No SKU (type name)</option>
              {skus.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <input placeholder="Item name" value={it.item_name}
              onChange={e => updateItem(idx, 'item_name', e.target.value)}
              className="col-span-3 border border-rule rounded-sm px-2 py-2 bg-transparent text-sm" />
            <input type="number" placeholder="Qty" value={it.quantity}
              onChange={e => updateItem(idx, 'quantity', e.target.value)}
              className="col-span-2 border border-rule rounded-sm px-2 py-2 bg-transparent text-sm" />
            <input type="number" placeholder="Rate" value={it.unit_price}
              onChange={e => updateItem(idx, 'unit_price', e.target.value)}
              className="col-span-2 border border-rule rounded-sm px-2 py-2 bg-transparent text-sm" />
            <button onClick={() => removeRow(idx)} className="col-span-1 text-stone hover:text-ink">×</button>
          </div>
        ))}
        <button onClick={addRow} className="text-sm text-stone hover:text-ink underline">+ Add item</button>
      </div>

      <textarea placeholder="Notes" value={notes} onChange={e => setNotes(e.target.value)}
        className="w-full border border-rule rounded-sm px-3 py-2.5 mb-4 bg-transparent text-sm" rows={2} />

      <div className="flex justify-between items-center mb-6">
        <div className="text-stone text-sm">Total</div>
        <div className="text-xl font-semibold">₹{total.toLocaleString()}</div>
      </div>

      <button onClick={handleCreate} disabled={saving}
        className="w-full bg-ink text-paper py-3 rounded-sm disabled:opacity-50">
        {saving ? 'Creating…' : 'Create Bill'}
      </button>
    </div>
  )
}
