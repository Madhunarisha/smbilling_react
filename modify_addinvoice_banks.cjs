const fs = require('fs');
const path = '/Users/hazzinotechnologies/smbilling_react/src/pages/AddInvoice.tsx';
let code = fs.readFileSync(path, 'utf8');

// 1. Change initial state of banks to []
code = code.replace(
  "const [banks, setBanks] = useState<BankOption[]>([",
  "const [banks, setBanks] = useState<BankOption[]>(["
);
code = code.replace(
  "    { id: 'b1', bankName: 'HDFC Bank', accountNumber: '50200055443322', ifsc: 'HDFC0001234', branch: 'Main Branch, Delhi' }",
  ""
);

// 2. Fetch banks on mount
const fetchLogic = `    // Fetch banks
    const fetchBanks = async () => {
      try {
        const res = await fetch('/api/banks', {
          headers: { Authorization: \`Bearer \${token}\` },
        });
        if (res.ok) {
          const data = await res.json();
          setBanks(data);
          if (data.length > 0) setSelectedBankId(data[0].id);
        }
      } catch (err) {
        console.error('Failed to fetch banks', err);
      }
    };
    fetchBanks();
`;

// Insert fetchLogic into useEffect
const useEffectStart = code.indexOf("useEffect(() => {");
const endOfUseEffectStart = code.indexOf("{", useEffectStart) + 1;
code = code.substring(0, endOfUseEffectStart) + "\n" + fetchLogic + code.substring(endOfUseEffectStart);

// 3. Update handleAddNewBank to POST to backend
const handleAddNewBankStart = code.indexOf("const handleAddNewBank = (e: React.FormEvent) => {");
// It's async now
code = code.replace("const handleAddNewBank = (e: React.FormEvent) => {", "const handleAddNewBank = async (e: React.FormEvent) => {");

const oldBankLogic = `    const newB: BankOption = {
      id: \`bank-\${Date.now()}\`,
      bankName: newBankName.trim(),
      accountNumber: newBankAcc.trim(),
      ifsc: newBankIfsc.trim().toUpperCase(),
      branch: newBankBranch.trim(),
    };
    setBanks((prev) => [...prev, newB]);
    setSelectedBankId(newB.id);
    setShowAddBankModal(false);
    setNewBankName('');
    setNewBankAcc('');
    setNewBankIfsc('');
    setNewBankBranch('');
    showToast('Bank account added successfully', 'success');`;

const newBankLogic = `    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/banks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: \`Bearer \${token}\`,
        },
        body: JSON.stringify({
          bankName: newBankName.trim(),
          accountNumber: newBankAcc.trim(),
          ifsc: newBankIfsc.trim(),
          branch: newBankBranch.trim()
        })
      });
      if (res.ok) {
        const newB = await res.json();
        setBanks((prev) => [...prev, newB]);
        setSelectedBankId(newB.id);
        setShowAddBankModal(false);
        setNewBankName('');
        setNewBankAcc('');
        setNewBankIfsc('');
        setNewBankBranch('');
        showToast('Bank account added successfully', 'success');
      } else {
        showToast('Failed to add bank', 'error');
      }
    } catch (err) {
      showToast('Network error', 'error');
    }`;

code = code.replace(oldBankLogic, newBankLogic);

fs.writeFileSync(path, code, 'utf8');
console.log("Updated AddInvoice.tsx to use backend API for banks");
