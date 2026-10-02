import { useState, useEffect } from 'react'
import { api } from '../../lib/api'

export default function Skus() {
  const [skus, setSkus] = useState([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState({ name: '', unit: '', cost_price: '', selling_price: '' })
  const [editingId, setEditingId] = useState(null)
  const [saving, setSaving] = useState(false)

  function load() {
    setLoading(true)
    api.listSkus().then(setSkus).catch(err => alert(err.message)).finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  function resetForm() {
    setForm({ name: '', unit: '', cost_price: '', selling_price: '' })
    setEditingId(null)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)
    try {
      const payload = {
        name: form.name,
        unit: form.unit || null,
        cost_price: Number(form.cost_price),
        selling_price: Number(form.selling_price),
      }
      if (editingId) {
        await api.updateSku(editingId, payload)
      } else {
        await api.createSku(payload)
      }
      resetForm()
      load()
    } catch (err) { alert(err.message) }
    finally { setSaving(false) }
  }

  function startEdit(sku) {
    setEditingId(sku.id)
    setForm({ name: sku.name, unit: sku.unit || '', cost_price: sku.cost_price, selling_price: sku.selling_price })
  }

  async function handleArchive(id) {
    if (!confirm('Archive this product? It will no longer appear when creating bills.')) return
    try {
      await api.archiveSku(id)
      load()
    } catch (err) { alert(err.message) }
  }

  return (
    <div className="max-w-3xl mx-auto p-6">
      <h2 className="font-display text-xl mb-4">Products</h2>

      <form onSubmit={handleSubmit} className="grid grid-cols-12 gap-2 mb-6 items-end">
        <div className="col-span-4">
          <label className="block text-xs uppercase tracking-widest text-stone mb-1">Name</label>
          <input required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            className="w-full border border-rule rounded-sm px-2 py-2 bg-transparent text-sm" />
        </div>
        <div className="col-span-2">
          <label className="block text-xs uppercase tracking-widest text-stone mb-1">Unit</label>
          <input placeholder="pcs" value={form.unit} onChange={e => setForm(f => ({ ...f, unit: e.target.value }))}
            className="w-full border border-rule rounded-sm px-2 py-2 bg-transparent text-sm" />
        </div>
        <div className="col-span-2">
          <label className="block text-xs uppercase tracking-widest text-stone mb-1">Cost Price</label>
          <input required type="number" step="0.01" value={form.cost_price}
            onChange={e => setForm(f => ({ ...f, cost_price: e.target.value }))}
            className="w-full border border-rule rounded-sm px-2 py-2 bg-transparent text-sm" />
        </div>
        <div className="col-span-2">
          <label className="block text-xs uppercase tracking-widest text-stone mb-1">Selling Price</label>
          <input required type="number" step="0.01" value={form.selling_price}
            onChange={e => setForm(f => ({ ...f, selling_price: e.target.value }))}
            className="w-full border border-rule rounded-sm px-2 py-2 bg-transparent text-sm" />
        </div>
        <div className="col-span-2 flex gap-2">
          <button type="submit" disabled={saving} className="bg-ink text-paper px-3 py-2 rounded-sm text-sm flex-1 disabled:opacity-50">
            {editingId ? 'Save' : 'Add'}
          </button>
          {editingId && (
            <button type="button" onClick={resetForm} className="border border-rule px-2 py-2 rounded-sm text-sm">×</button>
          )}
        </div>
      </form>

      {loading ? (
        <div className="text-stone text-sm">Loading…</div>
      ) : skus.length === 0 ? (
        <div className="text-stone text-sm">No products yet. Add one above.</div>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-widest text-stone border-b border-rule">
              <th className="py-2">Name</th>
              <th>Unit</th>
              <th className="text-right">Cost</th>
              <th className="text-right">Selling</th>
              <th className="text-right">Margin</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {skus.map(s => (
              <tr key={s.id} className="border-b border-rule/50">
                <td className="py-2">{s.name}</td>
                <td className="text-stone">{s.unit || '—'}</td>
                <td className="text-right">₹{Number(s.cost_price).toLocaleString()}</td>
                <td className="text-right">₹{Number(s.selling_price).toLocaleString()}</td>
                <td className="text-right text-green-700">₹{(Number(s.selling_price) - Number(s.cost_price)).toLocaleString()}</td>
                <td className="text-right">
                  <button onClick={() => startEdit(s)} className="text-stone hover:text-ink text-xs mr-3">Edit</button>
                  <button onClick={() => handleArchive(s.id)} className="text-stone hover:text-ink text-xs">Archive</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}