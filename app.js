// Demo Data Extraction
function extractText() {
  alert("OCR extraction placeholder – integrate Tesseract.js here.");
}

// Export CSV
function exportCSV() {
  alert("Export CSV clicked.");
}

// Export PDF
function exportPDF() {
  alert("Export PDF clicked.");
}

// Clear Demo Data
function clearDemo() {
  document.querySelector("#receiptTable tbody").innerHTML = "";
  document.getElementById("netTotal").textContent = "0";
  document.getElementById("vatTotal").textContent = "0";
  document.getElementById("grossTotal").textContent = "0";
}

// Charts
window.onload = function() {
  const pieCtx = document.getElementById("pieChart").getContext("2d");
  const barCtx = document.getElementById("barChart").getContext("2d");

  new Chart(pieCtx, {
    type: "pie",
    data: {
      labels: ["Supplies", "Travel", "Meals"],
      datasets: [{
        data: [120, 80, 50],
        backgroundColor: ["#daa520", "#888", "#444"]
      }]
    }
  });

  new Chart(barCtx, {
    type: "bar",
    data: {
      labels: ["Jan", "Feb", "Mar"],
      datasets: [{
        label: "Spend (£)",
        data: [200, 150, 300],
        backgroundColor: "#daa520"
      }]
    }
  });
};
