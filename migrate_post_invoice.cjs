const fs = require('fs');
const apiPath = '/Users/hazzinotechnologies/smbilling_react/src/server/api.ts';

let code = fs.readFileSync(apiPath, 'utf8');

// We want to replace the block starting at `// 3. Invoice number handling` up to `res.status(201).json(newInvoice);` with our new SQLite code.

const startMarker = "// 3. Invoice number handling: Use dynamic / custom if provided, otherwise auto-generate sequentially";
const endMarker = "res.status(201).json(newInvoice);";

const startIndex = code.indexOf(startMarker);
const endIndex = code.indexOf(endMarker) + endMarker.length;

if (startIndex === -1 || endIndex < startIndex) {
  console.error("Markers not found");
  process.exit(1);
}

const replacement = `
  const createInvoiceTx = db.transaction(() => {
    // 3. Invoice number handling
    const nextNumRow = db.prepare("SELECT value FROM settings WHERE key = 'nextInvoiceNumber'").get();
    let nextNum = nextNumRow ? Number(nextNumRow.value) : 1;
    let invoiceNumber = req.body.invoiceNumber ? String(req.body.invoiceNumber).trim() : '';

    if (!invoiceNumber) {
      invoiceNumber = String(nextNum);
      db.prepare("UPDATE settings SET value = ? WHERE key = 'nextInvoiceNumber'").run(String(nextNum + 1));
    } else if (invoiceNumber === String(nextNum)) {
      db.prepare("UPDATE settings SET value = ? WHERE key = 'nextInvoiceNumber'").run(String(nextNum + 1));
    }

    // CUSTOMER AUTO-SAVE
    let finalCustomerId = customerId;
    const phoneToMatch = customerPhone ? customerPhone.trim() : '';
    if (phoneToMatch) {
      const existingCustomer = db.prepare('SELECT id FROM customers WHERE phone = ?').get(phoneToMatch);
      if (existingCustomer) {
        db.prepare(\`UPDATE customers SET name = ?, address = ?, gstin = ?, updatedAt = ? WHERE id = ?\`).run(
          customerName.trim(),
          billingAddress ? billingAddress.trim() : '',
          customerGstin ? customerGstin.trim().toUpperCase() : '',
          new Date().toISOString(),
          existingCustomer.id
        );
        finalCustomerId = existingCustomer.id;
      } else {
        finalCustomerId = \`cust-\${Date.now()}\`;
        db.prepare(\`INSERT INTO customers (id, name, phone, email, address, gstin, type, totalSales, currentOutstanding, status, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)\`).run(
          finalCustomerId, customerName.trim(), phoneToMatch, '', billingAddress ? billingAddress.trim() : '',
          customerGstin ? customerGstin.trim().toUpperCase() : '', 'retail', 0, 0, 'active', new Date().toISOString(), new Date().toISOString()
        );
      }
    }

    // INSERT INVOICE HEADER
    const newInvoiceId = \`inv-\${Date.now()}\`;
    db.prepare(\`INSERT INTO invoices (id, invoiceNumber, date, customerId, customerName, customerPhone, customerGstin, billingAddress, shippingAddress, isInterState, gstType, subtotal, overallDiscountType, overallDiscountValue, overallDiscountAmount, taxableAmount, cgstTotal, sgstTotal, igstTotal, roundOff, grandTotal, paidAmount, balanceAmount, paymentMode, paymentStatus, notes, createdBy, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)\`).run(
      newInvoiceId, invoiceNumber, new Date().toISOString(), finalCustomerId || null, customerName.trim(), customerPhone ? customerPhone.trim() : '',
      customerGstin ? customerGstin.trim().toUpperCase() : null, billingAddress ? billingAddress.trim() : null, shippingAddress ? shippingAddress.trim() : null,
      isInterState ? 1 : 0, gstType, Math.round(calculatedSubtotal * 100) / 100, overallDiscountType || 'fixed', Number(overallDiscountValue) || 0,
      finalOverallDiscount, Math.round((calculatedTaxable - finalOverallDiscount) * 100) / 100, Math.round(calculatedCgst * 100) / 100,
      Math.round(calculatedSgst * 100) / 100, Math.round(calculatedIgst * 100) / 100, roundOff, roundedGrandTotal, finalPaid, balance,
      paymentMode || 'Cash', paymentStatus, notes?.trim() || '', req.user?.name || 'Staff', new Date().toISOString()
    );

    // INSERT ITEMS, STOCK, TX
    for (const item of processedItems) {
      db.prepare(\`INSERT INTO invoice_items (id, invoiceId, productId, productName, sku, brand, barcode, quantity, unit, rate, purchaseRate, mrp, discountPercent, discountAmount, taxableAmount, gstRate, cgstAmount, sgstAmount, igstAmount, totalAmount) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)\`).run(
        item.id, newInvoiceId, item.productId, item.productName, item.sku, null, item.barcode, item.quantity, item.unit, item.rate, null, item.mrp, item.discountPercent, item.discountAmount, item.taxableAmount, item.gstRate, item.cgstAmount, item.sgstAmount, item.igstAmount, item.totalAmount
      );

      const product = db.prepare('SELECT currentStock FROM products WHERE id = ?').get(item.productId);
      if (product) {
        const prevStock = product.currentStock;
        db.prepare('UPDATE products SET currentStock = currentStock - ?, updatedAt = ? WHERE id = ?').run(item.quantity, new Date().toISOString(), item.productId);
        
        db.prepare(\`INSERT INTO stock_transactions (id, productId, productName, type, quantity, previousStock, updatedStock, referenceNo, userId, userName, remarks, date) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)\`).run(
          \`stk-\${Date.now()}-\${item.productId}\`, item.productId, item.productName, 'sale', -item.quantity, prevStock, prevStock - item.quantity,
          invoiceNumber, req.user?.id || 'usr-staff', req.user?.name || 'Staff', \`Sold in Invoice \${invoiceNumber}\`, new Date().toISOString()
        );
      }
    }

    // LEDGER
    if (finalCustomerId) {
      const customer = db.prepare('SELECT currentOutstanding FROM customers WHERE id = ?').get(finalCustomerId);
      if (customer) {
        let currentOut = customer.currentOutstanding + roundedGrandTotal;
        db.prepare('UPDATE customers SET currentOutstanding = ? WHERE id = ?').run(currentOut, finalCustomerId);
        
        db.prepare(\`INSERT INTO customer_ledgers (id, customerId, customerName, date, description, type, referenceNo, debit, credit, balance, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)\`).run(
          \`cld-\${Date.now()}-inv\`, finalCustomerId, customerName.trim(), new Date().toISOString(), \`Invoice \${invoiceNumber} Generated\`, 'invoice', invoiceNumber,
          roundedGrandTotal, 0, currentOut, \`Total items: \${processedItems.length}\`
        );

        if (finalPaid > 0) {
          currentOut -= finalPaid;
          db.prepare('UPDATE customers SET currentOutstanding = ? WHERE id = ?').run(currentOut, finalCustomerId);
          db.prepare(\`INSERT INTO customer_ledgers (id, customerId, customerName, date, description, type, referenceNo, debit, credit, balance, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)\`).run(
            \`cld-\${Date.now()}-pay\`, finalCustomerId, customerName.trim(), new Date().toISOString(), \`\${paymentMode} Payment Received against \${invoiceNumber}\`, 'payment', invoiceNumber,
            0, finalPaid, currentOut, \`Mode: \${paymentMode}\`
          );
        }
      }
    }

    // PAYMENT
    if (finalPaid > 0) {
      db.prepare(\`INSERT INTO payments (id, invoiceId, invoiceNumber, customerId, customerName, amount, paymentMode, date, notes, createdBy) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)\`).run(
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
    'Billing',
    \`Created invoice \${invoiceNumber} for \${customerName} (₹\${roundedGrandTotal})\`,
    newInvoiceId
  );

  // Read back the invoice to return
  const createdInvoice = db.prepare('SELECT * FROM invoices WHERE id = ?').get(newInvoiceId);
  createdInvoice.items = db.prepare('SELECT * FROM invoice_items WHERE invoiceId = ?').all(newInvoiceId);

  res.status(201).json(createdInvoice);`;

code = code.substring(0, startIndex) + replacement + code.substring(endIndex);

fs.writeFileSync(apiPath, code, 'utf8');
console.log("Successfully migrated POST /invoices!");
