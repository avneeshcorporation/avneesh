// Selectors
const productBody = document.getElementById('productBody');
const addRowBtn = document.getElementById('addRow');
const downloadBtn = document.getElementById('downloadBtn');
const downloadMenu = document.getElementById('downloadMenu');
const dropdownItems = document.querySelectorAll('.dropdown-item');
const sameAsBillTo = document.getElementById('sameAsBillTo');
const shipToFields = document.getElementById('shipToFields');
const invoiceForm = document.getElementById('invoiceForm');
const copySelector = document.getElementById('copySelector');

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    // Add 1 default row
    addNewRow();

    // Set default date
    const today = new Date();
    document.getElementById('invoiceDate').value = today.toISOString().split('T')[0];
    updatePreviewText('invoice-date', formatDate(today));

    // Setup event listeners
    setupEventListeners();

    // Initial sync of all default values
    syncAllToPreview();
});

function setupEventListeners() {
    // Checkbox for Ship To
    sameAsBillTo.addEventListener('change', (e) => {
        if (e.target.checked) {
            shipToFields.classList.add('hidden');
            // Sync Ship To with Bill To in preview
            document.getElementById('preview-ship-to-name').textContent = document.getElementById('buyerName').value;
            document.getElementById('preview-ship-to-address').textContent = document.getElementById('buyerAddress').value;
            document.getElementById('preview-ship-to-gst').textContent = document.getElementById('buyerGST').value;
            document.getElementById('preview-ship-to-state').textContent = document.getElementById('buyerStateCode').value;
        } else {
            shipToFields.classList.remove('hidden');
        }
    });

    // Copy Type Selector
    copySelector.addEventListener('change', (e) => {
        document.getElementById('copyText').textContent = `(${e.target.value})`;
    });

    // Row management
    addRowBtn.addEventListener('click', () => {
        addNewRow();
        calculateTotals();
    });

    // Live Sync & Calculations
    invoiceForm.addEventListener('input', (e) => {
        const syncKey = e.target.getAttribute('data-sync');

        // Handlers for specific fields
        if (syncKey) {
            let val = e.target.value;
            if (e.target.type === 'date') val = formatDate(new Date(val));
            updatePreviewText(syncKey, val);

            // If Ship To is synced with Bill To
            if (sameAsBillTo.checked && syncKey.startsWith('bill-to-')) {
                const shipKey = syncKey.replace('bill-to-', 'ship-to-');
                updatePreviewText(shipKey, val);
            }
        }

        // Trigger calculations if numerical inputs change
        if (e.target.type === 'number' || e.target.classList.contains('calc-trigger')) {
            const row = e.target.closest('tr');
            if (row) calculateRow(row);
            calculateTotals();
        }
    });

    // Dropdown Toggle
    downloadBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        downloadBtn.parentElement.classList.toggle('open');
    });

    // Dropdown item selection
    dropdownItems.forEach(item => {
        item.addEventListener('click', () => {
            const copyType = item.getAttribute('data-copy');
            generatePDF(copyType);
            downloadBtn.parentElement.classList.remove('open');
        });
    });

    // Close dropdown clicking outside
    window.addEventListener('click', () => {
        downloadBtn.parentElement.classList.remove('open');
    });
}

function updatePreviewText(key, value) {
    const el = document.getElementById(`preview-${key}`) || document.getElementById(`p-${key}`);
    if (el) el.textContent = value || '';
}

function syncAllToPreview() {
    const inputs = invoiceForm.querySelectorAll('[data-sync]');
    inputs.forEach(input => {
        let val = input.value;
        if (input.type === 'date') val = formatDate(new Date(val));
        updatePreviewText(input.getAttribute('data-sync'), val);
    });
}

function formatDate(date) {
    if (!date || isNaN(date.getTime())) return '';
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
}

