import { Capacitor } from '@capacitor/core'
import { AppLauncher } from '@capacitor/app-launcher'
import { openUrl } from '@tauri-apps/plugin-opener'
import { formatINR } from './format'

// WhatsApp needs digits only, with country code. Indian numbers are assumed.
export function normalizePhone(raw) {
  let d = String(raw || '').replace(/\D/g, '')
  if (!d) return ''
  if (d.length === 11 && d.startsWith('0')) d = d.slice(1)
  if (d.length === 10) d = '91' + d
  return d
}

// Opens WhatsApp with a ready-to-send message.
// No saved phone number -> WhatsApp opens and you pick the contact yourself.
export async function openWhatsApp(phone, text) {
  const digits = normalizePhone(phone)
  const encoded = encodeURIComponent(text)
  const webUrl = digits ? `https://wa.me/${digits}?text=${encoded}` : `https://wa.me/?text=${encoded}`

  if (Capacitor.isNativePlatform()) {
    const appUrl = digits ? `whatsapp://send?phone=${digits}&text=${encoded}` : `whatsapp://send?text=${encoded}`
    try {
      await AppLauncher.openUrl({ url: appUrl })
      return
    } catch {
      window.open(webUrl, '_blank') // WhatsApp app not found: try the web link
      return
    }
  }
  if (typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window) {
    await openUrl(webUrl)
    return
  }
  window.open(webUrl, '_blank')
}

export function billMessage({ businessName, partyName, invoiceNumber, amount, date }) {
  return [
    `Hi ${partyName || 'there'},`,
    `Thank you for your purchase from ${businessName || 'us'}.`,
    `Bill ${invoiceNumber} dated ${date}: ${formatINR(amount)}.`,
  ].join('\n')
}