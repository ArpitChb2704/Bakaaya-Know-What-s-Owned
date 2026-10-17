import { save } from '@tauri-apps/plugin-dialog'
import { writeFile } from '@tauri-apps/plugin-fs'
import { openPath } from '@tauri-apps/plugin-opener'
import { api } from './api'

// Fetches the invoice PDF, asks where to save it, writes it, and optionally opens it.
export async function saveInvoice(transactionId, invoiceNumber, { openAfter = false } = {}) {
  const pdfBytes = await api.getInvoicePdf(transactionId)
  const path = await save({
    defaultPath: `${invoiceNumber}.pdf`,
    filters: [{ name: 'PDF', extensions: ['pdf'] }],
  })
  if (!path) return
  await writeFile(path, new Uint8Array(pdfBytes))
  if (openAfter) await openPath(path)
}