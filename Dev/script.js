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
const darkModeBtn = document.getElementById('darkModeBtn');
const darkModeIcon = document.getElementById('darkModeIcon');

const formattingToolbar = document.getElementById('formattingToolbar');
const toolbarBtns = document.querySelectorAll('.toolbar-btn:not(.dropdown-group > .toolbar-btn), .dropdown-cmd[data-cmd], .dropdown-icon-btn');
const spacingBtns = document.querySelectorAll('.spacing-btn');
const foreColorPicker = document.getElementById('foreColorPicker');
const backColorPicker = document.getElementById('backColorPicker');
const currentColorIndicator = document.getElementById('currentColorIndicator');
const triggerForeColor = document.getElementById('triggerForeColor');
const triggerBackColor = document.getElementById('triggerBackColor');

let activeEditor = null;

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

    // Check Dark Mode Preference
    initDarkMode();

    // Init Toolbar
    initToolbar();
});

function initToolbar() {
    // Basic commands
    toolbarBtns.forEach(btn => {
        btn.addEventListener('mousedown', (e) => {
            e.preventDefault();
            const cmd = btn.getAttribute('data-cmd');
            const val = btn.getAttribute('data-val') || null;
            document.execCommand(cmd, false, val);
            checkToolbarState();
            if (activeEditor) syncEditorToPreview(activeEditor);
        });
    });

    // Spacing commands (Custom Logic)
    spacingBtns.forEach(btn => {
        btn.addEventListener('mousedown', (e) => {
            e.preventDefault();
            const spacing = btn.getAttribute('data-spacing');
            applyLineSpacing(spacing);
        });
    });

    // Color Pickers
    if (triggerForeColor) triggerForeColor.addEventListener('click', () => foreColorPicker.click());
    if (triggerBackColor) triggerBackColor.addEventListener('click', () => backColorPicker.click());

    if (foreColorPicker) foreColorPicker.addEventListener('input', (e) => {
        document.execCommand('foreColor', false, e.target.value);
        if (currentColorIndicator) currentColorIndicator.style.backgroundColor = e.target.value;
        if (activeEditor) syncEditorToPreview(activeEditor);
    });

    if (backColorPicker) backColorPicker.addEventListener('input', (e) => {
        document.execCommand('hiliteColor', false, e.target.value);
        if (activeEditor) syncEditorToPreview(activeEditor);
    });

    // Mobile Support: Click to toggle dropdowns
    const dropdownGroups = document.querySelectorAll('.dropdown-group');
    dropdownGroups.forEach(group => {
        const toggleBtn = group.querySelector('.toolbar-btn');
        if (toggleBtn) {
            toggleBtn.addEventListener('mousedown', (e) => {
                e.preventDefault();
                // Close others
                dropdownGroups.forEach(g => { if (g !== group) g.classList.remove('mobile-open'); });
                group.classList.toggle('mobile-open');
                // Calculate right alignment if needed
                const dropdown = group.querySelector('.toolbar-dropdown');
                if (dropdown && dropdown.getBoundingClientRect().right > window.innerWidth) {
                    dropdown.classList.add('right-align');
                }
            });
        }
    });

    // Editors
    const editors = document.querySelectorAll('.rich-editable');
    editors.forEach(editor => {
        editor.addEventListener('focus', showToolbar);
        editor.addEventListener('blur', hideToolbar);
        editor.addEventListener('mouseup', updateToolbarPosition);
        editor.addEventListener('keyup', checkToolbarState);
        editor.addEventListener('input', (e) => syncEditorToPreview(e.target));
    });

    document.addEventListener('mousedown', (e) => {
        if (!formattingToolbar.contains(e.target) && !e.target.classList.contains('rich-editable')) {
            hideToolbar();
        }
    });
}

function showToolbar(e) {
    activeEditor = e.target;
    formattingToolbar.classList.add('visible');
    updateToolbarPosition(e);
    checkToolbarState();
}

