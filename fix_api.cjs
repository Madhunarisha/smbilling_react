const fs = require('fs');
let content = fs.readFileSync('src/server/api.ts', 'utf8');

const newCode = `// Create Invoice Transactionally
apiRouter.post('/invoices', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { db: sqliteDb } = require('./db.js');
    const {
      customerName,
      customerPhone,
      customerId,
      customerGstin,
      billingAddress,
      shippingAddress,
      isInterState,
      items,
      overallDiscountType,
      overallDiscountValue,
      overallDiscountAmount,
      paidAmount,
      paymentMode,
      notes,
    } = req.body;

    if (!customerName || !items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Customer name and at least one invoice item are required.' });
    }

    // 1. Check stock availability for each item
    for (const item of items) {
      if (!item.productId || item.quantity <= 0) {
        return res.status(400).json({ error: \`Invalid product or quantity for item "\${item.productName}".\` });
      }
      const product = sqliteDb.prepare('SELECT currentStock, name FROM products WHERE id = ?').get(item.productId);
      if (!product) {
        return res.status(400).json({ error: \`Product "\${item.productName}" not found in inventory.\` });
      }
      if (product.currentStock < item.quantity) {
        return res.status(400).json({
          error: \`Insufficient stock for "\${product.name}". Available: \${product.currentStock}, Requested: \${item.quantity}.\`,
        });
      }
    }

    // 2. Compute dynamic financial values rigorously
    let calculatedSubtotal = 0;
    let calculatedTaxable = 0;
    let calculatedCgst = 0;
    let calculatedSgst = 0;
    let calculatedIgst = 0;
    
    const gstType = req.body.gstType || 'exclusive';

    const processedItems = items.map((rawItem: any, idx: number) => {
      const qty = Number(rawItem.quantity);
      const rate = Number(rawItem.rate);
      const gross = qty * rate;
      const itemDiscPct = Number(rawItem.discountPercent) || 0;
      const itemDiscAmount = (gross * itemDiscPct) / 100;
      const gstRate = Number(rawItem.gstRate) || 0;
      
      let taxable = 0;
      if (gstType === 'inclusive') {
        const finalInclusive = gross - itemDiscAmount;
        taxable = finalInclusive / (1 + (gstRate / 100));
      } else {
        taxable = gross - itemDiscAmount;
      }

      let cgst = 0;
      let sgst = 0;
      let igst = 0;

      if (isInterState) {
        igst = (taxable * gstRate) / 100;
      } else {
        cgst = (taxable * (gstRate / 2)) / 100;
        sgst = (taxable * (gstRate / 2)) / 100;
      }

      const rowTotal = taxable + cgst + sgst + igst;

      calculatedSubtotal += gross;
      calculatedTaxable += taxable;
      calculatedCgst += cgst;
      calculatedSgst += sgst;
      calculatedIgst += igst;

      return {
        id: \`item-\${Date.now()}-\${idx}\`,
        productId: rawItem.productId,
        productName: rawItem.productName,
        sku: rawItem.sku || '',
        barcode: rawItem.barcode || null,
        quantity: qty,
        unit: rawItem.unit || 'Nos',
        rate: rate,
        mrp: Number(rawItem.mrp) || rate,
        discountPercent: itemDiscPct,
        discountAmount: Math.round(itemDiscAmount * 100) / 100,
        taxableAmount: Math.round(taxable * 100) / 100,
        gstRate: gstRate,
        cgstAmount: Math.round(cgst * 100) / 100,
        sgstAmount: Math.round(sgst * 100) / 100,
        igstAmount: Math.round(igst * 100) / 100,
        totalAmount: Math.round(rowTotal * 100) / 100,
      };
    });

    const finalOverallDiscount = Number(overallDiscountAmount) || 0;
    const rawGrandTotal = calculatedTaxable - finalOverallDiscount + calculatedCgst + calculatedSgst + calculatedIgst;
    const roundedGrandTotal = Math.round(rawGrandTotal);
    const roundOff = Math.round((roundedGrandTotal - rawGrandTotal) * 100) / 100;

    const finalPaid = Math.min(Number(paidAmount) || 0, roundedGrandTotal);
    const balance = Math.max(0, roundedGrandTotal - finalPaid);

    let paymentStatus: 'Paid' | 'Partially Paid' | 'Unpaid' = 'Unpaid';
    if (balance === 0 && roundedGrandTotal > 0) {
      paymentStatus = 'Paid';
    } else if (finalPaid > 0) {
      paymentStatus = 'Partially Paid';
    }

    const createInvoiceTx = sqliteDb.transaction(() => {
      // 3. Invoice number handling
      const nextNumRow = sqliteDb.prepare("SELECT value FROM settings WHERE key = 'nextInvoiceNumber'").get();
      let nextNum = nextNumRow ? Number(nextNumRow.value) : 1;
      let invoiceNumber = req.body.invoiceNumber ? String(req.body.invoiceNumber).trim() : '';

      if (!invoiceNumber) {
        invoiceNumber = String(nextNum);
        sqliteDb.prepare("UPDATE settings SET value = ? WHERE key = 'nextInvoiceNumber'").run(String(nextNum + 1));
      } else if (invoiceNumber === String(nextNum)) {
        sqliteDb.prepare("UPDATE settings SET value = ? WHERE key = 'nextInvoiceNumber'").run(String(nextNum + 1));
      }

      // CUSTOMER AUTO-SAVE
      let finalCustomerId = customerId;
      const phoneToMatch = customerPhone ? customerPhone.trim() : '';
      if (phoneToMatch) {
        const existingCustomer = sqliteDb.prepare('SELECT id FROM customers WHERE phone = ?').get(phoneToMatch);
        if (existingCustomer) {
          sqliteDb.prepare(\`UPDATE customers SET name = ?, address = ?, gstin = ?, updatedAt = ? WHERE id = ?\`).run(
            customerName.trim(),
            billingAddress ? billingAddress.trim() : '',
            customerGstin ? customerGstin.trim().toUpperCase() : '',
            new Date().toISOString(),
            existingCustomer.id
          );
          finalCustomerId = existingCustomer.id;
        } else {
          finalCustomerId = \`cust-\${Date.now()}\`;
          sqliteDb.prepare(\`INSERT INTO customers (id, name, phone, email, address, gstin, type, totalSales, currentOutstanding, status, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)\`).run(
            finalCustomerId, customerName.trim(), phoneToMatch, '', billingAddress ? billingAddress.trim() : '',
            customerGstin ? customerGstin.trim().toUpperCase() : '', 'retail', 0, 0, 'active', new Date().toISOString(), new Date().toISOString()
          );
        }
      }

      // INSERT INVOICE HEADER
      const newInvoiceId = \`inv-\${Date.now()}\`;
      sqliteDb.prepare(\`INSERT INTO invoices (id, invoiceNumber, date, customerId, customerName, customerPhone, customerGstin, billingAddress, shippingAddress, isInterState, gstType, subtotal, overallDiscountType, overallDiscountValue, overallDiscountAmount, taxableAmount, cgstTotal, sgstTotal, igstTotal, roundOff, grandTotal, paidAmount, balanceAmount, paymentMode, paymentStatus, notes, createdBy, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)\`).run(
        newInvoiceId, invoiceNumber, new Date().toISOString(), finalCustomerId || null, customerName.trim(), customerPhone ? customerPhone.trim() : '',
        customerGstin ? customerGstin.trim().toUpperCase() : null, billingAddress ? billingAddress.trim() : null, shippingAddress ? shippingAddress.trim() : null,
        isInterState ? 1 : 0, gstType, Math.round(calculatedSubtotal * 100) / 100, overallDiscountType || 'fixed', Number(overallDiscountValue) || 0,
        finalOverallDiscount, Math.round((calculatedTaxable - finalOverallDiscount) * 100) / 100, Math.round(calculatedCgst * 100) / 100,
        Math.round(calculatedSgst * 100) / 100, Math.round(calculatedIgst * 100) / 100, roundOff, roundedGrandTotal, finalPaid, balance,
        paymentMode || 'Cash', paymentStatus, notes?.trim() || '', req.user?.name || 'Staff', new Date().toISOString()
      );

      // INSERT ITEMS, STOCK, TX
      for (const item of processedItems) {
        sqliteDb.prepare(\`INSERT INTO invoice_items (id, invoiceId, productId, productName, sku, brand, barcode, quantity, unit, rate, purchaseRate, mrp, discountPercent, discountAmount, taxableAmount, gstRate, cgstAmount, sgstAmount, igstAmount, totalAmount) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)\`).run(
          item.id, newInvoiceId, item.productId, item.productName, item.sku || '', null, item.barcode || null, item.quantity, item.unit || 'Nos', item.rate, null, item.mrp || 0, item.discountPercent || 0, item.discountAmount || 0, item.taxableAmount || 0, item.gstRate || 0, item.cgstAmount || 0, item.sgstAmount || 0, item.igstAmount || 0, item.totalAmount || 0
        );

        const product = sqliteDb.prepare('SELECT currentStock FROM products WHERE id = ?').get(item.productId);
        if (product) {
          const prevStock = product.currentStock;
          sqliteDb.prepare('UPDATE products SET currentStock = currentStock - ?, updatedAt = ? WHERE id = ?').run(item.quantity, new Date().toISOString(), item.productId);
          
          sqliteDb.prepare(\`INSERT INTO stock_transactions (id, productId, productName, type, quantity, previousStock, updatedStock, referenceNo, userId, userName, remarks, date) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)\`).run(
            \`stk-\${Date.now()}-\${item.productId}\`, item.productId, item.productName, 'sale', -item.quantity, prevStock, prevStock - item.quantity,
            invoiceNumber, req.user?.id || 'usr-staff', req.user?.name || 'Staff', \`Sold in Invoice \${invoiceNumber}\`, new Date().toISOString()
          );
        }
      }

      // LEDGER
      if (finalCustomerId) {
        const customer = sqliteDb.prepare('SELECT currentOutstanding FROM customers WHERE id = ?').get(finalCustomerId);
        if (customer) {
          let currentOut = customer.currentOutstanding + roundedGrandTotal;
          sqliteDb.prepare('UPDATE customers SET currentOutstanding = ? WHERE id = ?').run(currentOut, finalCustomerId);
          
          sqliteDb.prepare(\`INSERT INTO customer_ledgers (id, customerId, customerName, date, description, type, referenceNo, debit, credit, balance, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)\`).run(
            \`cld-\${Date.now()}-inv\`, finalCustomerId, customerName.trim(), new Date().toISOString(), \`Invoice \${invoiceNumber} Generated\`, 'invoice', invoiceNumber,
            roundedGrandTotal, 0, currentOut, \`Total items: \${processedItems.length}\`
          );

          if (finalPaid > 0) {
            currentOut -= finalPaid;
            sqliteDb.prepare('UPDATE customers SET currentOutstanding = ? WHERE id = ?').run(currentOut, finalCustomerId);
            sqliteDb.prepare(\`INSERT INTO customer_ledgers (id, customerId, customerName, date, description, type, referenceNo, debit, credit, balance, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)\`).run(
              \`cld-\${Date.now()}-pay\`, finalCustomerId, customerName.trim(), new Date().toISOString(), \`\${paymentMode} Payment Received against \${invoiceNumber}\`, 'payment', invoiceNumber,
              0, finalPaid, currentOut, \`Mode: \${paymentMode}\`
            );
          }
        }
      }

      // PAYMENT
      if (finalPaid > 0) {
        sqliteDb.prepare(\`INSERT INTO payments (id, invoiceId, invoiceNumber, customerId, customerName, amount, paymentMode, date, notes, createdBy) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)\`).run(
          \`pay-\${Date.now()}\`, newInvoiceId, invoiceNumber, finalCustomerId || null, customerName.trim(), finalPaid, paymentMode || 'Cash', new Date().toISOString(), \`Payment for invoice \${invoiceNumber}\`, req.user?.name || 'Staff'
        );
      }
      
      return { newInvoiceId, invoiceNumber };
    });

    const { newInvoiceId, invoiceNumber } = createInvoiceTx();

    logAudit(
      req.user?.id || 'staff',
      req.user?.name || 'Staff',
      'INVOICE_CREATED',
      'Invoices',
      \`Created Invoice \${invoiceNumber} for \${customerName}\`
    );

    const createdInvoice = sqliteDb.prepare('SELECT * FROM invoices WHERE id = ?').get(newInvoiceId);
    createdInvoice.items = sqliteDb.prepare('SELECT * FROM invoice_items WHERE invoiceId = ?').all(newInvoiceId);

    res.status(201).json(createdInvoice);
  } catch (err: any) {
    console.error('Invoice creation error:', err);
    res.status(500).json({ error: err.message || 'Failed to create invoice' });
  }
});
`;

