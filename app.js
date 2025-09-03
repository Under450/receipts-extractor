/* ======== GLOBALS ======== */
let rows = [];
let categoryChart, monthlyChart;
const $ = sel => document.querySelector(sel);
const $$ = sel => document.querySelectorAll(sel);

/* ======== HELPERS ======== */
const toNum = v => Number(String(v).replace(/[^0-9.\-]/g, '')) || 0;
const fmt  = n => (isFinite(n) ? n.toFixed(2) : '0.00');
const byId = id => document.getElementById(id);

function addRow(r) {
  rows.push(r);
  const tr = document.createElement('tr');

  // Compliance checks
  const checks = [];
  if (!r.supplier) checks.push('No supplier');
  if (!r.date)     checks.push('No date');
  if (!r.gross)    checks.push('No gross');

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

function recalcTotals() {
  const tNet   = rows.reduce((a,b)=>a+toNum(b.net),0);
  const tVAT   = rows.reduce((a,b)=>a+toNum(b.vat),0);
  const tGross = rows.reduce((a,b)=>a+toNum(b.gross),0);
  byId('totalNet').textContent   = fmt(tNet);
  byId('totalVAT').textContent   = fmt(tVAT);
  byId('totalGross').textContent = fmt(tGross);
}

/* ======== OCR + PARSE ======== */
async function processReceipt() {
  const file = byId('receiptInput').files[0];
  if (!file) { alert('Choose or take a receipt photo first.'); return; }

  const { createWorker } = Tesseract;
  const worker = await createWorker('eng');
  const { data: { text } } = await worker.recognize(file);
  await worker.terminate();

  // Basic parsing
  const lines = text.split(/\r?\n/).map(s=>s.trim()).filter(Boolean);
  const blob  = text.replace(/\s+/g,' ');
  const supplier = (lines[0] || '').slice(0,60);

  const vatNoMatch = blob.match(/\b(G(?:B|B0)?\s*)?\d{9}\b/i);
  const vatNo = vatNoMatch ? vatNoMatch[0].replace(/\s+/g,'') : '';

  const dateMatch = blob.match(/\b(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}|\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2})\b/);
  const date = dateMatch ? dateMatch[0] : '';

  // Try to find amounts
  // Prefer labeled totals, otherwise take the 3 largest numbers as net, vat, gross
  const amountMatches = [...blob.matchAll(/(?:total|gross|amount|vat|subtotal)?\s*£?\s*([0-9]+(?:\.[0-9]{2})?)/gi)]
                        .map(m => toNum(m[1]))
                        .filter(n => n>0)
                        .sort((a,b)=>a-b);

  let gross = 0, vat = 0, net = 0;

  // Look for labeled VAT
  const vatLabeled = blob.match(/vat[^0-9]{0,8}([0-9]+(?:\.[0-9]{2})?)/i);
  if (vatLabeled) vat = toNum(vatLabeled[1]);

  // Look for labeled total/gross
  const grossLabeled = blob.match(/(total|gross)[^0-9]{0,8}([0-9]+(?:\.[0-9]{2})?)/i);
  if (grossLabeled) gross = toNum(grossLabeled[2]);

  if (!gross && amountMatches.length) gross = amountMatches[amountMatches.length-1];
  if (!vat && amountMatches.length>1) vat = amountMatches[amountMatches.length-2];

  net = gross && vat ? (gross - vat) : (amountMatches.length>2 ? amountMatches[amountMatches.length-3] : 0);

  const desc = (lines.slice(1,5).join(' ') || 'Receipt').slice(0,80);

  addRow({
    supplier,
    vatNo,
    date,
    desc,
    net, vat, gross,
    method: 'Card/Cash'
  });
}

/* ======== MANUAL ENTRY ======== */
function saveManual() {
  const r = {
    supplier: byId('manSupplier').value.trim(),
    vatNo:    byId('manVAT').value.trim(),
    date:     byId('manDate').value.trim(),
    desc:     byId('manDesc').value.trim(),
    net:      toNum(byId('manNet').value),
    vat:      toNum(byId('manVATamt').value),
    gross:    toNum(byId('manGross').value),
    method:   byId('manMethod').value.trim()
  };
  addRow(r);
  // clear
  ['manSupplier','manVAT','manDate','manDesc','manNet','manVATamt','manGross','manMethod']
    .forEach(id => byId(id).value = '');
}

