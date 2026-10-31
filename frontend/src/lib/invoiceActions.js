import { Capacitor } from '@capacitor/core'
import { Filesystem, Directory } from '@capacitor/filesystem'
import { Share } from '@capacitor/share'
import { save } from '@tauri-apps/plugin-dialog'
import { writeFile } from '@tauri-apps/plugin-fs'
import { openPath } from '@tauri-apps/plugin-opener'
import { api } from './api'

// Which kind of app is this code running inside?
function detectPlatform() {
  if (Capacitor.isNativePlatform()) return 'android'            // Capacitor phone app
  if (typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window) return 'desktop' // Tauri app
  return 'web'                                                   // normal browser
}

function toBase64(buffer) {
  const bytes = new Uint8Array(buffer)
  const chunk = 0x8000
  let binary = ''
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk))
  }
  return btoa(binary)
}

// Saves/opens a PDF in whatever way the current app supports.
//  android: writes to app cache, then opens the phone's share sheet
//           (open in a PDF viewer, Print, Save to Files/Drive, WhatsApp)
//  desktop: native "Save as" dialog, writes the file, optionally opens it
//  web:     normal browser download (or opens in a new tab for "view")
export async function savePdfFile(pdfBytes, fileName, openAfter = false) {
  const platform = detectPlatform()

  if (platform === 'android') {
    const written = await Filesystem.writeFile({
      path: fileName,
      data: toBase64(pdfBytes),
      directory: Directory.Cache,
    })
    try {
      await Share.share({ title: fileName, files: [written.uri], dialogTitle: 'Open, print or save' })
    } catch (e) {
      // Closing the share sheet without choosing anything is not an error
      if (!String(e?.message || e).toLowerCase().includes('cancel')) throw e
    }
    return
  }

  if (platform === 'desktop') {
    const path = await save({
      defaultPath: fileName,
      filters: [{ name: 'PDF', extensions: ['pdf'] }],
    })
    if (!path) return
    await writeFile(path, new Uint8Array(pdfBytes))
    if (openAfter) await openPath(path)
    return
  }

  // web
  const blob = new Blob([pdfBytes], { type: 'application/pdf' })
  const url = URL.createObjectURL(blob)
  if (openAfter) {
    const w = window.open(url, '_blank')
    if (w) { setTimeout(() => URL.revokeObjectURL(url), 60000); return }
  }
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 60000)
}

export async function saveInvoice(transactionId, invoiceNumber, { openAfter = false } = {}) {
  const pdfBytes = await api.getInvoicePdf(transactionId)
  await savePdfFile(pdfBytes, `${invoiceNumber}.pdf`, openAfter)
}
