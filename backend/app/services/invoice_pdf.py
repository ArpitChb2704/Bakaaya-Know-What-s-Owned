from datetime import date
from decimal import Decimal
from weasyprint import HTML
import qrcode
import io
import base64




def generate_qr_data_uri(data: str) -> str:
    qr = qrcode.QRCode(box_size=6, border=1)
    qr.add_data(data)
    qr.make(fit=True)
    img = qr.make_image(fill_color="black", back_color="white")
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    b64 = base64.b64encode(buf.getvalue()).decode()
    return f"data:image/png;base64,{b64}"


def generate_invoice_pdf(invoice_number, business_name, business_phone,
                          party_name, party_phone, items, total,
                          notes, upi_qr_data_uri=None, credit_period_days=7) -> bytes:
    rows_html = ""
    for i, item in enumerate(items, start=1):
        rows_html += f"""
        <tr>
            <td>{i}</td>
            <td>{item['item_name']}</td>
            <td style="text-align:center">{item['quantity']}</td>
            <td style="text-align:right">₹{float(item['unit_price']):,.2f}</td>
            <td style="text-align:right;font-weight:600">₹{float(item['line_total']):,.2f}</td>
        </tr>"""

    qr_html = f'<img src="{upi_qr_data_uri}" style="width:110px;height:110px;" />' if upi_qr_data_uri else ""

    html = f"""<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
  * {{ margin:0; padding:0; box-sizing:border-box; }}
  body {{ font-family: Georgia, 'Times New Roman', serif; color:#14140F; background:#fff; padding:36px; }}
  .header {{ display:flex; justify-content:space-between; align-items:flex-start; border-bottom:2px solid #14140F; padding-bottom:16px; margin-bottom:20px; }}
  .brand {{ font-size:28px; font-weight:700; }}
  .tagline {{ font-family: Arial, sans-serif; font-size:10px; letter-spacing:0.1em; color:#8A8478; text-transform:uppercase; margin-top:2px; }}
  .inv-meta {{ text-align:right; font-family: Arial, sans-serif; }}
  .inv-meta .num {{ font-size:16px; font-weight:700; }}
  .inv-meta .date {{ font-size:11px; color:#8A8478; margin-top:4px; }}
  .parties {{ display:grid; grid-template-columns:1fr 1fr; gap:20px; margin-bottom:24px; font-family: Arial, sans-serif; }}
  .party-box {{ background:#F7F5F0; border-radius:4px; padding:14px 16px; }}
  .party-box .label {{ font-size:10px; letter-spacing:0.1em; color:#8A8478; text-transform:uppercase; margin-bottom:4px; }}
  .party-box .name {{ font-family: Georgia, serif; font-size:15px; font-weight:700; }}
  .party-box .sub {{ font-size:11px; color:#8A8478; margin-top:2px; }}
  table {{ width:100%; border-collapse:collapse; font-size:12px; font-family: Arial, sans-serif; margin-bottom:16px; }}
  th {{ text-align:left; padding:8px 10px; font-size:10px; text-transform:uppercase; letter-spacing:0.08em; color:#8A8478; border-bottom:1px solid #14140F; font-weight:600; }}
  td {{ padding:8px 10px; border-bottom:1px solid #EFEAE0; }}
  .total-row {{ display:flex; justify-content:flex-end; margin-bottom:24px; }}
  .total-box {{ font-family: Arial, sans-serif; text-align:right; }}
  .total-box .label {{ font-size:11px; color:#8A8478; text-transform:uppercase; letter-spacing:0.08em; }}
  .total-box .amt {{ font-size:24px; font-weight:700; }}
  .notes {{ font-family: Arial, sans-serif; font-size:12px; color:#555; margin-bottom:20px; }}
  .pay-section {{ display:flex; justify-content:space-between; align-items:center; border-top:1px solid #D9D2C3; padding-top:16px; margin-bottom:16px; }}
  .footer {{ font-family: Arial, sans-serif; font-size:10px; color:#8A8478; text-align:center; border-top:1px solid #D9D2C3; padding-top:14px; line-height:1.7; }}
</style>
</head>
<body>
<div class="header">
  <div>
    <div class="brand">Bakaaya</div>
    <div class="tagline">What's Owned, What's Owed</div>
  </div>
  <div class="inv-meta">
    <div class="num">{invoice_number}</div>
    <div class="date">Date: {date.today().strftime('%d %b %Y')}</div>
  </div>
</div>

<div class="parties">
  <div class="party-box">
    <div class="label">From</div>
    <div class="name">{business_name}</div>
    {f'<div class="sub">{business_phone}</div>' if business_phone else ''}
  </div>
  <div class="party-box">
    <div class="label">Bill To</div>
    <div class="name">{party_name}</div>
    {f'<div class="sub">{party_phone}</div>' if party_phone else ''}
  </div>
</div>

<table>
  <thead>
    <tr><th>#</th><th>Item</th><th style="text-align:center">Qty</th><th style="text-align:right">Rate</th><th style="text-align:right">Total</th></tr>
  </thead>
  <tbody>{rows_html}</tbody>
</table>

<div class="total-row">
  <div class="total-box">
    <div class="label">Total</div>
    <div class="amt">₹{float(total):,.2f}</div>
  </div>
</div>

{f'<div class="notes"><strong>Notes:</strong> {notes}</div>' if notes else ''}

<div class="pay-section">
  <div class="footer" style="text-align:left;border:none;padding:0">
    Pay via UPI using the QR code.
  </div>
  {qr_html}
</div>

<div class="footer">
  Credit Period: {credit_period_days} Days. If any discrepancies in this bill, please contact the owner within 2 days.<br>
  This bill is generated by Bakaaya.
</div>
</body>
</html>"""
    return HTML(string=html).write_pdf()