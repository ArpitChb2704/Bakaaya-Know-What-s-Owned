"""
Invoice PDF generator.

Prints TWO copies of the same bill on one side of an A4 sheet (top: Customer Copy,
bottom: Office Copy) with a cut line between them. If a bill has too many items
to fit in half a page, each copy gets its own A4 page instead, so nothing is cut off.
"""
import io
import base64
from datetime import date
from decimal import Decimal
from html import escape as esc

import qrcode
from weasyprint import HTML

# More items than this (or very long notes) -> one copy per page instead of two-up
MAX_ITEMS_TWO_UP = 7
MAX_NOTES_TWO_UP = 140


def generate_qr_data_uri(data: str) -> str:
    qr = qrcode.QRCode(box_size=6, border=1)
    qr.add_data(data)
    qr.make(fit=True)
    img = qr.make_image(fill_color="black", back_color="white")
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    b64 = base64.b64encode(buf.getvalue()).decode()
    return f"data:image/png;base64,{b64}"


def _money(v) -> str:
    return f"₹{float(v):,.2f}"


def _qty(q) -> str:
    s = f"{Decimal(str(q)):f}"
    if "." in s:
        s = s.rstrip("0").rstrip(".")
    return s


CSS = """
@page { size: A4; margin: 8mm; }
* { margin: 0; padding: 0; box-sizing: border-box; }
body { font-family: Arial, Helvetica, sans-serif; color: #14140F; font-size: 9pt; }
table { width: 100%; border-collapse: collapse; }

.half { height: 130mm; overflow: hidden; }
.cut { height: 11mm; border-top: 1px dashed #8A8478; margin-top: 2mm; padding-top: 2.5mm;
       text-align: center; font-size: 7pt; color: #8A8478; letter-spacing: 0.08em; }
.full { page-break-after: always; }
.full.last { page-break-after: auto; }

.hdr { border-bottom: 1.5px solid #14140F; margin-bottom: 3mm; }
.hdr td { padding-bottom: 2mm; vertical-align: top; }
.hdr .r { text-align: right; }
.brand { font-family: Georgia, 'Times New Roman', serif; font-size: 17pt; font-weight: bold; }
.tag { font-size: 6.5pt; letter-spacing: 0.1em; color: #8A8478; text-transform: uppercase; }
.label { display: inline-block; font-size: 6.5pt; letter-spacing: 0.12em; font-weight: bold;
         border: 1px solid #14140F; padding: 0.5mm 2mm; margin-bottom: 1mm; }
.num { font-size: 11pt; font-weight: bold; }
.muted { font-size: 7.5pt; color: #8A8478; }

.parties { margin-bottom: 3mm; }
.parties td { width: 50%; background: #F7F5F0; padding: 2mm 3mm; vertical-align: top; }
.parties td.gap { width: 2%; background: none; padding: 0; }
.k { font-size: 6.5pt; letter-spacing: 0.1em; color: #8A8478; text-transform: uppercase; }
.n { font-family: Georgia, 'Times New Roman', serif; font-size: 10.5pt; font-weight: bold; }

.items th { text-align: left; font-size: 6.5pt; text-transform: uppercase; letter-spacing: 0.08em;
            color: #8A8478; border-bottom: 1px solid #14140F; padding: 1mm 1.5mm; }
.items td { padding: 1.1mm 1.5mm; border-bottom: 1px solid #EFEAE0; font-size: 8.5pt; }
.items .c { text-align: center; }
.items .rt { text-align: right; }

.tot { margin: 2mm 0 2mm; }
.tot td { text-align: right; font-size: 8pt; color: #8A8478; text-transform: uppercase; letter-spacing: 0.08em; }
.tot .amt { font-size: 13pt; font-weight: bold; color: #14140F; width: 38mm; text-transform: none; letter-spacing: 0; }

.bottom td { vertical-align: bottom; }
.bottom .br { width: 26mm; text-align: center; }
.qr { width: 21mm; height: 21mm; }
.scan { font-size: 6pt; color: #8A8478; }
.notes { font-size: 8pt; color: #555; margin-bottom: 1mm; }

.sign td { width: 48%; }
.sign td.gap { width: 4%; }
.sign .line { border-top: 1px solid #14140F; margin-top: 11mm; padding-top: 1mm;
              font-size: 7pt; color: #555; }

.foot { margin-top: 2.5mm; text-align: center; font-size: 6.5pt; color: #8A8478; line-height: 1.5; }
"""


