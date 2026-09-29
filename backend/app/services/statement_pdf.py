"""
Statement PDF Generator
Generates a professional account statement for any party, matching
the Bakaaya statement design, rendered to PDF via WeasyPrint.
"""
from datetime import date
from decimal import Decimal
from weasyprint import HTML


def generate_statement_pdf(party_name, party_gst, party_location, business_name,
                            transactions, from_date, to_date,
                            opening_balance, total_debit, total_credit, closing_balance) -> bytes:
    rows_html = ""
    running = Decimal(str(opening_balance))
    rows_html += f"""
        <tr>
            <td>{from_date}</td>
            <td>Opening Balance</td>
            <td style="text-align:right">—</td>
            <td style="text-align:right">—</td>
            <td style="text-align:right;font-weight:600">₹{abs(float(running)):,.0f}</td>
        </tr>"""
    for t in transactions:
        is_debit = t["transaction_type"] in ("bill", "sale")
        amount = Decimal(str(t["amount"]))
        running = running + amount if is_debit else running - amount
        debit_str = f"₹{float(amount):,.0f}" if is_debit else "—"
        credit_str = f"₹{float(amount):,.0f}" if not is_debit else "—"
        label = (t.get("notes") or t["transaction_type"].replace("_", " ").title())
        rows_html += f"""
        <tr>
            <td>{t['transaction_date']}</td>
            <td>{label}</td>
            <td style="text-align:right">{debit_str}</td>
            <td style="text-align:right">{credit_str}</td>
            <td style="text-align:right;font-weight:600">₹{abs(float(running)):,.0f}</td>
        </tr>"""

    due_color = "#B3401E" if closing_balance > 0 else "#1F6E5C"
    due_bg = "#FBEDE7" if closing_balance > 0 else "#EAF3EF"
    due_label = f"Receivable from {party_name}" if closing_balance > 0 else "No amount due"

    html = f"""<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
  * {{ margin:0; padding:0; box-sizing:border-box; }}
  body {{ font-family: Georgia, 'Times New Roman', serif; color: #14140F; background: #fff; padding: 36px; }}
  .brand {{ font-size:26px; font-weight:700; }}
  .subtitle {{ font-family: Arial, sans-serif; font-size:11px; letter-spacing:0.12em; color:#8A8478; text-transform:uppercase; margin-top:4px; }}
  .header {{ display:flex; justify-content:space-between; align-items:flex-start; padding-bottom:16px; border-bottom:1px solid #D9D2C3; margin-bottom:24px; }}
  .meta {{ text-align:right; font-family: Arial, sans-serif; }}
  .meta .label {{ font-size:10px; letter-spacing:0.1em; color:#8A8478; text-transform:uppercase; }}
  .meta .period {{ font-size:15px; font-weight:600; margin-top:2px; }}
  .meta .generated {{ font-size:11px; color:#8A8478; margin-top:4px; }}
  .party-row {{ display:flex; justify-content:space-between; margin-bottom:24px; font-family: Arial, sans-serif; }}
  .party-row .plabel {{ font-size:10px; letter-spacing:0.1em; color:#8A8478; text-transform:uppercase; }}
  .party-row h2 {{ font-family: Georgia, serif; font-size:20px; margin:2px 0 4px; }}
  .party-row .sub {{ font-size:12px; color:#8A8478; }}
  .cards {{ display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:28px; font-family: Arial, sans-serif; }}
  .card {{ background:#F7F5F0; border-radius:4px; padding:16px; }}
  .card.due {{ background:{due_bg}; }}
  .card p.label {{ font-size:10px; letter-spacing:0.1em; color:#8A8478; text-transform:uppercase; margin-bottom:6px; }}
  .card.due p.label {{ color:{due_color}; }}
  .card h3 {{ font-size:24px; font-weight:700; }}
  .card.due h3 {{ color:{due_color}; }}
  .card .note {{ font-size:11px; color:{due_color}; margin-top:4px; }}
  h4.section {{ font-size:16px; margin-bottom:10px; }}
  table {{ width:100%; border-collapse:collapse; font-size:12px; font-family: Arial, sans-serif; }}
  th {{ text-align:left; padding:8px 10px; font-size:10px; text-transform:uppercase; letter-spacing:0.08em; color:#8A8478; border-bottom:1px solid #D9D2C3; font-weight:600; }}
  td {{ padding:8px 10px; border-bottom:1px solid #EFEAE0; }}
  .legend {{ font-family: Arial, sans-serif; font-size:10px; color:#8A8478; margin-top:10px; }}
  .netrow {{ display:flex; justify-content:space-between; align-items:center; margin-top:20px; padding-top:16px; border-top:1px solid #D9D2C3; }}
  .netrow h3 {{ font-size:16px; }}
  .netrow .amt {{ font-size:20px; font-weight:700; color:{due_color}; }}
  .footer {{ margin-top:24px; text-align:center; font-family: Arial, sans-serif; font-size:10px; color:#8A8478; }}
</style>
</head>
<body>
<div class="header">
  <div>
    <div class="brand">Bakaaya</div>
    <div class="subtitle">Party Account Statement</div>
  </div>
  <div class="meta">
    <div class="label">Statement Period</div>
    <div class="period">{from_date} &ndash; {to_date}</div>
    <div class="generated">Generated: {date.today().strftime('%d %b %Y')}</div>
  </div>
</div>

<div class="party-row">
  <div>
    <div class="plabel">Party Name</div>
    <h2>{party_name}</h2>
    {f'<div class="sub">GSTIN: {party_gst}</div>' if party_gst else ''}
    {f'<div class="sub">{party_location}</div>' if party_location else ''}
  </div>
</div>

<div class="cards">
  <div class="card">
    <p class="label">Total Purchases</p>
    <h3>₹{float(total_debit):,.0f}</h3>
  </div>
  <div class="card">
    <p class="label">Total Paid</p>
    <h3 style="color:#1F6E5C">₹{float(total_credit):,.0f}</h3>
  </div>
  <div class="card">
    <p class="label">Opening Balance</p>
    <h3>₹{float(opening_balance):,.0f}</h3>
  </div>
  <div class="card due">
    <p class="label">Outstanding Due</p>
    <h3>₹{abs(float(closing_balance)):,.0f}</h3>
    <div class="note">{due_label}</div>
  </div>
</div>

<h4 class="section">Transaction Details</h4>
<table>
  <thead>
    <tr><th>Date</th><th>Particulars</th><th style="text-align:right">Debit</th><th style="text-align:right">Credit</th><th style="text-align:right">Balance</th></tr>
  </thead>
  <tbody>{rows_html}</tbody>
</table>
<div class="legend">Debit = new sale / amount owed by customer. Credit = payment received.</div>

<div class="netrow">
  <h3>Net Outstanding</h3>
  <div class="amt">₹{abs(float(closing_balance)):,.0f} {'Dr' if closing_balance > 0 else 'Cr'}</div>
</div>

<div class="footer">Generated by Bakaaya &middot; This is a computer-generated statement.</div>
</body>
</html>"""

    return HTML(string=html).write_pdf()