function hideToolbar() {
    setTimeout(() => {
        if (!formattingToolbar.contains(document.activeElement) && document.activeElement !== activeEditor) {
            formattingToolbar.classList.remove('visible');
            activeEditor = null;
        }
    }, 150);
}

function updateToolbarPosition(e) {
    if (!activeEditor || !formattingToolbar.classList.contains('visible')) return;
    const rect = activeEditor.getBoundingClientRect();
    const toolbarRect = formattingToolbar.getBoundingClientRect();
    let top = rect.top + window.scrollY - toolbarRect.height - 8;
    if (top < 50) top = rect.bottom + window.scrollY + 8;
    formattingToolbar.style.top = `${top}px`;
    formattingToolbar.style.left = `${rect.left + window.scrollX}px`;
}

function checkToolbarState() {
    if (!activeEditor) return;
    toolbarBtns.forEach(btn => {
        const cmd = btn.getAttribute('data-cmd');
        const val = btn.getAttribute('data-val');
        if (!cmd) return;
        try {
            if (val && cmd === 'formatBlock') {
                const currentBlock = document.queryCommandValue(cmd);
                if (currentBlock && currentBlock.toLowerCase() === val.toLowerCase()) btn.classList.add('active');
                else btn.classList.remove('active');
            } else if (document.queryCommandState(cmd)) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        } catch(e) {}
    });

    // Evaluate spacing
    let spacingVal = '1';
    let node = getSelectionNode();
    if (node) {
        let parentBlock = findParentBlock(node);
        if (parentBlock && parentBlock.style.lineHeight) {
            spacingVal = parentBlock.style.lineHeight;
        }
    }
    spacingBtns.forEach(btn => {
        if (btn.getAttribute('data-spacing') === spacingVal) btn.classList.add('active');
        else btn.classList.remove('active');
    });
}

function getSelectionNode() {
    const selection = window.getSelection();
    if (selection.rangeCount > 0) return selection.getRangeAt(0).startContainer;
    return null;
}

function findParentBlock(node) {
    let curr = node;
    while (curr && curr !== activeEditor && curr.nodeType === 1) {
        const display = window.getComputedStyle(curr).display;
        if (display === 'block' || display === 'list-item') return curr;
        curr = curr.parentNode;
    }
    return activeEditor; // fallback
}

function applyLineSpacing(spacing) {
    if (!activeEditor) return;
    const node = getSelectionNode();
    if (!node) return;
    let block = findParentBlock(node);
    if (!block || block === activeEditor) {
        document.execCommand('formatBlock', false, 'p');
        const newNode = getSelectionNode();
        block = findParentBlock(newNode);
    }
    if (block) {
        block.style.lineHeight = spacing;
        syncEditorToPreview(activeEditor);
        checkToolbarState();
    }
}

function syncEditorToPreview(editor) {
    const syncKey = editor.getAttribute('data-sync');
    if (syncKey) {
        updatePreviewText(syncKey, editor.innerHTML, true);
        if (sameAsBillTo.checked && syncKey.startsWith('bill-to-')) {
            const shipKey = syncKey.replace('bill-to-', 'ship-to-');
            updatePreviewText(shipKey, editor.innerHTML, true);
        }
    }
}