def _copy_html(label, invoice_number, date_str, business_name, business_phone,
               party_name, party_phone, items, total, notes, qr_uri, credit_days) -> str:
    rows = ""
    for i, it in enumerate(items, start=1):
        rows += f"""
        <tr>
          <td>{i}</td>
          <td>{esc(str(it['item_name']))}</td>
          <td class="c">{_qty(it['quantity'])}</td>
          <td class="rt">{_money(it['unit_price'])}</td>
          <td class="rt"><strong>{_money(it['line_total'])}</strong></td>
        </tr>"""

    biz_phone = f'<div class="muted">{esc(business_phone)}</div>' if business_phone else ""
    party_ph = f'<div class="muted">{esc(party_phone)}</div>' if party_phone else ""
    notes_html = f'<div class="notes"><strong>Notes:</strong> {esc(notes)}</div>' if notes else ""
    qr_html = (f'<img class="qr" src="{qr_uri}" /><div class="scan">Scan to pay (UPI)</div>'
               if qr_uri else "")

    return f"""
    <table class="hdr"><tr>
      <td>
        <div class="brand">Bakaaya</div>
        <div class="tag">What's Owned, What's Owed</div>
      </td>
      <td class="r">
        <div class="label">{label}</div>
        <div class="num">{esc(invoice_number)}</div>
        <div class="muted">Date: {date_str}</div>
      </td>
    </tr></table>

    <table class="parties"><tr>
      <td><div class="k">From</div><div class="n">{esc(business_name)}</div>{biz_phone}</td>
      <td class="gap"></td>
      <td><div class="k">Bill To</div><div class="n">{esc(party_name)}</div>{party_ph}</td>
    </tr></table>

    <table class="items">
      <thead><tr>
        <th style="width:6%">#</th><th style="width:50%">Item</th>
        <th class="c" style="width:10%">Qty</th>
        <th class="rt" style="width:17%">Rate</th><th class="rt" style="width:17%">Total</th>
      </tr></thead>
      <tbody>{rows}</tbody>
    </table>

    <table class="tot"><tr><td>Total</td><td class="amt">{_money(total)}</td></tr></table>

    <table class="bottom"><tr>
      <td>
        {notes_html}
        <table class="sign"><tr>
          <td><div class="line">Customer signature</div></td>
          <td class="gap"></td>
          <td><div class="line">For {esc(business_name)}</div></td>
        </tr></table>
      </td>
      <td class="br">{qr_html}</td>
    </tr></table>

    <div class="foot">
      Credit Period: {credit_days} Days. If any discrepancy in this bill, contact the owner within 2 days.
      &middot; This bill is generated by Bakaaya.
    </div>
    """


def generate_invoice_pdf(invoice_number, business_name, business_phone,
                         party_name, party_phone, items, total,
                         notes, upi_qr_data_uri=None, credit_period_days=2,
                         invoice_date=None) -> bytes:
    invoice_date = invoice_date or date.today()
    date_str = invoice_date.strftime("%d %b %Y")

    args = dict(
        invoice_number=invoice_number, date_str=date_str,
        business_name=business_name, business_phone=business_phone,
        party_name=party_name, party_phone=party_phone,
        items=items, total=total, notes=notes,
        qr_uri=upi_qr_data_uri, credit_days=credit_period_days,
    )
    top = _copy_html(label="CUSTOMER COPY", **args)
    bottom = _copy_html(label="OFFICE COPY", **args)

    two_up = len(items) <= MAX_ITEMS_TWO_UP and len(notes or "") <= MAX_NOTES_TWO_UP
    if two_up:
        body = (f'<div class="half">{top}</div>'
                f'<div class="cut">&#9986; &nbsp; CUT HERE</div>'
                f'<div class="half">{bottom}</div>')
    else:
        body = f'<div class="full">{top}</div><div class="full last">{bottom}</div>'

    html = (f"<!DOCTYPE html><html><head><meta charset='UTF-8'><style>{CSS}</style></head>"
            f"<body>{body}</body></html>")
    return HTML(string=html).write_pdf()