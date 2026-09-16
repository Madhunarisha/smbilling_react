// Currency formatter for Indian Rupee (₹)
export function formatINR(amount: number | undefined | null): string {
  if (amount === undefined || amount === null || isNaN(amount)) return '₹0.00';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
    minimumFractionDigits: 0,
  }).format(amount);
}

// Format date into human readable format
export function formatDate(dateString: string | undefined | null): string {
  if (!dateString) return '—';
  try {
    const d = new Date(dateString);
    return d.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return dateString;
  }
}

// Format date and time
export function formatDateTime(dateString: string | undefined | null): string {
  if (!dateString) return '—';
  try {
    const d = new Date(dateString);
    return d.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return dateString;
  }
}

// Convert number to words in Indian numbering system
export function numberToWordsIndian(num: number): string {
  if (num === 0) return 'Zero Rupees Only';
  const a = [
    '',
    'One',
    'Two',
    'Three',
    'Four',
    'Five',
    'Six',
    'Seven',
    'Eight',
    'Nine',
    'Ten',
    'Eleven',
    'Twelve',
    'Thirteen',
    'Fourteen',
    'Fifteen',
    'Sixteen',
    'Seventeen',
    'Eighteen',
    'Nineteen',
  ];
  const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  function inWords(n: number): string {
    let str = '';
    if (n > 99) {
      str += a[Math.floor(n / 100)] + ' Hundred ';
      n %= 100;
    }
    if (n > 19) {
      str += b[Math.floor(n / 10)] + ' ' + a[n % 10];
    } else if (n > 0) {
      str += a[n];
    }
    return str.trim();
  }

  const integerPart = Math.floor(Math.abs(num));
  let result = '';

  const crore = Math.floor(integerPart / 10000000);
  const lakh = Math.floor((integerPart % 10000000) / 100000);
  const thousand = Math.floor((integerPart % 100000) / 1000);
  const remainder = integerPart % 1000;

  if (crore > 0) result += inWords(crore) + ' Crore ';
  if (lakh > 0) result += inWords(lakh) + ' Lakh ';
  if (thousand > 0) result += inWords(thousand) + ' Thousand ';
  if (remainder > 0) result += inWords(remainder);

  return (result.trim() || 'Zero') + ' Rupees Only';
}

// Convert amount into exact Indian GST / Tally format words (e.g. INR Six Thousand Two Hundred Only, INR Nine Hundred Forty Five and Seventy Six paise Only)
export function numberToWordsINR(num: number | undefined | null): string {
  if (num === undefined || num === null || isNaN(num) || num === 0) {
    return 'INR Zero Only';
  }

  const a = [
    '',
    'One',
    'Two',
    'Three',
    'Four',
    'Five',
    'Six',
    'Seven',
    'Eight',
    'Nine',
    'Ten',
    'Eleven',
    'Twelve',
    'Thirteen',
    'Fourteen',
    'Fifteen',
    'Sixteen',
    'Seventeen',
    'Eighteen',
    'Nineteen',
  ];
  const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  function inWords(n: number): string {
    let str = '';
    if (n > 99) {
      str += a[Math.floor(n / 100)] + ' Hundred ';
      n %= 100;
    }
    if (n > 19) {
      str += b[Math.floor(n / 10)] + (n % 10 !== 0 ? ' ' + a[n % 10] : '');
    } else if (n > 0) {
      str += a[n];
    }
    return str.trim();
  }

  function convertInteger(val: number): string {
    if (val === 0) return '';
    let result = '';
    const crore = Math.floor(val / 10000000);
    const lakh = Math.floor((val % 10000000) / 100000);
    const thousand = Math.floor((val % 100000) / 1000);
    const remainder = val % 1000;

    if (crore > 0) result += inWords(crore) + ' Crore ';
    if (lakh > 0) result += inWords(lakh) + ' Lakh ';
    if (thousand > 0) result += inWords(thousand) + ' Thousand ';
    if (remainder > 0) result += inWords(remainder);
    return result.trim();
  }

  const rounded = Math.round(Math.abs(num) * 100) / 100;
  const integerPart = Math.floor(rounded);
  const paisePart = Math.round((rounded - integerPart) * 100);

  const integerWords = convertInteger(integerPart);
  const paiseWords = paisePart > 0 ? inWords(paisePart) : '';

  if (integerWords && paiseWords) {
    return `INR ${integerWords} and ${paiseWords} paise Only`;
  } else if (integerWords) {
    return `INR ${integerWords} Only`;
  } else if (paiseWords) {
    return `INR ${paiseWords} paise Only`;
  }

  return 'INR Zero Only';
}

// Format date into standard Tally DD-MMM-YY (e.g. 29-Jan-26)
export function formatTallyDate(dateString: string | undefined | null): string {
  if (!dateString) return '—';
  try {
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return dateString;
    const day = String(d.getDate()).padStart(2, '0');
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const month = months[d.getMonth()];
    const year = String(d.getFullYear()).slice(-2);
    return `${day}-${month}-${year}`;
  } catch {
    return dateString;
  }
}

// Format number into Indian format without currency symbol (e.g. 5,254.24)
export function formatTallyCurrency(amount: number | undefined | null): string {
  if (amount === undefined || amount === null || isNaN(amount)) return '0.00';
  return new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

// Generate pre-filled WhatsApp message and Web link
export function generateWhatsAppMessage(
  customerName: string,
  invoiceNumber: string,
  totalAmount: number,
  paidAmount: number,
  balanceAmount: number,
  items?: any[]
): string {
  let itemsList = '';
  if (items && items.length > 0) {
    itemsList = '\n🛒 *Products:*\n' + items.map(item => `• ${item.productName} (x${item.quantity})`).join('\n') + '\n';
  }

  return `Dear ${customerName || 'Customer'},\n\nThank you for purchasing from *SM Autos & Battery*.\n\n📄 *Invoice No:* ${invoiceNumber}\n${itemsList}💰 *Invoice Amount:* ${formatINR(totalAmount)}\n✅ *Paid Amount:* ${formatINR(paidAmount)}\n⚠️ *Balance Due:* ${formatINR(balanceAmount)}\n\nFor any warranty or battery maintenance support, contact us at +91 9578851650.\n\nThank you for your business!`;
}

export function getWhatsAppShareUrl(phone: string, message: string): string {
  const cleanPhone = phone.replace(/[^0-9]/g, '');
  const formattedPhone = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;
  // Use web.whatsapp.com explicitly for desktop browser compatibility
  return `https://web.whatsapp.com/send?phone=${formattedPhone}&text=${encodeURIComponent(message)}`;
}