function addNewRow() {
    const rowCount = productBody.children.length + 1;
    const tr = document.createElement('tr');
    tr.innerHTML = `
        <td class="sn-cell">${rowCount}.</td>
        <td><input type="text" class="product-desc calc-trigger" placeholder="e.g. MS SKULL" value=""></td>
        <td><input type="text" class="product-hsn calc-trigger center-text" placeholder="HSN/SAC" value=""></td>
        <td><input type="number" class="product-qty calc-trigger right-text" value="0" step="0.001"></td>
        <td><input type="number" class="product-rate calc-trigger right-text" value="0" step="0.01"></td>
        <td><button type="button" class="btn btn-danger btn-sm remove-row" style="padding: 0.2rem 0.5rem; font-size: 0.9rem;">×</button></td>
    `;

    tr.querySelector('.remove-row').addEventListener('click', () => {
        if (productBody.children.length > 1) {
            tr.remove();
            updateRowNumbers();
            calculateTotals();
        }
    });

    productBody.appendChild(tr);
    updatePreviewTable();
}

function updateRowNumbers() {
    Array.from(productBody.children).forEach((row, index) => {
        row.cells[0].textContent = (index + 1) + '.';
    });
}

function calculateRow(row) {
    // This function is kept for legacy but calculations are now centralized in updatePreviewTable
    updatePreviewTable();
}