// Also re-add /banks
const banksCode = `
// -------------------------------------------------------------
// 3.5 BANKS
// -------------------------------------------------------------

apiRouter.get('/banks', authenticateToken, (req: Request, res: Response) => {
  const { db: sqliteDb } = require('./db.js');
  const banks = sqliteDb.prepare('SELECT * FROM banks').all();
  res.json(banks);
});

apiRouter.post('/banks', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  const { db: sqliteDb } = require('./db.js');
  const { bankName, accountNumber, ifsc, branch } = req.body;
  if (!bankName || !accountNumber) return res.status(400).json({ error: 'Bank Name and Account Number are required' });

  const id = \`bank-\${Date.now()}\`;
  const createdAt = new Date().toISOString();

  sqliteDb.prepare(\`INSERT INTO banks (id, bankName, accountNumber, ifsc, branch, createdAt) VALUES (?, ?, ?, ?, ?, ?)\`).run(
    id, bankName.trim(), accountNumber.trim(), ifsc ? ifsc.trim().toUpperCase() : '', branch ? branch.trim() : '', createdAt
  );

  const newBank = sqliteDb.prepare('SELECT * FROM banks WHERE id = ?').get(id);
  res.status(201).json(newBank);
});
`;

// Replace POST /invoices
const startIndex = content.indexOf('// Create Invoice Transactionally');
const endIndexStr = '// Record additional payment on an existing invoice';
const endIndex = content.indexOf(endIndexStr);

if (startIndex === -1 || endIndex === -1) {
  console.error('Could not find start or end index for POST /invoices');
  process.exit(1);
}

const contentBefore = content.substring(0, startIndex);
const contentAfter = content.substring(endIndex);

let finalContent = contentBefore + newCode + '\n' + contentAfter;

// Insert /banks before // 4. CATEGORIES
const categoriesIndex = finalContent.indexOf('// 4. CATEGORIES');
if (categoriesIndex !== -1) {
  finalContent = finalContent.substring(0, categoriesIndex) + banksCode + '\n' + finalContent.substring(categoriesIndex);
}

fs.writeFileSync('src/server/api.ts', finalContent);
console.log('Successfully updated api.ts');
