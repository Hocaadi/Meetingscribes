from fpdf import FPDF
import pandas as pd
from datetime import date
import os

# === CONFIG ===
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
TASK_LOG_FILE = os.path.join(BASE_DIR, "tasks_log.xlsx")
OUTPUT_PDF = os.path.join(BASE_DIR, "invoice_ProjectX.pdf")
CLIENT_NAME = "Project X"
INVOICE_ID = 101

# === LOAD DATA ===
df = pd.read_excel(TASK_LOG_FILE)
client_df = df[df["Client"] == CLIENT_NAME]

# === SETUP PDF ===
pdf = FPDF()
pdf.add_page()
pdf.set_font("Arial", size=12)

pdf.cell(200, 10, txt=f"Invoice #{INVOICE_ID}", ln=True, align="C")
pdf.cell(200, 10, txt=f"Client: {CLIENT_NAME}", ln=True, align="C")
pdf.cell(200, 10, txt=f"Date: {date.today().strftime('%Y-%m-%d')}", ln=True, align="C")
pdf.ln(10)

# === TABLE HEADER ===
pdf.set_font("Arial", "B", 12)
pdf.cell(30, 10, "Date", border=1)
pdf.cell(80, 10, "Task", border=1)
pdf.cell(20, 10, "Hours", border=1)
pdf.cell(20, 10, "Rate", border=1)
pdf.cell(30, 10, "Total", border=1)
pdf.ln()

# === TABLE DATA ===
pdf.set_font("Arial", size=12)
total_all = 0
for _, row in client_df.iterrows():
    task_total = row["Hours"] * row["Rate"]
    total_all += task_total
    pdf.cell(30, 10, str(row["Date"]), border=1)
    pdf.cell(80, 10, str(row["Task"]), border=1)
    pdf.cell(20, 10, str(row["Hours"]), border=1)
    pdf.cell(20, 10, f"${row['Rate']}", border=1)
    pdf.cell(30, 10, f"${task_total}", border=1)
    pdf.ln()

# === TOTAL ===
pdf.ln(10)
pdf.set_font("Arial", "B", 12)
pdf.cell(150, 10, "Total Due:", align="R")
pdf.cell(30, 10, f"${total_all}", border=1, align="C")

# === SAVE PDF ===
pdf.output(OUTPUT_PDF)
print(f"✅ Invoice generated: {OUTPUT_PDF}")