function initDarkMode() {
    const isDark = localStorage.getItem('billix-theme') === 'dark';
    if (isDark) {
        document.body.classList.add('dark-mode');
        darkModeIcon.textContent = '☀️';
    }
}

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

    // Dark Mode Toggle
    darkModeBtn.addEventListener('click', () => {
        document.body.classList.toggle('dark-mode');
        const isDark = document.body.classList.contains('dark-mode');
        darkModeIcon.textContent = isDark ? '☀️' : '🌙';
        localStorage.setItem('billix-theme', isDark ? 'dark' : 'light');
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
            let isRich = e.target.classList.contains('rich-editable');
            let val = isRich ? e.target.innerHTML : e.target.value;
            if (e.target.type === 'date') val = formatDate(new Date(val));
            updatePreviewText(syncKey, val, isRich);

            // If Ship To is synced with Bill To
            if (sameAsBillTo.checked && syncKey.startsWith('bill-to-')) {
                const shipKey = syncKey.replace('bill-to-', 'ship-to-');
                updatePreviewText(shipKey, val, isRich);
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

    // State Selector Logic
    const stateSelectors = document.querySelectorAll('.state-selector');
    stateSelectors.forEach(select => {
        select.addEventListener('change', (e) => {
            const targetId = select.getAttribute('data-target');
            const targetInput = document.getElementById(targetId);
            if (targetInput) {
                targetInput.value = select.value;
                // Manually trigger input event to sync with preview
                targetInput.dispatchEvent(new Event('input', { bubbles: true }));
            }
        });
    });
}

function updatePreviewText(key, value, isRich = false) {
    const el = document.getElementById(`preview-${key}`) || document.getElementById(`p-${key}`);
    if (el) {
        if (isRich) {
            el.innerHTML = value || '';
        } else {
            el.textContent = value || '';
        }
    }
}

function syncAllToPreview() {
    const inputs = invoiceForm.querySelectorAll('[data-sync]');
    inputs.forEach(input => {
        let isRich = input.classList.contains('rich-editable');
        let val = isRich ? input.innerHTML : input.value;
        if (input.type === 'date') val = formatDate(new Date(val));
        updatePreviewText(input.getAttribute('data-sync'), val, isRich);
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
        <td>
            <input type="number" class="product-qty calc-trigger right-text" value="0" step="0.001">
            <select class="product-unit calc-trigger" style="font-size: 0.65rem; padding: 2px; margin-top: 2px; width: 100%;">
                <option value="KGS" selected>Kg</option>
                <option value="NOS">Nos</option>
                <option value="PCS">Pcs</option>
                <option value="GRAM">Gram</option>
                <option value="TON">Ton</option>
                <option value="LITRE">Litre</option>
                <option value="ML">Ml</option>
                <option value="METER">Meter</option>
                <option value="FEET">Feet</option>
                <option value="BOX">Box</option>
                <option value="PACK">Pack</option>
                <option value="DOZEN">Dozen</option>
                <option value="HOURS">Hours</option>
                <option value="DAYS">Days</option>
                <option value="UNITS">Units</option>
                <option value="OTHER">Other</option>
            </select>
        </td>
        <td>
            <input type="number" class="product-rate calc-trigger right-text" value="0" step="0.01">
            <select class="product-rate-unit calc-trigger" style="font-size: 0.65rem; padding: 2px; margin-top: 2px; width: 100%;">
                <option value="Per KGS" selected>Per Kg</option>
                <option value="Per NOS">Per Nos</option>
                <option value="Per PCS">Per Pcs</option>
                <option value="Per GRAM">Per Gram</option>
                <option value="Per TON">Per Ton</option>
                <option value="Per LITRE">Per Litre</option>
                <option value="Per ML">Per Ml</option>
                <option value="Per METER">Per Meter</option>
                <option value="Per FEET">Per Feet</option>
                <option value="Per BOX">Per Box</option>
                <option value="Per PACK">Per Pack</option>
                <option value="Per DOZEN">Per Dozen</option>
                <option value="Per HOURS">Per Hour</option>
                <option value="Per DAYS">Per Day</option>
                <option value="Per UNITS">Per Unit</option>
                <option value="OTHER">Other</option>
            </select>
        </td>
        <td><button type="button" class="btn btn-danger btn-sm remove-row" style="padding: 0.2rem 0.5rem; font-size: 0.9rem;">×</button></td>
    `;

    const qtyUnit = tr.querySelector('.product-unit');
    const rateUnit = tr.querySelector('.product-rate-unit');

    qtyUnit.addEventListener('change', () => {
        rateUnit.value = "Per " + qtyUnit.value;
        updatePreviewTable();
    });

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
        const qtyUnit = row.querySelector('.product-unit').value;
        const rateUnit = row.querySelector('.product-rate-unit').value;
        const amount = qty * rate;
        subTotal += amount;

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td class="center">${index + 1}.</td>
            <td>${desc || '---'}</td>
            <td class="center">${hsn || '---'}</td>
            <td class="center">${formatNumber(qty)}<br>${qtyUnit}</td>
            <td class="center">${formatNumber(rate)} /-<br>${rateUnit}</td>
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

    const words = numberToWords(Math.round(grossTotal * 100) / 100);
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

    const integerPart = Math.floor(num);
    const decimalPart = Math.round((num - integerPart) * 100);

    let str = '';
    str += convert_with_suffix(Math.floor(integerPart / 10000000), 'CRORE ');
    str += convert_with_suffix(Math.floor((integerPart / 100000) % 100), 'LAKH ');
    str += convert_with_suffix(Math.floor((integerPart / 1000) % 100), 'THOUSAND ');
    str += convert_with_suffix(integerPart % 1000, '');

    let result = str.trim();

    if (decimalPart > 0) {
        const paiseStr = convert_with_suffix(decimalPart, '').trim();
        if (result !== '') {
            result += ' AND ' + paiseStr + ' PAISE';
        } else {
            result = paiseStr + ' PAISE';
        }
    }

    return result;
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
        doc.setDrawColor(0, 0, 0);
        doc.line(x1, y1, x2, y2);
    };
    const rect = (x, y, w, h) => {
        doc.setDrawColor(0, 0, 0);
        doc.setLineWidth(0.3);
        doc.rect(x, y, w, h);
    };

    // Header
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.setTextColor(0, 0, 0);
    doc.text("INVOICE", 105, startY, { align: 'center' });

    doc.setFontSize(8);
    doc.setTextColor(120);
    doc.text(`(${copyTitle})`, 195, startY, { align: 'right' });

    // Main Box
    rect(margin, startY + 5, width, 265);

    // Row 1: Seller and Invoice
    line(margin, startY + 55, margin + width, startY + 55);
    line(115, startY + 5, 115, startY + 55);

    doc.setTextColor(0, 0, 0);
    doc.setFontSize(9);
    doc.text("SELLER", margin + 2, startY + 10);

    doc.setTextColor(15, 23, 42);
    doc.setFontSize(12);
    doc.text(document.getElementById('sellerName').value, margin + 2, startY + 16);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(0);
    const getFieldVal = (id) => {
        const el = document.getElementById(id);
        return el ? (el.classList.contains('rich-editable') ? el.innerText : el.value) : '';
    };
    
    const sellerAddr = doc.splitTextToSize("Address : " + getFieldVal('sellerAddress'), 100);
    doc.text(sellerAddr, margin + 2, startY + 22);

    let currentY = startY + 22 + (sellerAddr.length * 4);
    doc.text("GSTIN NO : " + document.getElementById('sellerGST').value, margin + 2, currentY);
    doc.text("State Code : " + document.getElementById('sellerStateCode').value, margin + 2, currentY + 4);
    doc.setFont('helvetica', 'bold');
    doc.text("Dispatch From : " + document.getElementById('dispatchFrom').value, margin + 2, currentY + 9);

    // Invoice Info Area
    doc.setFontSize(9);
    doc.setTextColor(0, 0, 0);
    doc.text("INVOICE DETAILS", 117, startY + 10);
    doc.setTextColor(0);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text("Invoice No : " + document.getElementById('invoiceNo').value, 117, startY + 16);
    doc.text("Date       : " + formatDate(new Date(document.getElementById('invoiceDate').value)), 117, startY + 21);

    line(115, startY + 26, margin + width, startY + 26);
    doc.setTextColor(0, 0, 0);
    doc.text("TRANSPORT DETAILS", 117, startY + 31);
    doc.setTextColor(0);
    doc.text("Transport  : " + document.getElementById('transportName').value, 117, startY + 36);
    doc.text("Lorry No   : " + document.getElementById('lorryNo').value, 117, startY + 41);
    doc.text("Bilty No   : " + document.getElementById('biltyNo').value, 117, startY + 46);

    // Row 2: Bill To and Ship To
    line(margin, startY + 95, margin + width, startY + 95);
    line(115, startY + 55, 115, startY + 95);

    doc.setTextColor(0, 0, 0);
    doc.setFont('helvetica', 'bold');
    doc.text("BILL TO (RECIPIENT)", margin + 2, startY + 60);
    doc.setTextColor(0);
    doc.setFont('helvetica', 'normal');
    doc.text("Name : " + document.getElementById('buyerName').value, margin + 2, startY + 66);
    const buyerAddr = doc.splitTextToSize("Addr : " + getFieldVal('buyerAddress'), 95);
    doc.text(buyerAddr, margin + 2, startY + 71);
    doc.text("GSTIN: " + document.getElementById('buyerGST').value, margin + 2, startY + 86);
    doc.text("State: " + document.getElementById('buyerStateCode').value, margin + 2, startY + 91);

    const isSame = sameAsBillTo.checked;
    const sName = isSame ? document.getElementById('buyerName').value : document.getElementById('shipToName').value;
    const sAddr = isSame ? getFieldVal('buyerAddress') : getFieldVal('shipToAddress');
    const sGST = isSame ? document.getElementById('buyerGST').value : document.getElementById('shipToGST').value;
    const sState = isSame ? document.getElementById('buyerStateCode').value : document.getElementById('shipToStateCode').value;

    doc.setTextColor(0, 0, 0);
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
        const qtyUnit = row.querySelector('.product-unit').value;
        const rateUnit = row.querySelector('.product-rate-unit').value;
        return [
            index + 1,
            desc,
            hsn,
            formatNumber(qty) + "\n" + qtyUnit,
            formatNumber(rate) + "\n" + rateUnit,
            formatNumber(qty * rate)
        ];
    });

    doc.autoTable({
        head: [["S.N", "Description of Goods", "HSN/SAC", "Quantity", "Rate", "Amount"]],
        body: tableData,
        startY: startY + 95,
        margin: { left: margin, right: margin },
        theme: 'grid',
        styles: { fontSize: 8, font: 'helvetica', cellPadding: 2, lineColor: [0, 0, 0], lineWidth: 0.1 },
        headStyles: { fillColor: [0, 0, 0], textColor: 255 },
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
    doc.setFillColor(0, 0, 0);
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
    doc.setTextColor(0, 0, 0);
    doc.text("BANK DETAILS", margin + 2, bottomBoxY + 6);

    doc.setTextColor(0);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text("A/C Holder’s Name : " + document.getElementById('bankHolder').value, margin + 2, bottomBoxY + 12);
    doc.text("Bank Name : " + document.getElementById('bankName').value, margin + 2, bottomBoxY + 17);
    doc.text("A/C No.    : " + document.getElementById('bankAccount').value, margin + 2, bottomBoxY + 22);
    doc.text("IFSC Code : " + document.getElementById('bankIFSC').value, margin + 2, bottomBoxY + 27);

    doc.setTextColor(0, 0, 0);
    doc.setFont('helvetica', 'bold');
    doc.text("FOR BILLIX", 157, bottomBoxY + 6, { align: 'center' });
    doc.setTextColor(0);
    doc.setFontSize(7);
    doc.text("Authorized Signatory", 157, startY + 265, { align: 'center' });

    // Footer
    doc.setFontSize(7);
    doc.setTextColor(150);
    doc.text("NOTE : ALL SUBJECT TO INDORE JURISDICTION", 105, startY + 273, { align: 'center' });
}