function updatePreviewTable() {
    const previewBody = document.getElementById('preview-product-body');
    previewBody.innerHTML = '';

    let subTotal = 0;
    const rows = Array.from(productBody.children);

    rows.forEach((row, index) => {
        const desc = row.querySelector('.product-desc').value;
        const hsn = row.querySelector('.product-hsn').value;
        const qty = parseFloat(row.querySelector('.product-qty').value) || 0;
        const rate = parseFloat(row.querySelector('.product-rate').value) || 0;
        const amount = qty * rate;
        subTotal += amount;

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td class="center">${index + 1}.</td>
            <td>${desc || '---'}</td>
            <td class="center">${hsn || '---'}</td>
            <td class="center">${formatNumber(qty)}<br>KGS</td>
            <td class="center">${formatNumber(rate)} /-<br>Per KGS</td>
            <td class="right">${formatNumber(amount)}</td>
        `;
        previewBody.appendChild(tr);
    });

    // Add spacer row if items are few
    if (rows.length < 5) {
        const spacer = document.createElement('tr');
        spacer.className = 'spacer-row';
        spacer.innerHTML = `<td colspan="6"></td>`;
        previewBody.appendChild(spacer);
    }

    calculateTotals(subTotal);
}

function calculateTotals(subTotalValue) {
    let subTotal = subTotalValue;
    if (subTotal === undefined) {
        subTotal = 0;
        Array.from(productBody.children).forEach(row => {
            const qty = parseFloat(row.querySelector('.product-qty').value) || 0;
            const rate = parseFloat(row.querySelector('.product-rate').value) || 0;
            subTotal += (qty * rate);
        });
    }

    const cgstRate = parseFloat(document.getElementById('cgst').value) || 0;
    const sgstRate = parseFloat(document.getElementById('sgst').value) || 0;
    const igstRate = parseFloat(document.getElementById('igst').value) || 0;

    const cgstVal = (subTotal * cgstRate) / 100;
    const sgstVal = (subTotal * sgstRate) / 100;
    const igstVal = (subTotal * igstRate) / 100;
    const grossTotal = subTotal + cgstVal + sgstVal + igstVal;

    // Update Preview
    document.getElementById('preview-subtotal').textContent = formatNumber(subTotal);

    document.getElementById('preview-cgst-rate').textContent = cgstRate;
    document.getElementById('preview-cgst-val').textContent = cgstVal > 0 ? formatNumber(cgstVal) : '-';

    document.getElementById('preview-sgst-rate').textContent = sgstRate;
    document.getElementById('preview-sgst-val').textContent = sgstVal > 0 ? formatNumber(sgstVal) : '-';

    document.getElementById('preview-igst-rate').textContent = igstRate;
    document.getElementById('preview-igst-val').textContent = igstVal > 0 ? formatNumber(igstVal) : '-';

    document.getElementById('preview-gross-total').textContent = formatNumber(grossTotal);

    const words = numberToWords(Math.round(grossTotal));
    document.getElementById('preview-amount-words').textContent = words ? (words + " ONLY") : "ZERO RUPEES ONLY";
}

function formatNumber(num) {
    return num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// Indian Number System Converter
function numberToWords(num) {
    if (num === 0) return '';
    const a = ['', 'ONE ', 'TWO ', 'THREE ', 'FOUR ', 'FIVE ', 'SIX ', 'SEVEN ', 'EIGHT ', 'NINE ', 'TEN ', 'ELEVEN ', 'TWELVE ', 'THIRTEEN ', 'FOURTEEN ', 'FIFTEEN ', 'SIXTEEN ', 'SEVENTEEN ', 'EIGHTEEN ', 'NINETEEN '];
    const b = ['', '', 'TWENTY ', 'THIRTY ', 'FORTY ', 'FIFTY ', 'SIXTY ', 'SEVENTY ', 'EIGHTY ', 'NINETY '];

    const convert_less_than_thousand = (n) => {
        if (n === 0) return '';
        if (n < 20) return a[n];
        const res = b[Math.floor(n / 10)] + a[n % 10];
        return res;
    };

    const convert_with_suffix = (n, suffix) => {
        if (n === 0) return '';
        if (n < 100) return convert_less_than_thousand(n) + suffix;
        return a[Math.floor(n / 100)] + 'HUNDRED ' + convert_less_than_thousand(n % 100) + suffix;
    };

    let str = '';
    str += convert_with_suffix(Math.floor(num / 10000000), 'CRORE ');
    str += convert_with_suffix(Math.floor((num / 100000) % 100), 'LAKH ');
    str += convert_with_suffix(Math.floor((num / 1000) % 100), 'THOUSAND ');
    str += convert_with_suffix(num % 1000, '');

    return str.trim();
}

// PDF Generation Logic
async function generatePDF(copyType) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('p', 'mm', 'a4');

    const allCopies = [
        "ORIGINAL FOR RECIPIENT",
        "DUPLICATE FOR TRANSPORTER",
        "SUPPLIER COPY"
    ];

    const copiesToRender = copyType === 'ALL' ? allCopies : [copyType];

    copiesToRender.forEach((title, index) => {
        if (index > 0) doc.addPage();
        renderPDFPage(doc, title);
    });

    const invNo = document.getElementById('invoiceNo').value || 'Draft';
    const fileName = copyType === 'ALL' ?
        `Invoice_${invNo}_All_Copies.pdf` :
        `Invoice_${invNo}_${copyType.split(' ')[0]}.pdf`;

    doc.save(fileName);
}

function renderPDFPage(doc, copyTitle) {
    const margin = 10;
    const width = 190;
    const startY = 15;

    // Helper functions
    const line = (x1, y1, x2, y2) => {
        doc.setDrawColor(30, 64, 175);
        doc.line(x1, y1, x2, y2);
    };
    const rect = (x, y, w, h) => {
        doc.setDrawColor(30, 64, 175);
        doc.setLineWidth(0.3);
        doc.rect(x, y, w, h);
    };

    // Header
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.setTextColor(30, 64, 175);
    doc.text("INVOICE", 105, startY, { align: 'center' });

    doc.setFontSize(8);
    doc.setTextColor(120);
    doc.text(`(${copyTitle})`, 195, startY, { align: 'right' });

    // Main Box
    rect(margin, startY + 5, width, 265);

    // Row 1: Seller and Invoice
    line(margin, startY + 55, margin + width, startY + 55);
    line(115, startY + 5, 115, startY + 55);

    doc.setTextColor(30, 64, 175);
    doc.setFontSize(9);
    doc.text("SELLER", margin + 2, startY + 10);

    doc.setTextColor(15, 23, 42);
    doc.setFontSize(12);
    doc.text(document.getElementById('sellerName').value, margin + 2, startY + 16);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(0);
    const sellerAddr = doc.splitTextToSize("Address : " + document.getElementById('sellerAddress').value, 100);
    doc.text(sellerAddr, margin + 2, startY + 22);

    let currentY = startY + 22 + (sellerAddr.length * 4);
    doc.text("GSTIN NO : " + document.getElementById('sellerGST').value, margin + 2, currentY);
    doc.text("State Code : " + document.getElementById('sellerStateCode').value, margin + 2, currentY + 4);
    doc.setFont('helvetica', 'bold');
    doc.text("Dispatch From : " + document.getElementById('dispatchFrom').value, margin + 2, currentY + 9);

    // Invoice Info Area
    doc.setFontSize(9);
    doc.setTextColor(30, 64, 175);
    doc.text("INVOICE DETAILS", 117, startY + 10);
    doc.setTextColor(0);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text("Invoice No : " + document.getElementById('invoiceNo').value, 117, startY + 16);
    doc.text("Date       : " + formatDate(new Date(document.getElementById('invoiceDate').value)), 117, startY + 21);

    line(115, startY + 26, margin + width, startY + 26);
    doc.setTextColor(30, 64, 175);
    doc.text("TRANSPORT DETAILS", 117, startY + 31);
    doc.setTextColor(0);
    doc.text("Transport  : " + document.getElementById('transportName').value, 117, startY + 36);
    doc.text("Lorry No   : " + document.getElementById('lorryNo').value, 117, startY + 41);
    doc.text("Bilty No   : " + document.getElementById('biltyNo').value, 117, startY + 46);

    // Row 2: Bill To and Ship To
    line(margin, startY + 95, margin + width, startY + 95);
    line(115, startY + 55, 115, startY + 95);

    doc.setTextColor(30, 64, 175);
    doc.setFont('helvetica', 'bold');
    doc.text("BILL TO (RECIPIENT)", margin + 2, startY + 60);
    doc.setTextColor(0);
    doc.setFont('helvetica', 'normal');
    doc.text("Name : " + document.getElementById('buyerName').value, margin + 2, startY + 66);
    const buyerAddr = doc.splitTextToSize("Addr : " + document.getElementById('buyerAddress').value, 95);
    doc.text(buyerAddr, margin + 2, startY + 71);
    doc.text("GSTIN: " + document.getElementById('buyerGST').value, margin + 2, startY + 86);
    doc.text("State: " + document.getElementById('buyerStateCode').value, margin + 2, startY + 91);

    const isSame = sameAsBillTo.checked;
    const sName = isSame ? document.getElementById('buyerName').value : document.getElementById('shipToName').value;
    const sAddr = isSame ? document.getElementById('buyerAddress').value : document.getElementById('shipToAddress').value;
    const sGST = isSame ? document.getElementById('buyerGST').value : document.getElementById('shipToGST').value;
    const sState = isSame ? document.getElementById('buyerStateCode').value : document.getElementById('shipToStateCode').value;

    doc.setTextColor(30, 64, 175);
    doc.setFont('helvetica', 'bold');
    doc.text("SHIP TO (CONSIGNEE)", 117, startY + 60);
    doc.setTextColor(0);
    doc.setFont('helvetica', 'normal');
    doc.text("Name : " + sName, 117, startY + 66);
    const shipToAddrArr = doc.splitTextToSize("Addr : " + sAddr, 80);
    doc.text(shipToAddrArr, 117, startY + 71);
    doc.text("GSTIN: " + sGST, 117, startY + 86);
    doc.text("State: " + sState, 117, startY + 91);

    // Row 3: Product Table
    const tableData = Array.from(productBody.children).map((row, index) => {
        const desc = row.querySelector('.product-desc').value;
        const hsn = row.querySelector('.product-hsn').value;
        const qty = parseFloat(row.querySelector('.product-qty').value) || 0;
        const rate = parseFloat(row.querySelector('.product-rate').value) || 0;
        return [
            index + 1,
            desc,
            hsn,
            formatNumber(qty) + "\nKGS",
            formatNumber(rate) + "\nPer KGS",
            formatNumber(qty * rate)
        ];
    });

    doc.autoTable({
        head: [["S.N", "Description of Goods", "HSN/SAC", "Quantity", "Rate", "Amount"]],
        body: tableData,
        startY: startY + 95,
        margin: { left: margin, right: margin },
        theme: 'grid',
        styles: { fontSize: 8, font: 'helvetica', cellPadding: 2, lineColor: [30, 64, 175], lineWidth: 0.1 },
        headStyles: { fillColor: [30, 64, 175], textColor: 255 },
        columnStyles: {
            0: { width: 10, halign: 'center' },
            2: { width: 25, halign: 'center' },
            3: { width: 25, halign: 'center' },
            4: { width: 30, halign: 'center' },
            5: { width: 30, halign: 'right' }
        }
    });

    // Summary Section - AFTER table
    let currentPos = doc.lastAutoTable.finalY;
    const summaryHeight = 8;
    const totalY = Math.max(currentPos, startY + 185);

    // Grid lines for bottom section
    line(margin, totalY, margin + width, totalY);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);

    const drawRow = (label, value, y) => {
        line(150, y, 200, y);
        doc.text(label, 153, y + 5);
        doc.text(value, 198, y + 5, { align: 'right' });
    };

    drawRow("SUB TOTAL", document.getElementById('preview-subtotal').textContent, totalY);
    drawRow(`CGST ${document.getElementById('cgst').value}%`, document.getElementById('preview-cgst-val').textContent, totalY + 7);
    drawRow(`SGST ${document.getElementById('sgst').value}%`, document.getElementById('preview-sgst-val').textContent, totalY + 14);
    drawRow(`IGST ${document.getElementById('igst').value}%`, document.getElementById('preview-igst-val').textContent, totalY + 21);

    // Grand Total Row
    const grandY = totalY + 28;
    doc.setFillColor(30, 64, 175);
    doc.rect(150, grandY, 50, 9, 'F');
    doc.setTextColor(255);
    doc.text("TOTAL AMOUNT", 153, grandY + 6);
    doc.text(document.getElementById('preview-gross-total').textContent, 198, grandY + 6, { align: 'right' });

    // Amount in Words
    doc.setTextColor(0);
    doc.setFontSize(8);
    line(margin, totalY + 38, margin + width, totalY + 38);
    doc.text("Amount Chargeable (in words):", margin + 2, totalY + 43);
    doc.setFont('helvetica', 'bold');
    doc.text(document.getElementById('preview-amount-words').textContent, margin + 45, totalY + 43);

    // Bank & Signature
    const bottomBoxY = totalY + 50;
    line(margin, bottomBoxY, margin + width, bottomBoxY);
    line(115, bottomBoxY, 115, startY + 270);

    doc.setFontSize(9);
    doc.setTextColor(30, 64, 175);
    doc.text("BANK DETAILS", margin + 2, bottomBoxY + 6);

    doc.setTextColor(0);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text("Bank Name : " + document.getElementById('bankName').value, margin + 2, bottomBoxY + 12);
    doc.text("A/c No    : " + document.getElementById('bankAccount').value, margin + 2, bottomBoxY + 17);
    doc.text("IFSC Code : " + document.getElementById('bankIFSC').value, margin + 2, bottomBoxY + 22);
    doc.text("Holder    : " + document.getElementById('bankHolder').value, margin + 2, bottomBoxY + 27);

    doc.setTextColor(30, 64, 175);
    doc.setFont('helvetica', 'bold');
    doc.text("FOR AVNEESH CORPORATION", 157, bottomBoxY + 6, { align: 'center' });
    doc.setTextColor(0);
    doc.setFontSize(7);
    doc.text("Authorized Signatory", 157, startY + 265, { align: 'center' });

    // Footer
    doc.setFontSize(7);
    doc.setTextColor(150);
    doc.text("NOTE : ALL SUBJECT TO INDORE JURISDICTION", 105, startY + 273, { align: 'center' });
}
