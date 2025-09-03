/* ========= GLOBALS ========= */
let rows = [];
let categoryChart, monthlyChart;
const $ = sel => document.querySelector(sel);
const $$ = sel => document.querySelectorAll(sel);

/* ========= HELPERS ========= */
const toNum = v => Number(String(v).replace(/[^0-9.-]/g, '')) || 0;
const fmt = n => (isFinite(n) ? n.toFixed(2) : '0.00');
const byId = id => document.getElementById(id);

/* ========= AUTO UPLOAD HANDLER ========= */
document.addEventListener('DOMContentLoaded', () => {
  const inp = document.getElementById('receiptInput');   // file input
  if (inp) {
    inp.addEventListener('change', () => {
      processReceipt();  // run OCR/extractor automatically
    });
  }
});

/* ========= MAIN FUNCTIONS ========= */

// Add row to table
function addRow(r) {
  rows.push(r);
  const tr = document.createElement('tr');

  // Compliance checks
  const checks = [];
  if (!r.supplier) checks.push('No supplier');
  if (!r.date) checks.push('No date');
  if (!r.gross) checks.push('No gross');

  const tick = checks.length ? '❌' : '✅';
  const audit = checks.length ? checks.join(', ') : 'OK';

  tr.innerHTML = `
    <td>${r.supplier || ''}</td>
    <td>${r.vatNo || ''}</td>
    <td>${r.date || ''}</td>
    <td>${r.desc || ''}</td>
    <td>${fmt(r.net)}</td>
    <td>${fmt(r.vat)}</td>
    <td>${fmt(r.gross)}</td>
    <td>${r.method || ''}</td>
    <td>${tick}</td>
    <td>${audit}</td>
  `;
  $('#ledger tbody').appendChild(tr);
  recalcTotals();
  updateCharts();
}

// Recalculate totals
function recalcTotals() {
  const totalNet = rows.reduce((s, r) => s + toNum(r.net), 0);
  const totalVAT = rows.reduce((s, r) => s + toNum(r.vat), 0);
  const totalGross = rows.reduce((s, r) => s + toNum(r.gross), 0);

  byId('totalNet').textContent = fmt(totalNet);
  byId('totalVAT').textContent = fmt(totalVAT);
  byId('totalGross').textContent = fmt(totalGross);
}

// Update charts
function updateCharts() {
  const ctx1 = byId('categoryChart').getContext('2d');
  const ctx2 = byId('monthlyChart').getContext('2d');

  const categories = {};
  const months = {};

  rows.forEach(r => {
    const cat = r.desc || 'Other';
    categories[cat] = (categories[cat] || 0) + toNum(r.gross);

    const month = r.date ? r.date.slice(0, 7) : 'Unknown';
    months[month] = (months[month] || 0) + toNum(r.gross);
  });

  if (categoryChart) categoryChart.destroy();
  if (monthlyChart) monthlyChart.destroy();

  categoryChart = new Chart(ctx1, {
    type: 'pie',
    data: {
      labels: Object.keys(categories),
      datasets: [{
        data: Object.values(categories),
        backgroundColor: ['#DAA520', '#FFD700', '#B8860B', '#FF8C00', '#CD853F']
      }]
    }
  });

  monthlyChart = new Chart(ctx2, {
    type: 'bar',
    data: {
      labels: Object.keys(months),
      datasets: [{
        label: 'Monthly Spend',
        data: Object.values(months),
        backgroundColor: '#DAA520'
      }]
    }
  });
}

// Process uploaded receipt
async function processReceipt() {
  const file = byId('receiptInput').files[0];
  if (!file) return;

  const { createWorker } = Tesseract;
  const worker = await createWorker('eng');
  const { data } = await worker.recognize(file);

  // Dummy parse
  const r = {
    supplier: 'Parsed Supplier',
    vatNo: 'GB123456789',
    date: new Date().toISOString().slice(0, 10),
    desc: 'Sample Item',
    net: 10,
    vat: 2,
    gross: 12,
    method: 'Card'
  };
  addRow(r);
  await worker.terminate();
}

// Manual entry
function saveManual() {
  const r = {
    supplier: byId('manSupplier').value,
    vatNo: byId('manVAT').value,
    date: byId('manDate').value,
    desc: byId('manDesc').value,
    net: toNum(byId('manNet').value),
    vat: toNum(byId('manVATamt').value),
    gross: toNum(byId('manGross').value),
    method: byId('manMethod').value
  };
  addRow(r);
}

// Export CSV
function exportCSV() {
  const header = 'Supplier,VAT No,Date,Description,Net,VAT,Gross,Method,Checks,Audit\n';
  const csv = rows.map(r => [
    r.supplier, r.vatNo, r.date, r.desc,
    r.net, r.vat, r.gross, r.method
  ].join(',')).join('\n');
  downloadFile('receipts.csv', header + csv);
}

// Export PDF
function exportPDF() {
  const doc = new jsPDF();
  doc.text('Receipts Report', 14, 16);
  doc.autoTable({ html: '#ledger' });
  doc.save('receipts.pdf');
}

function downloadFile(name, content) {
  const blob = new Blob([content], { type: 'text/csv' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
}

// Clear demo data
function clearDemo() {
  rows = [];
  $('#ledger tbody').innerHTML = '';
  recalcTotals();
  updateCharts();
}