/* ======== EXPORTS ======== */
function exportCSV() {
  const head = ['Supplier','VAT No','Date','Description','Net','VAT','Gross','Method','Checks','Audit'];
  const lines = [head.join(',')];
  const tbody = $$('#ledger tbody tr');

  tbody.forEach(tr => {
    const tds = [...tr.children].map(td => `"${td.textContent.replace(/"/g,'""')}"`);
    lines.push(tds.join(','));
  });

  const blob = new Blob([lines.join('\n')], {type:'text/csv'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'receipts.csv';
  a.click();
  URL.revokeObjectURL(a.href);
}

async function exportPDF() {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit:'pt', format:'a4' });

  doc.setFontSize(16);
  doc.text('HMRC Receipt Report', 40, 40);

  // Table screenshot
  const tableEl = $('#ledger');
  const tableCanvas = await html2canvas(tableEl, {backgroundColor:null, scale:2});
  const tImg = tableCanvas.toDataURL('image/png');
  const tW = 515, tH = tableCanvas.height * (tW / tableCanvas.width);
  doc.addImage(tImg, 'PNG', 40, 70, tW, tH);

  // Charts screenshot
  const chartsEl = $('#charts');
  const chartsCanvas = await html2canvas(chartsEl, {backgroundColor:null, scale:2});
  const cImg = chartsCanvas.toDataURL('image/png');
  let y = 80 + tH;
  if (y + 260 > 780) { doc.addPage(); y = 60; }
  doc.addImage(cImg, 'PNG', 40, y, 515, 260);

  doc.save('receipts.pdf');
}

/* ======== DEMO/UTIL ======== */
function clearDemo() {
  rows = [];
  $('#ledger tbody').innerHTML = '';
  recalcTotals();
  updateCharts();
}

/* ======== CHARTS ======== */
function ensureCharts() {
  const ctx1 = byId('categoryChart').getContext('2d');
  const ctx2 = byId('monthlyChart').getContext('2d');

  if (!categoryChart) {
    categoryChart = new Chart(ctx1, {
      type: 'pie',
      data: { labels: [], datasets: [{ data: [] }] },
      options: { plugins: { legend: { labels: { color: '#fff' } } } }
    });
  }
  if (!monthlyChart) {
    monthlyChart = new Chart(ctx2, {
      type: 'bar',
      data: { labels: [], datasets: [{ label:'Monthly Spend', data: [] }] },
      options: {
        scales: {
          x: { ticks:{ color:'#fff' }, grid:{ color:'#333' } },
          y: { ticks:{ color:'#fff' }, grid:{ color:'#333' } }
        },
        plugins: { legend: { labels: { color:'#fff' } } }
      }
    });
  }
}

function updateCharts() {
  ensureCharts();

  // Category by description keyword
  const cats = {};
  rows.forEach(r=>{
    const d = (r.desc || '').toLowerCase();
    let c = 'Other';
    if (/fuel|petrol|diesel|shell|bp|esso/.test(d)) c = 'Fuel';
    else if (/food|meal|cafe|restaurant|supermarket|tesco|asda|sainsbury/.test(d)) c = 'Food';
    else if (/tool|hardware|screwfix|b&q|wickes/.test(d)) c = 'Tools';
    else if (/hotel|stay|accommodation/.test(d)) c = 'Lodging';
    cats[c] = (cats[c]||0)+toNum(r.gross);
  });
  categoryChart.data.labels = Object.keys(cats);
  categoryChart.data.datasets[0].data = Object.values(cats);
  categoryChart.update();

  // Monthly totals (by dd/mm/yyyy or yyyy-mm-dd)
  const months = {};
  rows.forEach(r=>{
    const m = r.date ? (r.date.match(/\d{4}-\d{2}/)?.[0] ||
                        r.date.replace(/(\d{2})\/(\d{2})\/(\d{4}).*/, '$3-$2')) : 'Unknown';
    months[m] = (months[m]||0)+toNum(r.gross);
  });
  const labels = Object.keys(months).sort();
  monthlyChart.data.labels = labels;
  monthlyChart.data.datasets[0].data = labels.map(k=>months[k]);
  monthlyChart.update();
}

/* ======== EXPOSE TO WINDOW (HTML onclicks) ======== */
window.processReceipt = processReceipt;
window.exportCSV = exportCSV;
window.exportPDF = exportPDF;
window.clearDemo = clearDemo;
window.saveManual = saveManual;

// init empty charts
document.addEventListener('DOMContentLoaded', () => updateCharts());
