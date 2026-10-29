'use strict';
/* =====================================================================
   Coll Ledger — core accounting engine
   Every money movement is double-entry under the hood:
   - a bank/card transaction posts to its account and to its category
   - a sent invoice posts Accounts Receivable against income (+ sales tax)
   - opening balances post against Opening Balance Equity
   So the Balance Sheet always balances, while the UI stays simple.
   ===================================================================== */
const Core = (() => {
  const uid = () => Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-5);
  const round2 = n => Math.round((Number(n) + Number.EPSILON) * 100) / 100;
  const pad = n => String(n).padStart(2, '0');
  const isoOf = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const todayISO = () => isoOf(new Date());
  const parseISO = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
  const addDays = (iso, n) => { const d = parseISO(iso); d.setDate(d.getDate() + n); return isoOf(d); };
  const daysBetween = (a, b) => Math.round((parseISO(b) - parseISO(a)) / 86400000);
  const monthKey = iso => iso.slice(0, 7);

  const TYPES = {
    asset:     { label: 'Assets',      normal: 'debit' },
    liability: { label: 'Liabilities', normal: 'credit' },
    equity:    { label: 'Equity',      normal: 'credit' },
    income:    { label: 'Income',      normal: 'credit' },
    expense:   { label: 'Expenses',    normal: 'debit' }
  };
  const SUBTYPES = {
    asset: ['bank', 'clearing', 'ar', 'current', 'fixed'],
    liability: ['credit', 'ap', 'current', 'loan'],
    equity: ['equity'],
    income: ['income', 'otherincome'],
    expense: ['cogs', 'expense', 'otherexpense']
  };
  const SUB_LABEL = {
    bank: 'Bank account', clearing: 'Payment processor (Square, Stripe, PayPal)', ar: 'Accounts receivable', current: 'Other current', fixed: 'Fixed asset',
    credit: 'Credit card', ap: 'Accounts payable', loan: 'Loan / long-term', equity: 'Equity',
    income: 'Income', otherincome: 'Other income', cogs: 'Cost of goods sold', expense: 'Operating expense', otherexpense: 'Other expense'
  };
  const isDebitNormal = type => TYPES[type].normal === 'debit';
  const isMoneyAccount = a => !!a && (a.sub === 'bank' || a.sub === 'credit' || a.sub === 'clearing');

  const DEFAULT_ACCOUNTS = [
    ['1000', 'Business Checking', 'asset', 'bank', null],
    ['1010', 'Business Savings', 'asset', 'bank', null],
    ['1200', 'Accounts Receivable', 'asset', 'ar', 'ar'],
    ['1500', 'Equipment & Vehicles', 'asset', 'fixed', null],
    ['2000', 'Business Credit Card', 'liability', 'credit', null],
    ['2100', 'Accounts Payable', 'liability', 'ap', 'ap'],
    ['2200', 'Sales Tax Payable', 'liability', 'current', 'tax'],
    ['2500', 'Loans Payable', 'liability', 'loan', null],
    ['3000', "Owner's Contributions", 'equity', 'equity', 'contrib'],
    ['3100', "Owner's Draw", 'equity', 'equity', 'draw'],
    ['3900', 'Opening Balance Equity', 'equity', 'equity', 'obe'],
    ['4000', 'Sales', 'income', 'income', 'sales'],
    ['4100', 'Service Revenue', 'income', 'income', 'service'],
    ['4900', 'Other Income', 'income', 'otherincome', null],
    ['4999', 'Uncategorized Income', 'income', 'otherincome', 'unc_inc'],
    ['5000', 'Cost of Goods Sold', 'expense', 'cogs', 'cogs'],
    ['6000', 'Advertising & Marketing', 'expense', 'expense', null],
    ['6100', 'Bank & Merchant Fees', 'expense', 'expense', null],
    ['6150', 'Car & Truck', 'expense', 'expense', null],
    ['6200', 'Contract Labor', 'expense', 'expense', null],
    ['6300', 'Insurance', 'expense', 'expense', null],
    ['6400', 'Meals', 'expense', 'expense', null],
    ['6450', 'Office Supplies', 'expense', 'expense', null],
    ['6500', 'Legal & Professional Fees', 'expense', 'expense', null],
    ['6600', 'Rent & Lease', 'expense', 'expense', null],
    ['6700', 'Repairs & Maintenance', 'expense', 'expense', null],
    ['6750', 'Software & Subscriptions', 'expense', 'expense', null],
    ['6800', 'Phone & Internet', 'expense', 'expense', null],
    ['6850', 'Travel', 'expense', 'expense', null],
    ['6900', 'Utilities', 'expense', 'expense', null],
    ['6950', 'Payroll & Wages', 'expense', 'expense', null],
    ['6960', 'Taxes & Licenses', 'expense', 'expense', null],
    ['6990', 'Miscellaneous Expense', 'expense', 'otherexpense', null],
    ['6999', 'Uncategorized Expense', 'expense', 'otherexpense', 'unc_exp']
  ];

  const CLIENT_COLORS = ['#1E6B53', '#B8893B', '#3B6EA5', '#8A4F7D', '#C0603A', '#4F7A3A', '#5A5FA8', '#2E7C86'];

  function newData() {
    return {
      version: 1,
      theme: 'system',
      firm: { name: '', owner: '', email: '', phone: '' },
      clients: [],
      activeClientId: null
    };
  }

  function newClient(opts = {}) {
    const now = new Date();
    return {
      id: uid(),
      name: opts.name || 'New Client',
      legalName: opts.legalName || '',
      industry: opts.industry || '',
      color: opts.color || CLIENT_COLORS[Math.floor(Math.random() * CLIENT_COLORS.length)],
      email: opts.email || '', phone: opts.phone || '', address: opts.address || '', ein: '',
      startDate: opts.startDate || `${now.getFullYear()}-01-01`,
      fyStartMonth: opts.fyStartMonth || 1,
      invoicePrefix: opts.invoicePrefix || 'INV-',
      nextInvoice: opts.nextInvoice || 1001,
      defaultTerms: 30,
      defaultTaxRate: 0,
      createdAt: todayISO(),
      accounts: DEFAULT_ACCOUNTS.map(([code, name, type, sub, key]) => ({ id: uid(), code, name, type, sub, key, opening: 0, archived: false })),
      transactions: [],
      invoices: [],
      bills: [],
      recurring: [],
      contacts: [],
      rules: [],
      reconciliations: [],
      closes: [],
      imports: [],
      lockDate: null
    };
  }

  const acct = (c, id) => c.accounts.find(a => a.id === id);
  const acctByKey = (c, key) => c.accounts.find(a => a.key === key);
  const acctByName = (c, name) => c.accounts.find(a => a.name.toLowerCase() === String(name).toLowerCase());
  const contact = (c, id) => c.contacts.find(x => x.id === id);
  const normName = s => String(s || '').toLowerCase().replace(/^\d{3,6}(?:[.-]\d+)?\s+/, '').split(':').pop().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, ' ').trim();
  const SYNONYMS = {
    'checking': 'business checking', 'savings': 'business savings', 'credit card': 'business credit card',
    'accounts receivable a r': 'accounts receivable', 'a r': 'accounts receivable', 'sales of product income': 'sales', 'services': 'service revenue',
    'advertising': 'advertising and marketing', 'bank charges': 'bank and merchant fees', 'bank charges and fees': 'bank and merchant fees', 'merchant fees': 'bank and merchant fees',
    'car and truck': 'car and truck', 'auto': 'car and truck', 'automobile': 'car and truck', 'contractors': 'contract labor', 'legal and professional services': 'legal and professional fees',
    'meals and entertainment': 'meals', 'office supplies and software': 'office supplies', 'rent or lease': 'rent and lease', 'rent': 'rent and lease',
    'repair and maintenance': 'repairs and maintenance', 'repairs': 'repairs and maintenance', 'supplies': 'office supplies', 'utilities': 'utilities', 'payroll expenses': 'payroll and wages',
    'wages': 'payroll and wages', 'taxes and licenses': 'taxes and licenses', 'uncategorized income': 'uncategorized income', 'uncategorized expense': 'uncategorized expense',
    'opening balance equity': 'opening balance equity', 'owner s equity': "owner s contributions", 'owner s investment': 'owner s contributions', 'owner s pay and personal expenses': 'owner s draw', 'owner draws': 'owner s draw',
    'cost of goods sold': 'cost of goods sold', 'telephone': 'phone and internet', 'phone': 'phone and internet', 'internet': 'phone and internet', 'insurance': 'insurance', 'travel': 'travel'
  };
  function findAccount(c, name) {
    const parts = String(name || '').split(':');
    for (let i = parts.length; i >= 1; i--) { const hit = findAccountExact(c, parts.slice(0, i).join(':')); if (hit) return hit; }
    return null;
  }
  function findAccountExact(c, name) {
    const n = normName(name);
    if (!n) return null;
    const live = c.accounts.filter(a => !a.archived);
    let a = live.find(x => normName(x.name) === n) || c.accounts.find(x => normName(x.name) === n);
    if (a) return a;
    const syn = SYNONYMS[n];
    if (syn) a = live.find(x => normName(x.name) === syn);
    return a || null;
  }
  function ensureAccount(c, { name, type, sub, code, key }) {
    let a = (key && acctByKey(c, key)) || findAccount(c, name);
    if (a) return a;
    const used = new Set(c.accounts.map(x => x.code));
    let cd = code && !used.has(code) ? code : null;
    if (!cd) { const base = { asset: 1100, liability: 2600, equity: 3200, income: 4200, expense: 6500 }[type] || 9000; let n = base; while (used.has(String(n))) n += 10; cd = String(n); }
    a = { id: uid(), code: cd, name, type, sub, key: key || null, opening: 0, archived: false };
    c.accounts.push(a);
    return a;
  }
  const isLocked = (c, date) => !!(c.lockDate && date && date <= c.lockDate);

  // ---------- Postings ----------
  function postings(c) {
    const out = [];
    const obe = acctByKey(c, 'obe');
    const ar = acctByKey(c, 'ar');
    const tax = acctByKey(c, 'tax');
    const uncInc = acctByKey(c, 'unc_inc');
    const uncExp = acctByKey(c, 'unc_exp');
    const start = c.startDate || '1900-01-01';

    for (const a of c.accounts) {
      const amt = round2(a.opening || 0);
      if (!amt || (a.type !== 'asset' && a.type !== 'liability')) continue;
      if (a.type === 'asset') { out.push({ acc: a.id, date: start, dr: amt, cr: 0 }); out.push({ acc: obe.id, date: start, dr: 0, cr: amt }); }
      else { out.push({ acc: a.id, date: start, dr: 0, cr: amt }); out.push({ acc: obe.id, date: start, dr: amt, cr: 0 }); }
    }

    for (const t of c.transactions) {
      const amt = round2(t.amount);
      if (!amt && !(Array.isArray(t.splits) && t.splits.length)) continue;
      if (!acct(c, t.accountId)) continue;
      // money side
      out.push({ acc: t.accountId, date: t.date, dr: amt > 0 ? amt : 0, cr: amt < 0 ? -amt : 0, t });
      // category side: one category, or several when the transaction is split
      const parts = (t.status !== 'review' && Array.isArray(t.splits) && t.splits.length) ? t.splits : [{ categoryId: t.categoryId, amount: amt }];
      let left = amt;
      parts.forEach((sp, i) => {
        const v = i === parts.length - 1 ? round2(left) : round2(sp.amount);
        left = round2(left - v);
        if (!v) return;
        let cat = t.status !== 'review' && sp.categoryId && acct(c, sp.categoryId);
        if (!cat) cat = v > 0 ? uncInc : uncExp;
        out.push({ acc: cat.id, date: t.date, dr: v < 0 ? -v : 0, cr: v > 0 ? v : 0, t, split: parts.length > 1 ? sp : null });
      });
    }

    for (const inv of c.invoices) {
      if (inv.status === 'draft' || inv.status === 'void') continue;
      const tot = invoiceTotals(inv);
      if (!tot.total) continue;
      out.push({ acc: ar.id, date: inv.date, dr: tot.total, cr: 0, inv });
      for (const ln of inv.lines) {
        const v = round2((+ln.qty || 0) * (+ln.rate || 0));
        if (!v) continue;
        const accId = ln.accountId && acct(c, ln.accountId) ? ln.accountId : (acctByKey(c, 'service') || acctByKey(c, 'sales')).id;
        out.push({ acc: accId, date: inv.date, dr: v < 0 ? -v : 0, cr: v > 0 ? v : 0, inv });
      }
      if (tot.tax) out.push({ acc: tax.id, date: inv.date, dr: 0, cr: tot.tax, inv });
      if (tot.discount) {
        const first = inv.lines.find(l => l.accountId && acct(c, l.accountId));
        out.push({ acc: first ? first.accountId : (acctByKey(c, 'service') || acctByKey(c, 'sales')).id, date: inv.date, dr: tot.discount, cr: 0, inv });
      }
    }

    // vendor bills: the expense is recorded on the bill date, owed in Accounts Payable until paid
    if ((c.bills || []).some(b => b.status !== 'draft' && b.status !== 'void')) {
      const ap = ensureAP(c);
      for (const b of c.bills) {
        if (b.status === 'draft' || b.status === 'void') continue;
        const total = billTotal(b);
        if (!total) continue;
        out.push({ acc: ap.id, date: b.date, dr: 0, cr: total, bill: b });
        for (const ln of b.lines) {
          const v = round2(+ln.amount || 0);
          if (!v) continue;
          const accId = ln.accountId && acct(c, ln.accountId) ? ln.accountId : acctByKey(c, 'unc_exp').id;
          out.push({ acc: accId, date: b.date, dr: v > 0 ? v : 0, cr: v < 0 ? -v : 0, bill: b });
        }
      }
    }
    return out;
  }

  // natural-sign balance for every account, optionally limited to a date range
  function balances(c, range = {}) {
    const map = new Map(c.accounts.map(a => [a.id, 0]));
    const types = new Map(c.accounts.map(a => [a.id, a.type]));
    for (const p of postings(c)) {
      if (range.from && p.date < range.from) continue;
      if (range.to && p.date > range.to) continue;
      const type = types.get(p.acc);
      if (!type) continue;
      const delta = isDebitNormal(type) ? p.dr - p.cr : p.cr - p.dr;
      map.set(p.acc, round2(map.get(p.acc) + delta));
    }
    return map;
  }

  function profitLoss(c, from, to) {
    const bal = balances(c, { from, to });
    const lines = sub => c.accounts.filter(a => a.sub === sub && Math.abs(bal.get(a.id)) > 0.004).map(a => ({ a, v: bal.get(a.id) })).sort((x, y) => x.a.code.localeCompare(y.a.code));
    const sum = arr => round2(arr.reduce((s, x) => s + x.v, 0));
    const income = lines('income'), otherIncome = lines('otherincome'), cogs = lines('cogs'), expense = lines('expense'), otherExpense = lines('otherexpense');
    const totalIncome = sum(income), totalCogs = sum(cogs), gross = round2(totalIncome - totalCogs);
    const totalExpense = sum(expense), operating = round2(gross - totalExpense);
    const net = round2(operating + sum(otherIncome) - sum(otherExpense));
    return { income, otherIncome, cogs, expense, otherExpense, totalIncome, totalCogs, gross, totalExpense, operating, totalOtherIncome: sum(otherIncome), totalOtherExpense: sum(otherExpense), net };
  }

  function fyStart(c, asOf) {
    const d = parseISO(asOf);
    const m = (c.fyStartMonth || 1) - 1;
    const y = d.getMonth() >= m ? d.getFullYear() : d.getFullYear() - 1;
    return isoOf(new Date(y, m, 1));
  }

  function balanceSheet(c, asOf) {
    const bal = balances(c, { to: asOf });
    const fy = fyStart(c, asOf);
    const netYTD = profitLoss(c, fy, asOf).net;
    const netAll = profitLoss(c, null, asOf).net;
    const retained = round2(netAll - netYTD);
    const group = type => c.accounts.filter(a => a.type === type && Math.abs(bal.get(a.id)) > 0.004).map(a => ({ a, v: bal.get(a.id) })).sort((x, y) => x.a.code.localeCompare(y.a.code));
    const sum = arr => round2(arr.reduce((s, x) => s + x.v, 0));
    const assets = group('asset'), liabilities = group('liability'), equity = group('equity');
    const totalAssets = sum(assets), totalLiab = sum(liabilities);
    const totalEquity = round2(sum(equity) + retained + netYTD);
    return { assets, liabilities, equity, retained, netYTD, totalAssets, totalLiab, totalEquity, check: round2(totalAssets - totalLiab - totalEquity) };
  }

  // ---------- Invoices ----------
  function invoiceTotals(inv) {
    const subtotal = round2((inv.lines || []).reduce((s, l) => s + (+l.qty || 0) * (+l.rate || 0), 0));
    const discount = round2(+inv.discount || 0);
    const taxable = Math.max(0, subtotal - discount);
    const tax = round2(taxable * (+inv.taxRate || 0) / 100);
    return { subtotal, discount, tax, total: round2(taxable + tax) };
  }
  // ---------- Bills ----------
  function ensureAP(c) {
    let a = acctByKey(c, 'ap');
    if (!a) { a = { id: uid(), code: c.accounts.some(x => x.code === '2100') ? '2105' : '2100', name: 'Accounts Payable', type: 'liability', sub: 'ap', key: 'ap', opening: 0, archived: false }; c.accounts.push(a); }
    return a;
  }
  const billTotal = b => round2((b.lines || []).reduce((s, l) => s + (+l.amount || 0), 0));
  const billPaid = (c, b) => round2(c.transactions.filter(t => t.billId === b.id).reduce((s, t) => s + Math.abs(t.amount), 0));
  function billState(c, b) {
    const total = billTotal(b), paid = billPaid(c, b), due = round2(total - paid);
    if (b.status === 'void') return { status: 'void', label: 'Void', tone: '', paid, due: 0, total };
    if (b.status === 'draft') return { status: 'draft', label: 'Draft', tone: '', paid, due, total };
    if (due <= 0.004) return { status: 'paid', label: 'Paid', tone: 'green', paid, due: 0, total };
    const days = daysBetween(todayISO(), b.dueDate);
    if (days < 0) return { status: 'overdue', label: `Overdue ${-days}d`, tone: 'red', paid, due, total };
    if (days <= 7) return { status: 'soon', label: days === 0 ? 'Due today' : `Due in ${days}d`, tone: 'gold', paid, due, total };
    return { status: 'open', label: paid > 0 ? 'Partly paid' : 'Unpaid', tone: 'blue', paid, due, total };
  }

  // ---------- Recurring ----------
  function nextDate(iso, every) {
    if (every === 'week') return addDays(iso, 7);
    if (every === 'twoweeks') return addDays(iso, 14);
    const d = parseISO(iso);
    const step = { month: 1, quarter: 3, year: 12 }[every] || 1;
    const want = d.getDate();
    const n = new Date(d.getFullYear(), d.getMonth() + step, 1);
    const last = new Date(n.getFullYear(), n.getMonth() + 1, 0).getDate();
    n.setDate(Math.min(want, last));
    return isoOf(n);
  }

  // ---------- Tax-time reports ----------
  function trialBalance(c, asOf) {
    const bal = balances(c, { to: asOf });
    const fy = fyStart(c, asOf);
    const yearBal = balances(c, { from: fy, to: asOf });
    const rows = [];
    let dr = 0, cr = 0;
    for (const a of [...c.accounts].sort((x, y) => x.code.localeCompare(y.code))) {
      // income and expenses show this business year only; earlier years roll into retained earnings
      const v = (a.type === 'income' || a.type === 'expense') ? yearBal.get(a.id) : bal.get(a.id);
      if (Math.abs(v) < 0.005) continue;
      const debitSide = isDebitNormal(a.type) ? v >= 0 : v < 0;
      const amt = round2(Math.abs(v));
      rows.push({ a, debit: debitSide ? amt : 0, credit: debitSide ? 0 : amt });
      if (debitSide) dr += amt; else cr += amt;
    }
    const retained = round2(profitLoss(c, null, addDays(fy, -1)).net);
    if (Math.abs(retained) > 0.004) {
      rows.push({ a: { code: '3950', name: 'Retained earnings (earlier years)', type: 'equity' }, debit: retained < 0 ? -retained : 0, credit: retained > 0 ? retained : 0 });
      if (retained > 0) cr += retained; else dr -= retained;
    }
    return { rows, debit: round2(dr), credit: round2(cr) };
  }
  // Payments to 1099 contractors in a calendar year. Card and processor payments are left out —
  // the card company reports those on a 1099-K.
  const threshold1099 = year => (+year >= 2026 ? 2000 : 600);
  function contractorPayments(c, year) {
    const from = `${year}-01-01`, to = `${year}-12-31`;
    return c.contacts.filter(x => x.kind === 'vendor' && x.is1099).map(v => {
      const n = normName(v.name), k = keyOf(v.name);
      let total = 0, card = 0;
      for (const t of c.transactions) {
        if (t.date < from || t.date > to || t.amount >= 0) continue;
        const bill = t.billId && (c.bills || []).find(b => b.id === t.billId);
        const match = (bill && bill.vendorId === v.id) || t.vendorId === v.id || normName(t.payee) === n || (k && keyOf(t.description).startsWith(k));
        if (!match) continue;
        const acc = acct(c, t.accountId);
        if (acc && (acc.sub === 'credit' || acc.sub === 'clearing')) card += -t.amount; else total += -t.amount;
      }
      return { v, total: round2(total), card: round2(card), needs: total >= threshold1099(year) };
    }).sort((a, b) => b.total - a.total);
  }
  function salesTax(c, from, to) {
    const tax = acctByKey(c, 'tax');
    let collected = 0, paid = 0;
    if (!tax) return { collected, paid, owed: 0 };
    for (const p of postings(c)) {
      if (p.acc !== tax.id || p.date < from || p.date > to) continue;
      collected += p.cr; paid += p.dr;
    }
    return { collected: round2(collected), paid: round2(paid), owed: round2(balances(c, { to }).get(tax.id)) };
  }

  function invoicePaid(c, inv) {
    return round2(c.transactions.filter(t => t.invoiceId === inv.id).reduce((s, t) => s + Math.abs(t.amount), 0));
  }
  function invoiceState(c, inv) {
    const tot = invoiceTotals(inv).total;
    const paid = invoicePaid(c, inv);
    const due = round2(tot - paid);
    let status = inv.status;
    if (status === 'void') return { status: 'void', label: 'Void', tone: '', paid, due: 0, total: tot };
    if (status === 'draft') return { status, label: 'Draft', tone: '', paid, due, total: tot };
    if (due <= 0.004) return { status: 'paid', label: 'Paid', tone: 'green', paid, due: 0, total: tot };
    const late = inv.dueDate < todayISO();
    if (late) return { status: 'overdue', label: `Overdue ${daysBetween(inv.dueDate, todayISO())}d`, tone: 'red', paid, due, total: tot };
    if (paid > 0) return { status: 'partial', label: 'Partially paid', tone: 'gold', paid, due, total: tot };
    return { status: 'open', label: 'Open', tone: 'blue', paid, due, total: tot };
  }

  // ---------- Smart categorization ----------
  const norm = s => String(s || '').toLowerCase().replace(/[#*0-9]+/g, ' ').replace(/[^a-z& ]+/g, ' ').replace(/\s+/g, ' ').trim();
  const keyOf = s => norm(s).split(' ').filter(w => w.length > 1 && !['pos', 'debit', 'card', 'purchase', 'ach', 'the', 'payment', 'online'].includes(w)).slice(0, 3).join(' ');

  function ruleFor(c, t) {
    const text = norm(t.description + ' ' + (t.payee || ''));
    for (const r of c.rules) {
      if (!r.text) continue;
      if (r.direction === 'in' && t.amount < 0) continue;
      if (r.direction === 'out' && t.amount > 0) continue;
      const needle = norm(r.text);
      if (needle && text.includes(needle)) return r;
    }
    return null;
  }

  // Built-in knowledge of common vendors, used when there is no rule or history yet
  const GUESSES = [
    [/transfer to owner|owner draw|owner'?s draw|to personal/, 'out', { key: 'draw' }],
    [/payment to .*card|card payment|credit card (payment|autopay)|amex (payment|epayment)|capital one (payment|card)|chase card|discover (payment|e-payment)|citi card|thank you payment/, 'any', { sub: 'credit' }],
    [/payroll|gusto|adp |paychex|intuit payroll|rippling/, 'out', { name: 'Payroll & Wages' }],
    [/\brent\b|properties|property mgmt|lease pmt|landlord/, 'out', { name: 'Rent & Lease' }],
    [/xcel|energy|electric|power co|water|sewer|waste|trash|republic services|gas co|natural gas|utility/, 'out', { name: 'Utilities' }],
    [/comcast|xfinity|verizon|at&t|t-mobile|spectrum|centurylink|lumen|google fi|internet|wireless/, 'out', { name: 'Phone & Internet' }],
    [/shell|chevron|exxon|conoco|phillips 66|sinclair|maverik|valero|bp |circle k|fuel|gas station|jiffy lube|autozone|o'?reilly|car wash|parking/, 'out', { name: 'Car & Truck' }],
    [/uber|lyft|airline|delta|united air|southwest|american air|frontier|hotel|marriott|hilton|hyatt|airbnb|expedia/, 'out', { name: 'Travel' }],
    [/restaurant(?! depot)|doordash|grubhub|uber eats|starbucks|mcdonald|chipotle|subway|cafe|coffee shop|pizza|diner|grill/, 'out', { name: 'Meals' }],
    [/facebk|facebook|meta ads|google \*?ads|yelp|nextdoor|mailchimp|vistaprint|constant contact/, 'out', { name: 'Advertising & Marketing' }],
    [/adobe|microsoft|google \*?(gsuite|workspace)|canva|dropbox|zoom|intuit|quickbooks|squarespace|wix|godaddy|shopify|slack|openai|apple\.com\/bill|jobber|subscription/, 'out', { name: 'Software & Subscriptions' }],
    [/amazon|staples|office depot|officemax|walmart|target|usps|ups store|fedex/, 'out', { name: 'Office Supplies' }],
    [/home depot|lowe'?s|ace hardware|menards|harbor freight|repair|plumb|hvac/, 'out', { name: 'Repairs & Maintenance' }],
    [/insurance|geico|state farm|progressive|allstate|hiscox|next insurance|farmers ins/, 'out', { name: 'Insurance' }],
    [/\birs\b|treasury|tax pmt|dept of revenue|department of revenue|license|city of|county of|state of|secretary of state/, 'out', { name: 'Taxes & Licenses' }],
    [/cpa|attorney|law office|legal|accounting|bookkeep/, 'out', { name: 'Legal & Professional Fees' }],
    [/service fee|monthly fee|maintenance fee|overdraft|nsf|wire fee|interest charge|merchant fee|processing fee|stripe fee/, 'out', { name: 'Bank & Merchant Fees' }],
    [/costco|sam'?s club|restaurant depot|sysco|us foods|king soopers|safeway|kroger|whole foods|wholesale|packaging|supply co/, 'out', { name: 'Cost of Goods Sold' }],
    [/interest (paid|earned|credit)|dividend/, 'in', { name: 'Other Income' }],
    [/deposit|square|stripe|paypal|venmo|zelle|shopify pay|mobile dep|counter sales|sales/, 'in', { income: true }]
  ];
  function guess(c, t) {
    const text = norm(t.description + ' ' + (t.payee || ''));
    const dir = t.amount > 0 ? 'in' : 'out';
    for (const [re, d, target] of GUESSES) {
      if (d !== 'any' && d !== dir) continue;
      if (!re.test(text)) continue;
      let a = null;
      if (target.key) a = acctByKey(c, target.key);
      else if (target.sub) a = c.accounts.find(x => x.sub === target.sub && !x.archived && x.id !== t.accountId);
      else if (target.name) a = findAccount(c, target.name);
      else if (target.income) {
        // the income account this client uses most, else Sales
        const counts = {};
        for (const x of c.transactions) { const ac = x.categoryId && acct(c, x.categoryId); if (ac && ac.type === 'income' && !ac.key?.startsWith('unc')) counts[ac.id] = (counts[ac.id] || 0) + 1; }
        for (const i of c.invoices) for (const l of i.lines) if (l.accountId) counts[l.accountId] = (counts[l.accountId] || 0) + 1;
        const top = Object.entries(counts).sort((x, y) => y[1] - x[1])[0];
        a = top ? acct(c, top[0]) : acctByKey(c, 'sales');
      }
      if (a && !a.archived && a.id !== t.accountId) return a;
    }
    return null;
  }

  function suggest(c, t) {
    if (t.suggestedId && acct(c, t.suggestedId) && t.suggestedId !== t.accountId) return { categoryId: t.suggestedId, payee: '', source: 'you' };
    const r = ruleFor(c, t);
    if (r && acct(c, r.categoryId) && r.categoryId !== t.accountId) return { categoryId: r.categoryId, payee: r.payee || '', source: 'rule', rule: r };
    const k = keyOf(t.description);
    if (k) {
      let best = null;
      for (const x of c.transactions) {
        if (x === t || x.status === 'review' || !x.categoryId || x.invoiceId || x.categoryId === t.accountId) continue;
        if (Math.sign(x.amount) !== Math.sign(t.amount)) continue;
        if (keyOf(x.description) === k && (!best || x.date > best.date)) best = x;
      }
      if (best) return { categoryId: best.categoryId, payee: best.payee || '', source: 'history' };
    }
    const g = guess(c, t);
    if (g) return { categoryId: g.id, payee: '', source: 'guess' };
    return null;
  }

  function cleanPayee(desc) {
    let s = String(desc || '').replace(/\b(POS|DEBIT|CARD|PURCHASE|ACH|WEB|PPD|CCD|ONLINE|PMT|ID:?\s*\S+)\b/gi, ' ').replace(/[#*]\S*/g, ' ').replace(/\d{3,}/g, ' ').replace(/\s+/g, ' ').trim();
    return s.toLowerCase().replace(/\b[a-z]/g, m => m.toUpperCase()).slice(0, 40);
  }

  // ---------- CSV ----------
  function parseCSV(text) {
    const rows = []; let row = []; let cell = ''; let q = false;
    text = String(text).replace(/^﻿/, '');
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (q) {
        if (ch === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; }
        else cell += ch;
      } else if (ch === '"') q = true;
      else if (ch === ',') { row.push(cell); cell = ''; }
      else if (ch === '\n' || ch === '\r') {
        if (ch === '\r' && text[i + 1] === '\n') i++;
        row.push(cell); cell = '';
        if (row.some(v => v.trim() !== '')) rows.push(row);
        row = [];
      } else cell += ch;
    }
    row.push(cell);
    if (row.some(v => v.trim() !== '')) rows.push(row);
    return rows;
  }
  function toCSV(rows) {
    return rows.map(r => r.map(v => {
      const s = v == null ? '' : String(v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    }).join(',')).join('\r\n');
  }
  const validYMD = (y, mo, d) => { const dt = new Date(y, mo - 1, d); return dt.getFullYear() === y && dt.getMonth() === mo - 1 && dt.getDate() === d ? `${y}-${pad(mo)}-${pad(d)}` : null; };
  // order: 'mdy' (US, default) or 'dmy'
  function parseDate(s, order = 'mdy') {
    s = String(s ?? '').trim();
    if (!s) return null;
    let m;
    if ((m = s.match(/^(\d{4})[-\/.](\d{1,2})[-\/.](\d{1,2})/))) return validYMD(+m[1], +m[2], +m[3]);
    if ((m = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})\b/))) {
      let y = +m[3]; if (y < 100) y += y < 70 ? 2000 : 1900;
      let a = +m[1], b = +m[2];
      if (order === 'dmy' || a > 12) [a, b] = [b, a];
      return validYMD(y, a, b);
    }
    if (/^\d{5}(\.\d+)?$/.test(s)) { const n = +s; if (n > 20000 && n < 80000) { const d = new Date(Math.round((n - 25569) * 86400000)); return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`; } return null; }
    if (/^\d+([.,]\d+)?$/.test(s)) return null;
    const d = new Date(s);
    return isNaN(d) || d.getFullYear() < 1990 || d.getFullYear() > 2100 ? null : isoOf(d);
  }
  // Looks at a column of date strings and decides whether they are month-first or day-first
  function guessDateOrder(values) {
    let mdy = 0, dmy = 0;
    for (const v of values) {
      const m = String(v ?? '').trim().match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.]\d{2,4}/);
      if (!m) continue;
      if (+m[1] > 12 && +m[2] <= 12) dmy++;
      if (+m[2] > 12 && +m[1] <= 12) mdy++;
    }
    return dmy > mdy ? 'dmy' : 'mdy';
  }
  function parseAmount(s) {
    if (s == null) return NaN;
    let str = String(s).trim();
    if (!str) return NaN;
    let neg = false;
    if (/^\(.*\)$/.test(str)) { neg = true; str = str.slice(1, -1); }
    if (/-$/.test(str)) { neg = true; str = str.slice(0, -1); }
    if (/\bDR\b/i.test(str)) neg = true;
    str = str.replace(/(CR|DR)/gi, '').replace(/[$,\s]/g, '');
    if (str.startsWith('-')) { neg = !neg; str = str.slice(1); }
    const n = parseFloat(str);
    return isNaN(n) ? NaN : (neg ? -n : n);
  }
  function guessColumns(header) {
    const h = header.map(x => String(x).toLowerCase().trim());
    // first pattern that matches any column wins, so the most specific names go first
    const pick = (...res) => { for (const re of res) { const i = h.findIndex(x => re.test(x)); if (i >= 0) return i; } return -1; };
    const date = pick(/^(transaction |posting |posted |trans\.? )?date$/, /^date/, /date/, /posted/);
    const desc = pick(/^description$/, /description/, /^payee$/, /^(name|merchant)$/, /memo|narrative|merchant|payee/, /detail/);
    const amount = pick(/^amount$/, /^amount\b/, /amount$/, /^amt/);
    const debit = pick(/^debit$/, /debit|withdraw|money out|paid out|charge/);
    const credit = pick(/^credit$/, /credit|deposit|money in|paid in/);
    return { date, desc, amount, debit: debit === credit ? -1 : debit, credit };
  }

  // ---------- Periods ----------
  function periodRange(key, c) {
    const t = parseISO(todayISO());
    const y = t.getFullYear(), m = t.getMonth();
    const fy = c ? parseISO(fyStart(c, todayISO())) : new Date(y, 0, 1);
    const end = d => isoOf(d);
    switch (key) {
      case 'this-month': return { from: end(new Date(y, m, 1)), to: end(new Date(y, m + 1, 0)), label: 'This month' };
      case 'last-month': return { from: end(new Date(y, m - 1, 1)), to: end(new Date(y, m, 0)), label: 'Last month' };
      case 'this-quarter': { const q = Math.floor(m / 3) * 3; return { from: end(new Date(y, q, 1)), to: end(new Date(y, q + 3, 0)), label: 'This quarter' }; }
      case 'last-quarter': { const q = Math.floor(m / 3) * 3 - 3; return { from: end(new Date(y, q, 1)), to: end(new Date(y, q + 3, 0)), label: 'Last quarter' }; }
      case 'ytd': return { from: end(fy), to: todayISO(), label: 'Year to date' };
      case 'last-year': { const s = new Date(fy.getFullYear() - 1, fy.getMonth(), 1); const e = new Date(fy.getFullYear(), fy.getMonth(), 0); return { from: end(s), to: end(e), label: 'Last fiscal year' }; }
      case 'last-12': return { from: end(new Date(y, m - 11, 1)), to: todayISO(), label: 'Last 12 months' };
      default: return { from: end(new Date(y, m, 1)), to: todayISO(), label: 'This month' };
    }
  }

  // ---------- Demo data ----------
  function rng(seed) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

  function demoClients() {
    const today = todayISO();
    const t0 = parseISO(today);
    const start = isoOf(new Date(t0.getFullYear(), t0.getMonth() - 12, 1));
    const out = [];

    // --- Café ---
    {
      const r = rng(42);
      const between = (a, b) => round2(a + r() * (b - a));
      const c = newClient({ name: 'Harbor & Pine Coffee Co.', legalName: 'Harbor & Pine Coffee Co. LLC', industry: 'Café & bakery', color: '#1E6B53', startDate: start, email: 'hello@harborpine.example', phone: '(303) 555-0142', address: '214 Larimer St\nDenver, CO 80205', invoicePrefix: 'HP-', nextInvoice: 1101 });
      const A = n => acctByName(c, n).id;
      acctByName(c, 'Business Checking').opening = 18400;
      acctByName(c, 'Business Savings').opening = 25000;
      acctByName(c, 'Business Credit Card').opening = 1240;
      const add = (date, description, amount, cat, account = 'Business Checking', payee) => {
        if (date > today) return;
        c.transactions.push({ id: uid(), date, description, payee: payee || cleanPayee(description), amount: round2(amount), accountId: A(account), categoryId: cat ? A(cat) : null, memo: '', status: 'posted', cleared: false, reconciled: false });
      };
      let d = start;
      while (d <= today) {
        const dt = parseISO(d), dow = dt.getDay(), dom = dt.getDate();
        const season = 1 + 0.12 * Math.sin((dt.getMonth() - 2) / 12 * Math.PI * 2);
        if (dow === 1) add(d, 'SQUARE INC DEPOSIT ' + (100000 + Math.floor(r() * 899999)), between(5200, 6900) * season, 'Sales');
        if (dow === 1) add(d, 'SQUARE INC PROCESSING FEE', -between(140, 190), 'Bank & Merchant Fees');
        if (dom === 1) add(d, 'PINEWOOD PROPERTIES RENT ACH', -3800, 'Rent & Lease');
        if (dom === 3) add(d, 'TRANSFER TO OWNER - J COLL', -2000, "Owner's Draw");
        if (dom === 5 || dom === 19) add(d, 'ROASTWORKS COFFEE SUPPLY ACH', -between(980, 1420), 'Cost of Goods Sold');
        if (dow === 4) add(d, 'MOUNTAIN DAIRY CO INV ' + Math.floor(r() * 9000 + 1000), -between(280, 410), 'Cost of Goods Sold');
        if (dow === 5 && Math.floor(dt.getTime() / 86400000 / 7) % 2 === 0) add(d, 'GUSTO PAYROLL PPD', -between(4200, 4800), 'Payroll & Wages');
        if (dom === 12) add(d, 'XCEL ENERGY ONLINE PMT', -between(360, 520), 'Utilities');
        if (dom === 14) add(d, 'COMCAST BUSINESS 8774', -189.99, 'Phone & Internet');
        if (dom === 9) add(d, 'DENVER WATER', -between(110, 160), 'Utilities');
        if (dom === 20 && dt.getMonth() % 3 === 0) add(d, 'NEXT INSURANCE PREMIUM', -612, 'Insurance');
        if (dom === 2) add(d, 'SQUARE SOFTWARE SUBSCR', -60, 'Software & Subscriptions', 'Business Credit Card');
        if (dom === 8) add(d, 'ADOBE *CREATIVE CLD', -54.99, 'Software & Subscriptions', 'Business Credit Card');
        if (dom === 10 || dom === 24) add(d, 'COSTCO WHSE #1032', -between(180, 420), 'Cost of Goods Sold', 'Business Credit Card');
        if (dom === 15) add(d, 'FACEBK *ADS 7XQ2', -between(140, 300), 'Advertising & Marketing', 'Business Credit Card');
        if (r() < 0.07) add(d, 'AMAZON MKTPLACE PMTS', -between(25, 160), 'Office Supplies', 'Business Credit Card');
        if (r() < 0.03) add(d, 'ACE HARDWARE 0441', -between(20, 140), 'Repairs & Maintenance', 'Business Credit Card');
        if (dom === 26) {
          // pay the card in full: sum the card's charges for the month so far
          const mk = monthKey(d);
          const spend = -c.transactions.filter(t => t.accountId === A('Business Credit Card') && monthKey(t.date) === mk && t.amount < 0).reduce((s, t) => s + t.amount, 0);
          add(d, 'PAYMENT TO CREDIT CARD ****4411', -round2(spend), 'Business Credit Card', 'Business Checking', 'Credit card payment');
        }
        d = addDays(d, 1);
      }
      // last 3 weeks waiting for review; older than 2 months reconciled
      const reviewFrom = addDays(today, -20), reconTo = isoOf(new Date(t0.getFullYear(), t0.getMonth() - 1, 0));
      for (const t of c.transactions) {
        if (t.date >= reviewFrom && !/PAYMENT/.test(t.description)) { t.status = 'review'; t.categoryId = null; }
        if (t.date <= reconTo) { t.cleared = true; t.reconciled = true; }
      }
      const rule = (text, cat, payee) => c.rules.push({ id: uid(), text, categoryId: A(cat), payee, direction: 'any' });
      rule('square inc deposit', 'Sales', 'Square Deposit');
      rule('gusto', 'Payroll & Wages', 'Gusto Payroll');
      rule('pinewood properties', 'Rent & Lease', 'Pinewood Properties');
      rule('roastworks', 'Cost of Goods Sold', 'Roastworks Coffee Supply');
      c.reconciliations.push({ id: uid(), accountId: A('Business Checking'), date: reconTo, ending: round2(balances(c, { to: reconTo }).get(A('Business Checking'))), completedOn: addDays(reconTo, 6) });
      c.contacts.push(
        { id: uid(), kind: 'vendor', name: 'Roastworks Coffee Supply', email: 'orders@roastworks.example', phone: '', address: '', notes: 'Net 15. Ask for Dana.' },
        { id: uid(), kind: 'vendor', name: 'Mountain Dairy Co', email: '', phone: '(720) 555-0199', address: '', notes: '' },
        { id: uid(), kind: 'vendor', name: 'Pinewood Properties', email: 'leasing@pinewood.example', phone: '', address: '', notes: 'Lease renews in March.' },
        { id: uid(), kind: 'customer', name: 'Larimer Tech Collective', email: 'ops@larimertech.example', phone: '', address: '1600 Wynkoop St\nDenver, CO 80202', notes: 'Monthly catering' }
      );
      // a couple of catering invoices
      const cust = c.contacts.find(x => x.kind === 'customer');
      for (let i = 4; i >= 0; i--) {
        const date = isoOf(new Date(t0.getFullYear(), t0.getMonth() - i, 6));
        if (date > today) continue;
        const inv = { id: uid(), number: c.invoicePrefix + (c.nextInvoice++), contactId: cust.id, date, dueDate: addDays(date, 15), status: 'sent', taxRate: 0, discount: 0, notes: 'Thank you for choosing Harbor & Pine!', lines: [{ id: uid(), desc: 'Monthly team catering — coffee service & pastries', qty: 4, rate: between(260, 340), accountId: A('Sales') }] };
        c.invoices.push(inv);
        if (i >= 1) {
          const pd = addDays(date, 9 + Math.floor(r() * 5));
          c.transactions.push({ id: uid(), date: pd, description: 'MOBILE DEPOSIT - LARIMER TECH', payee: cust.name, amount: invoiceTotals(inv).total, accountId: A('Business Checking'), categoryId: acctByKey(c, 'ar').id, invoiceId: inv.id, memo: 'Payment for ' + inv.number, status: 'posted', cleared: pd <= reconTo, reconciled: pd <= reconTo });
        }
      }
      // a few bills waiting to be paid
      const roast = c.contacts.find(x => x.name === 'Roastworks Coffee Supply');
      const plumb = { id: uid(), kind: 'vendor', name: 'Mile High Plumbing', email: 'billing@milehighplumbing.example', phone: '', address: '', notes: 'Fixed the dish sink', is1099: true };
      c.contacts.push(plumb);
      c.bills.push(
        { id: uid(), vendorId: roast.id, ref: 'RW-20418', date: addDays(today, -9), dueDate: addDays(today, 6), status: 'open', memo: 'Espresso beans, house blend', lines: [{ id: uid(), desc: 'Espresso beans — 60 lb', accountId: A('Cost of Goods Sold'), amount: 1180 }] },
        { id: uid(), vendorId: plumb.id, ref: '3391', date: addDays(today, -34), dueDate: addDays(today, -4), status: 'open', memo: '', lines: [{ id: uid(), desc: 'Dish sink repair', accountId: A('Repairs & Maintenance'), amount: 340 }] }
      );
      c.transactions.sort((a, b) => a.date.localeCompare(b.date));
      out.push(c);
    }

    // --- Landscaping ---
    {
      const r = rng(7);
      const between = (a, b) => round2(a + r() * (b - a));
      const c = newClient({ name: 'Summit Ridge Landscaping', legalName: 'Summit Ridge Landscaping Inc.', industry: 'Landscaping & snow removal', color: '#B8893B', startDate: start, email: 'office@summitridge.example', phone: '(720) 555-0177', address: '9810 E Iliff Ave\nAurora, CO 80014', invoicePrefix: 'SR-', nextInvoice: 2201 });
      const A = n => acctByName(c, n).id;
      acctByName(c, 'Business Checking').opening = 31200;
      acctByName(c, 'Equipment & Vehicles').opening = 64000;
      acctByName(c, 'Loans Payable').opening = 38500;
      const add = (date, description, amount, cat, account = 'Business Checking') => {
        if (date > today) return;
        c.transactions.push({ id: uid(), date, description, payee: cleanPayee(description), amount: round2(amount), accountId: A(account), categoryId: cat ? A(cat) : null, memo: '', status: 'posted', cleared: false, reconciled: false });
      };
      const customers = [
        ['Aspen Grove HOA', 'board@aspengrove.example', 3600],
        ['Cherry Creek Dental', 'office@ccdental.example', 1250],
        ['Highline Office Park', 'facilities@highline.example', 4200],
        ['Willow Bend Apartments', 'manager@willowbend.example', 2900],
        ['Morales Residence', 'amorales@mail.example', 640],
        ['Parkview Townhomes', 'hoa@parkview.example', 2300]
      ].map(([name, email, base]) => ({ id: uid(), kind: 'customer', name, email, phone: '', address: '', notes: '', base }));
      customers.forEach(cu => c.contacts.push({ id: cu.id, kind: cu.kind, name: cu.name, email: cu.email, phone: '', address: 'Aurora, CO', notes: '' }));
      c.contacts.push({ id: uid(), kind: 'vendor', name: 'Front Range Nursery', email: 'sales@frnursery.example', phone: '', address: '', notes: 'Contractor pricing on account' });

      let d = start;
      while (d <= today) {
        const dt = parseISO(d), dow = dt.getDay(), dom = dt.getDate(), mo = dt.getMonth();
        const summer = mo >= 3 && mo <= 9;
        if (dow === 5 && Math.floor(dt.getTime() / 86400000 / 7) % 2 === 1) add(d, 'ADP PAYROLL SERVICES', -between(summer ? 2800 : 1300, summer ? 3400 : 1700), 'Payroll & Wages');
        if (dow === 2) add(d, 'SHELL OIL 57442' + Math.floor(r() * 9), -between(150, summer ? 290 : 190), 'Car & Truck', 'Business Credit Card');
        if (summer && (dom === 4 || dom === 18)) add(d, 'FRONT RANGE NURSERY', -between(600, 1800), 'Cost of Goods Sold');
        if (r() < (summer ? 0.08 : 0.03)) add(d, 'THE HOME DEPOT #1508', -between(40, 380), 'Repairs & Maintenance', 'Business Credit Card');
        if (dom === 7) add(d, 'VERIZON WIRELESS', -212.4, 'Phone & Internet', 'Business Credit Card');
        if (dom === 15) add(d, 'EQUIPMENT LOAN PMT - FIRSTBANK', -1150, 'Loans Payable');
        if (dom === 21) add(d, 'HISCOX INSURANCE', -486, 'Insurance');
        if (dom === 3) add(d, 'JOBBER SOFTWARE', -129, 'Software & Subscriptions', 'Business Credit Card');
        if (dom === 25) add(d, 'GOOGLE *ADS', -between(120, summer ? 420 : 160), 'Advertising & Marketing', 'Business Credit Card');
        if (dom === 27) {
          const mk = monthKey(d);
          const spend = -c.transactions.filter(t => t.accountId === A('Business Credit Card') && monthKey(t.date) === mk && t.amount < 0).reduce((s, t) => s + t.amount, 0);
          add(d, 'CAPITAL ONE CARD PAYMENT', -round2(spend), 'Business Credit Card');
        }
        if (dom === 1) {
          // monthly invoices
          for (const cu of customers) {
            const amt = round2(cu.base * (summer ? 1 : 0.55) * (0.92 + r() * 0.16));
            const inv = { id: uid(), number: c.invoicePrefix + (c.nextInvoice++), contactId: cu.id, date: d, dueDate: addDays(d, 30), status: 'sent', taxRate: 0, discount: 0, notes: 'Thank you for your business! Payment due within 30 days.',
              lines: summer ? [
                { id: uid(), desc: 'Weekly mowing, edging & cleanup', qty: 4, rate: round2(amt * 0.7 / 4), accountId: A('Service Revenue') },
                { id: uid(), desc: 'Irrigation check & adjustments', qty: 1, rate: round2(amt * 0.3), accountId: A('Service Revenue') }
              ] : [
                { id: uid(), desc: 'Snow removal — seasonal contract (monthly)', qty: 1, rate: amt, accountId: A('Service Revenue') }
              ] };
            c.invoices.push(inv);
            const age = daysBetween(d, today);
            const willPay = age > 45 ? r() < 0.93 : age > 18 ? r() < 0.6 : false;
            if (willPay) {
              const pd = addDays(d, 12 + Math.floor(r() * 22));
              if (pd <= today) c.transactions.push({ id: uid(), date: pd, description: 'MOBILE DEPOSIT ' + cu.name.toUpperCase(), payee: cu.name, amount: invoiceTotals(inv).total, accountId: A('Business Checking'), categoryId: acctByKey(c, 'ar').id, invoiceId: inv.id, memo: 'Payment for ' + inv.number, status: 'posted', cleared: false, reconciled: false });
            }
          }
        }
        d = addDays(d, 1);
      }
      // one draft for next month
      c.invoices.push({ id: uid(), number: c.invoicePrefix + (c.nextInvoice++), contactId: customers[4].id, date: today, dueDate: addDays(today, 30), status: 'draft', taxRate: 0, discount: 0, notes: '', lines: [{ id: uid(), desc: 'Fall aeration & overseeding', qty: 1, rate: 425, accountId: A('Service Revenue') }, { id: uid(), desc: 'Leaf removal (2 visits)', qty: 2, rate: 180, accountId: A('Service Revenue') }] });
      const reviewFrom = addDays(today, -9), reconTo = isoOf(new Date(t0.getFullYear(), t0.getMonth() - 1, 0));
      for (const t of c.transactions) {
        if (t.date >= reviewFrom && !t.invoiceId && !/PAYMENT/.test(t.description)) { t.status = 'review'; t.categoryId = null; }
        if (t.date <= reconTo) { t.cleared = true; t.reconciled = true; }
      }
      c.reconciliations.push({ id: uid(), accountId: A('Business Checking'), date: reconTo, ending: round2(balances(c, { to: reconTo }).get(A('Business Checking'))), completedOn: addDays(reconTo, 5) });
      c.rules.push({ id: uid(), text: 'adp payroll', categoryId: A('Payroll & Wages'), payee: 'ADP Payroll', direction: 'any' });
      c.rules.push({ id: uid(), text: 'shell oil', categoryId: A('Car & Truck'), payee: 'Shell', direction: 'any' });
      c.transactions.sort((a, b) => a.date.localeCompare(b.date));
      out.push(c);
    }
    return out;
  }

  return {
    uid, round2, todayISO, addDays, daysBetween, parseISO, isoOf, monthKey, TYPES, SUBTYPES, SUB_LABEL, CLIENT_COLORS,
    isDebitNormal, isMoneyAccount, newData, newClient, acct, acctByKey, acctByName, contact, findAccount, ensureAccount, normName, isLocked, guessDateOrder,
    postings, balances, profitLoss, balanceSheet, fyStart,
    invoiceTotals, invoicePaid, invoiceState, suggest, ruleFor, cleanPayee, keyOf,
    ensureAP, billTotal, billPaid, billState, nextDate, trialBalance, contractorPayments, threshold1099, salesTax,
    parseCSV, toCSV, parseDate, parseAmount, guessColumns, periodRange, demoClients
  };
})();
if (typeof module !== 'undefined') module.exports = Core;
