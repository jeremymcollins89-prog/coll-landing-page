'use strict';
/* =====================================================================
   Coll Ledger — file imports
   Reads CSV and Excel (.xlsx) files with no outside libraries, recognizes
   what kind of file it is (bank statement, Square sales, Square customers,
   QuickBooks chart of accounts / customers / vendors / transactions) and
   turns it into records the app can preview and import.
   ===================================================================== */
const Imports = (() => {
  const C = (typeof Core !== 'undefined') ? Core : require('./core.js');

  // ---------------------------------------------------------------
  // Excel (.xlsx) reader — an .xlsx file is a zip of XML documents
  // ---------------------------------------------------------------
  async function inflateRaw(bytes) {
    const ds = new DecompressionStream('deflate-raw');
    const out = new Blob([bytes]).stream().pipeThrough(ds);
    return new Uint8Array(await new Response(out).arrayBuffer());
  }
  async function unzip(buf) {
    const u8 = new Uint8Array(buf);
    const dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
    let eocd = -1;
    for (let i = u8.length - 22; i >= Math.max(0, u8.length - 70000); i--) {
      if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
    }
    if (eocd < 0) throw new Error('This file is not a valid Excel workbook.');
    const count = dv.getUint16(eocd + 10, true);
    let p = dv.getUint32(eocd + 16, true);
    const files = {};
    const dec = new TextDecoder();
    for (let n = 0; n < count; n++) {
      if (dv.getUint32(p, true) !== 0x02014b50) break;
      const method = dv.getUint16(p + 10, true);
      const csize = dv.getUint32(p + 20, true);
      const nlen = dv.getUint16(p + 28, true), elen = dv.getUint16(p + 30, true), clen = dv.getUint16(p + 32, true);
      const off = dv.getUint32(p + 42, true);
      const name = dec.decode(u8.subarray(p + 46, p + 46 + nlen));
      files[name] = async () => {
        const ln = dv.getUint16(off + 26, true), le = dv.getUint16(off + 28, true);
        const start = off + 30 + ln + le;
        const data = u8.subarray(start, start + csize);
        const raw = method === 0 ? data : await inflateRaw(data);
        return dec.decode(raw);
      };
      p += 46 + nlen + elen + clen;
    }
    return files;
  }
  const colIndex = ref => { let n = 0; for (const ch of ref.replace(/\d+/g, '')) n = n * 26 + (ch.charCodeAt(0) - 64); return n - 1; };
  const xmlDoc = s => new DOMParser().parseFromString(s, 'application/xml');
  const byTag = (el, tag) => [...el.getElementsByTagName(tag)];

  async function readXlsx(buf) {
    const z = await unzip(buf);
    const read = async n => (z[n] ? z[n]() : null);
    // shared strings
    const strings = [];
    const ss = await read('xl/sharedStrings.xml');
    if (ss) for (const si of byTag(xmlDoc(ss), 'si')) strings.push(byTag(si, 't').map(t => t.textContent).join(''));
    // date-formatted styles, so date cells come back as dates instead of serial numbers
    const dateStyles = new Set();
    const st = await read('xl/styles.xml');
    if (st) {
      const d = xmlDoc(st);
      const custom = {};
      for (const nf of byTag(d, 'numFmt')) custom[nf.getAttribute('numFmtId')] = nf.getAttribute('formatCode') || '';
      const xfsParent = byTag(d, 'cellXfs')[0];
      if (xfsParent) byTag(xfsParent, 'xf').forEach((xf, i) => {
        const id = +xf.getAttribute('numFmtId');
        const code = custom[id] || '';
        if ((id >= 14 && id <= 22) || (id >= 45 && id <= 47) || /(^|[^\\"])[dy]{1,4}/i.test(code.replace(/\[[^\]]*\]/g, '')) && !/^[#0.,%$ ]+$/.test(code)) dateStyles.add(i);
      });
    }
    // first visible sheet
    let sheetPath = 'xl/worksheets/sheet1.xml';
    const wb = await read('xl/workbook.xml'), rels = await read('xl/_rels/workbook.xml.rels');
    if (wb && rels) {
      const first = byTag(xmlDoc(wb), 'sheet').find(s => s.getAttribute('state') !== 'hidden');
      const rid = first && (first.getAttribute('r:id') || first.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'id'));
      const rel = rid && byTag(xmlDoc(rels), 'Relationship').find(r => r.getAttribute('Id') === rid);
      if (rel) { const t = rel.getAttribute('Target').replace(/^\//, ''); sheetPath = t.startsWith('xl/') ? t : 'xl/' + t; }
    }
    const sheet = await read(sheetPath);
    if (!sheet) throw new Error('No worksheet was found in this workbook.');
    const rows = [];
    for (const r of byTag(xmlDoc(sheet), 'row')) {
      const ri = (+r.getAttribute('r') || rows.length + 1) - 1;
      const row = [];
      for (const c of byTag(r, 'c')) {
        const ref = c.getAttribute('r');
        const ci = ref ? colIndex(ref) : row.length;
        const t = c.getAttribute('t');
        const v = byTag(c, 'v')[0];
        let val = '';
        if (t === 's') val = strings[+(v && v.textContent)] ?? '';
        else if (t === 'inlineStr') val = byTag(c, 't').map(x => x.textContent).join('');
        else if (t === 'b') val = v && v.textContent === '1' ? 'TRUE' : 'FALSE';
        else if (v) {
          val = v.textContent;
          const s = +c.getAttribute('s');
          if (dateStyles.has(s) && /^\d+(\.\d+)?$/.test(val)) val = serialToISO(+val);
        }
        row[ci] = val;
      }
      for (let i = 0; i < row.length; i++) if (row[i] == null) row[i] = '';
      rows[ri] = row;
    }
    return rows.filter(r => r && r.some(v => String(v).trim() !== ''));
  }
  function serialToISO(n) {
    const d = new Date(Math.round((n - 25569) * 86400000));
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
  }

  // Reads any supported file into rows. `file` is { name, text?, buffer? }.
  async function readRows(file) {
    const name = (file.name || '').toLowerCase();
    if (name.endsWith('.xls')) throw new Error('This is an older Excel file (.xls). Open it in Excel and choose File → Save As → Excel Workbook (.xlsx) or CSV, then import that.');
    if (name.endsWith('.xlsx')) {
      if (!file.buffer) throw new Error('Could not read this Excel file.');
      return readXlsx(file.buffer);
    }
    if (name.endsWith('.iif')) return (file.text || '').split(/\r?\n/).filter(l => l.trim()).map(l => l.split('\t'));
    const text = file.text != null ? file.text : new TextDecoder().decode(file.buffer);
    // tab-separated files saved with a .csv or .txt name
    const firstLine = text.split(/\r?\n/, 1)[0] || '';
    if (firstLine.includes('\t') && !firstLine.includes(',')) return text.split(/\r?\n/).filter(l => l.trim()).map(l => l.split('\t'));
    return C.parseCSV(text);
  }

  // ---------------------------------------------------------------
  // Recognizing what a file is
  // ---------------------------------------------------------------
  const low = s => String(s ?? '').toLowerCase().replace(/\s+/g, ' ').trim();
  function headerRow(rows, test, scan = 15) {
    for (let i = 0; i < Math.min(scan, rows.length); i++) {
      const h = rows[i].map(low);
      if (test(h)) return i;
    }
    return -1;
  }
  const has = (h, ...words) => words.every(w => h.some(x => x === w || x.includes(w)));

  const KINDS = {
    'square-sales': { title: 'Square sales', icon: 'square' },
    'square-customers': { title: 'Square customers', icon: 'people' },
    'qb-accounts': { title: 'QuickBooks chart of accounts', icon: 'qb' },
    'qb-customers': { title: 'QuickBooks customers', icon: 'people' },
    'qb-vendors': { title: 'QuickBooks vendors', icon: 'people' },
    'qb-transactions': { title: 'QuickBooks transactions', icon: 'qb' },
    'qb-iif': { title: 'QuickBooks Desktop list (IIF)', icon: 'qb' },
    'contacts': { title: 'Contact list', icon: 'people' },
    'bank': { title: 'Bank or card statement', icon: 'bank' }
  };

  function detect(rows) {
    if (!rows.length) return { kind: null };
    if (rows.some(r => /^!(ACCNT|CUST|VEND)$/i.test(String(r[0]).trim()))) return { kind: 'qb-iif', at: 0 };
    const tests = [
      ['square-sales', h => has(h, 'gross sales') && (has(h, 'net total') || has(h, 'total collected'))],
      ['square-customers', h => has(h, 'first name') && has(h, 'last name') && (has(h, 'email') || has(h, 'phone'))],
      ['qb-transactions', h => h.some(x => x === 'date' || x === 'transaction date') && (has(h, 'transaction type') || h.includes('type')) && (has(h, 'split') || h.some(x => x === 'account' || x === 'account name' || x === 'account full name'))],
      ['qb-accounts', h => h.some(x => ['account', 'account name', 'full name', 'name'].includes(x)) && h.some(x => x === 'type' || x === 'account type') && !h.some(x => x === 'date')],
      ['qb-customers', h => h.some(x => ['customer', 'customer full name', 'customer name', 'display name'].includes(x)) && !h.some(x => x === 'date')],
      ['qb-vendors', h => h.some(x => ['vendor', 'vendor name', 'supplier'].includes(x)) && !h.some(x => x === 'date')],
      ['contacts', h => h.some(x => x === 'name' || x === 'full name' || x === 'company name' || x === 'company') && h.some(x => /e-?mail|phone/.test(x)) && !h.some(x => /date|amount/.test(x))],
      ['bank', h => h.some(x => /date|posted/.test(x)) && h.some(x => /amount|debit|credit|withdraw|deposit/.test(x))]
    ];
    for (const [kind, test] of tests) {
      const i = headerRow(rows, test);
      if (i >= 0) return { kind, at: i };
    }
    return { kind: 'bank', at: 0 };
  }

  const col = (header, ...names) => {
    const h = header.map(low);
    for (const n of names) { const i = h.indexOf(n); if (i >= 0) return i; }
    for (const n of names) { const i = h.findIndex(x => x.includes(n)); if (i >= 0) return i; }
    return -1;
  };
  const cell = (r, i) => (i >= 0 ? String(r[i] ?? '').trim() : '');
  const num = (r, i) => { const v = C.parseAmount(cell(r, i)); return isNaN(v) ? 0 : v; };

  // ---------------------------------------------------------------
  // Square
  // ---------------------------------------------------------------
  // One entry per day: the day's sales land in a "Square" clearing account,
  // split into sales, tax, tips, refunds, fees and cash. The bank deposit from
  // Square then moves money from that account into checking — the way
  // bookkeepers do it, so sales are never double-counted.
  function squareSales(rows, at) {
    const h = rows[at];
    const ix = {
      date: col(h, 'date'), gross: col(h, 'gross sales'), disc: col(h, 'discounts'), svc: col(h, 'service charges'),
      net: col(h, 'net sales'), gift: col(h, 'gift card sales'), tax: col(h, 'tax'), tip: col(h, 'tip'), refunds: col(h, 'partial refunds'),
      total: col(h, 'total collected'), cash: col(h, 'cash'), fees: col(h, 'fees'), nettotal: col(h, 'net total'),
      id: col(h, 'transaction id', 'payment id'), status: col(h, 'transaction status', 'event type')
    };
    const days = new Map();
    let skipped = 0;
    for (const r of rows.slice(at + 1)) {
      const date = C.parseDate(cell(r, ix.date));
      if (!date) { skipped++; continue; }
      const status = low(cell(r, ix.status));
      if (/fail|cancel|void/.test(status)) { skipped++; continue; }
      const d = days.get(date) || { date, count: 0, gross: 0, disc: 0, svc: 0, net: 0, gift: 0, tax: 0, tip: 0, refunds: 0, total: 0, cash: 0, fees: 0, nettotal: 0 };
      d.count++;
      for (const k of ['gross', 'disc', 'svc', 'net', 'gift', 'tax', 'tip', 'refunds', 'total', 'cash', 'fees', 'nettotal']) d[k] = C.round2(d[k] + num(r, ix[k]));
      days.set(date, d);
    }
    const list = [...days.values()].sort((a, b) => a.date.localeCompare(b.date)).map(d => {
      // Fees and discounts arrive as negatives in Square's file
      const sales = C.round2((ix.net >= 0 ? d.net : d.gross + d.disc) + d.svc + d.refunds);
      const fees = -Math.abs(d.fees);
      const cash = Math.abs(d.cash);
      const nettotal = ix.nettotal >= 0 ? d.nettotal : C.round2(sales + d.tax + d.tip + d.gift + fees);
      return { ...d, sales, fees, cashOut: cash, nettotal };
    });
    return { days: list, skipped };
  }

  function squareCustomers(rows, at) {
    const h = rows[at];
    const ix = { first: col(h, 'first name'), last: col(h, 'last name'), co: col(h, 'company name', 'company'), email: col(h, 'email address', 'email'), phone: col(h, 'phone number', 'phone'), street: col(h, 'street address 1', 'address line 1', 'street address'), city: col(h, 'city', 'locality'), state: col(h, 'state', 'administrative district level 1'), zip: col(h, 'postal code', 'zip'), notes: col(h, 'memo', 'notes') };
    return rows.slice(at + 1).map(r => {
      const person = [cell(r, ix.first), cell(r, ix.last)].filter(Boolean).join(' ');
      const name = cell(r, ix.co) || person;
      const cityLine = [cell(r, ix.city), [cell(r, ix.state), cell(r, ix.zip)].filter(Boolean).join(' ')].filter(Boolean).join(', ');
      return { kind: 'customer', name, email: cell(r, ix.email), phone: cell(r, ix.phone), address: [cell(r, ix.street), cityLine].filter(Boolean).join('\n'), notes: cell(r, ix.co) && person ? 'Contact: ' + person : cell(r, ix.notes) };
    }).filter(x => x.name);
  }

  // ---------------------------------------------------------------
  // QuickBooks
  // ---------------------------------------------------------------
  // QuickBooks account types → Coll Ledger type + detail type
  function mapQbType(t) {
    const s = low(t);
    if (/^bank|checking|savings|money market|cash on hand/.test(s)) return ['asset', 'bank'];
    if (/receivable|a\/r/.test(s)) return ['asset', 'ar'];
    if (/fixed asset|property|equipment|vehicle|furniture|accumulated depreciation|machinery|building/.test(s)) return ['asset', 'fixed'];
    if (/other asset|other current asset|current asset|inventory|prepaid|undeposited|loans to|employee cash/.test(s)) return ['asset', 'current'];
    if (/credit card/.test(s)) return ['liability', 'credit'];
    if (/long.?term|loan|note payable|mortgage/.test(s)) return ['liability', 'loan'];
    if (/payable|a\/p|liabilit|payroll|sales tax|line of credit|trust/.test(s)) return ['liability', 'current'];
    if (/equity|capital|draw|retained|distribution|opening balance|partner|owner|stock/.test(s)) return ['equity', 'equity'];
    if (/cost of goods|cogs|cost of sales|supplies & materials - cogs|cost of labor/.test(s)) return ['expense', 'cogs'];
    if (/other income|other primary income|interest earned|dividend/.test(s)) return ['income', 'otherincome'];
    if (/income|revenue|sales|service|discounts\/refunds given/.test(s)) return ['income', 'income'];
    if (/other expense|other miscellaneous|depreciation|amortization|exchange/.test(s)) return ['expense', 'otherexpense'];
    if (/expense|advertising|auto|bank charge|insurance|legal|meals|office|rent|repair|supplies|travel|utilit|tax|dues|payroll expense|commission/.test(s)) return ['expense', 'expense'];
    return null;
  }
  // "6000 Advertising" / "Utilities:Gas and Electric" → { code, name }
  function splitQbName(full) {
    let s = String(full || '').trim();
    const leaf = s.split(':').pop().trim();
    let code = '';
    const m = leaf.match(/^(\d{3,6}(?:[.-]\d+)?)\s+(.*)$/);
    let name = leaf;
    if (m) { code = m[1]; name = m[2].trim(); }
    return { code, name, full: s };
  }

  function qbAccounts(rows, at) {
    const h = rows[at];
    const ix = { name: col(h, 'account', 'account name', 'full name', 'name'), type: col(h, 'type', 'account type'), detail: col(h, 'detail type'), num: col(h, 'account #', 'account number', 'number', 'acct #'), desc: col(h, 'description'), bal: col(h, 'balance', 'balance total', 'quickbooks balance') };
    const out = [];
    for (const r of rows.slice(at + 1)) {
      const raw = cell(r, ix.name);
      if (!raw || /^total\b/i.test(raw)) continue;
      const mapped = mapQbType(cell(r, ix.type) + ' ' + cell(r, ix.detail)) || mapQbType(cell(r, ix.type));
      if (!mapped) continue;
      const nm = splitQbName(raw);
      out.push({ code: cell(r, ix.num) || nm.code, name: nm.name, full: nm.full, type: mapped[0], sub: mapped[1], qbType: cell(r, ix.type), balance: ix.bal >= 0 ? num(r, ix.bal) : 0 });
    }
    return out;
  }

  function qbContacts(rows, at, kind) {
    const h = rows[at];
    const ix = {
      name: kind === 'vendor' ? col(h, 'vendor', 'vendor name', 'supplier', 'display name', 'name') : col(h, 'customer', 'customer full name', 'customer name', 'display name', 'name'),
      co: col(h, 'company name', 'company'), email: col(h, 'email', 'main email', 'e-mail'), phone: col(h, 'phone', 'main phone', 'phone numbers'),
      addr: col(h, 'billing address', 'bill to', 'address'), street: col(h, 'billing street', 'street'), city: col(h, 'billing city', 'city'), state: col(h, 'billing state', 'state'), zip: col(h, 'billing zip', 'zip', 'postal code'),
      notes: col(h, 'notes', 'note'), bal: col(h, 'open balance', 'balance', 'balance total')
    };
    return rows.slice(at + 1).map(r => {
      const name = cell(r, ix.name) || cell(r, ix.co);
      let address = cell(r, ix.addr);
      if (!address) address = [cell(r, ix.street), [cell(r, ix.city), cell(r, ix.state), cell(r, ix.zip)].filter(Boolean).join(' ')].filter(Boolean).join('\n');
      return { kind, name, email: cell(r, ix.email).split(/[;,]/)[0].trim(), phone: cell(r, ix.phone), address, notes: cell(r, ix.notes), balance: ix.bal >= 0 ? num(r, ix.bal) : 0 };
    }).filter(x => x.name && !/^total\b/i.test(x.name));
  }

  function qbIif(rows) {
    const out = { accounts: [], customers: [], vendors: [] };
    let header = null, type = null;
    for (const r of rows) {
      const first = String(r[0]).trim();
      if (first.startsWith('!')) { type = first.slice(1).toUpperCase(); header = r.map(x => String(x).trim().toUpperCase()); continue; }
      if (!header) continue;
      const get = k => { const i = header.indexOf(k); return i >= 0 ? String(r[i] ?? '').trim() : ''; };
      if (type === 'ACCNT' && first === 'ACCNT') {
        const map = { BANK: ['asset', 'bank'], AR: ['asset', 'ar'], OCASSET: ['asset', 'current'], FIXASSET: ['asset', 'fixed'], OASSET: ['asset', 'current'], AP: ['liability', 'current'], CCARD: ['liability', 'credit'], OCLIAB: ['liability', 'current'], LTLIAB: ['liability', 'loan'], EQUITY: ['equity', 'equity'], INC: ['income', 'income'], COGS: ['expense', 'cogs'], EXP: ['expense', 'expense'], EXINC: ['income', 'otherincome'], EXEXP: ['expense', 'otherexpense'] }[get('ACCNTTYPE')];
        if (map) { const nm = splitQbName(get('NAME')); out.accounts.push({ code: get('ACCNUM') || nm.code, name: nm.name, full: nm.full, type: map[0], sub: map[1], qbType: get('ACCNTTYPE'), balance: 0 }); }
      } else if (type === 'CUST' && first === 'CUST') out.customers.push({ kind: 'customer', name: get('NAME'), email: get('EMAIL'), phone: get('PHONE1'), address: ['BADDR1', 'BADDR2', 'BADDR3', 'BADDR4'].map(get).filter(Boolean).join('\n'), notes: get('NOTE') });
      else if (type === 'VEND' && first === 'VEND') out.vendors.push({ kind: 'vendor', name: get('NAME'), email: get('EMAIL'), phone: get('PHONE1'), address: ['ADDR1', 'ADDR2', 'ADDR3', 'ADDR4'].map(get).filter(Boolean).join('\n'), notes: get('NOTE') });
    }
    out.customers = out.customers.filter(x => x.name); out.vendors = out.vendors.filter(x => x.name);
    return out;
  }

  // QuickBooks "Transaction Detail by Account", "Transaction List by Date" or
  // "General Ledger" exports. Every bank or card line becomes a transaction whose
  // category is the QuickBooks "Split" account. Accounts are matched by name.
  function qbTransactions(rows, at) {
    const h = rows[at];
    const ix = {
      date: col(h, 'date', 'transaction date'), type: col(h, 'transaction type', 'type'), num: col(h, 'num', 'no.', 'ref no.'),
      name: col(h, 'name', 'payee', 'customer/vendor'), memo: col(h, 'memo/description', 'memo', 'description'),
      account: col(h, 'account', 'account full name', 'account name'), split: col(h, 'split', 'split account'),
      amount: col(h, 'amount'), debit: col(h, 'debit'), credit: col(h, 'credit')
    };
    if (ix.account === ix.split) ix.account = -1;
    const lines = [];
    let group = '';
    for (const r of rows.slice(at + 1)) {
      const date = C.parseDate(cell(r, ix.date));
      const nonEmpty = r.filter(v => String(v).trim() !== '');
      if (!date) {
        // group header rows ("Business Checking") and totals ("Total for Business Checking")
        const first = String(r.find(v => String(v).trim() !== '') || '').trim();
        if (nonEmpty.length <= 2 && first && !/^total\b/i.test(first) && !/^(beginning|opening) balance/i.test(first)) group = first.replace(/\s*\(\d+\)$/, '');
        continue;
      }
      let amt;
      if (ix.amount >= 0) amt = num(r, ix.amount);
      else amt = num(r, ix.debit) - num(r, ix.credit);
      if (!amt) continue;
      const account = ix.account >= 0 ? cell(r, ix.account) : group;
      if (/beginning balance/i.test(cell(r, ix.type))) continue;
      lines.push({ date, type: cell(r, ix.type), num: cell(r, ix.num), name: cell(r, ix.name), memo: cell(r, ix.memo), account, split: cell(r, ix.split), amount: C.round2(amt), usedDebitCredit: ix.amount < 0 });
    }
    return lines;
  }

  // Turn QuickBooks lines into Coll Ledger transactions for one client.
  // `resolve(name)` returns an account id (or null) for a QuickBooks account name.
  function buildQbTransactions(c, lines, resolve) {
    const out = [], seen = new Set();
    let unmatched = new Map(), splitCount = 0;
    for (const L of lines) {
      const accId = resolve(L.account);
      const acc = accId && C.acct(c, accId);
      if (!acc) { if (L.account) unmatched.set(L.account, (unmatched.get(L.account) || 0) + 1); continue; }
      if (!C.isMoneyAccount(acc)) continue; // only bank, card and clearing lines become transactions
      const multi = /^-?split-?$/i.test(L.split.trim());
      let catId = multi || !L.split ? null : resolve(L.split);
      if (L.split && !multi && !catId) unmatched.set(L.split, (unmatched.get(L.split) || 0) + 1);
      if (multi) splitCount++;
      // QuickBooks shows a card charge as money owed going up; in Coll Ledger money out of any account is negative
      let amount = L.amount;
      if (acc.type === 'liability') amount = -amount;
      // a transfer between two money accounts appears under both — keep it once
      const cat = catId && C.acct(c, catId);
      const key = [L.date, L.num, Math.abs(amount).toFixed(2), [accId, catId || ''].sort().join('|')].join('~');
      if (cat && C.isMoneyAccount(cat) && seen.has(key)) continue;
      seen.add(key);
      out.push({
        date: L.date, accountId: accId, categoryId: catId, amount: C.round2(amount),
        payee: L.name || C.cleanPayee(L.memo), description: [L.type, L.num ? '#' + L.num : '', L.memo].filter(Boolean).join(' · ') || L.name || 'QuickBooks entry',
        memo: multi ? 'Split across several categories in QuickBooks' : '', review: !catId
      });
    }
    return { txns: out, unmatched, splitCount };
  }

  // ---------------------------------------------------------------
  // How to get each file (shown in the app, in plain words)
  // ---------------------------------------------------------------
  const HOWTO = {
    bank: ['Sign in to the bank or card website.', 'Open the account and find Download, Export or Statements.', 'Pick the dates you need and choose CSV or Excel.', 'Drop the file here.'],
    'square-sales': ['Sign in at squareup.com and open the Square Dashboard.', 'Go to Transactions and pick the date range.', 'Click Export and choose "Transactions CSV".', 'Drop the file here — each day becomes one tidy entry.'],
    'square-customers': ['In the Square Dashboard, go to Customers → Directory.', 'Click the ⋯ menu (or Import/Export) and choose Export customers.', 'Drop the file here.'],
    'qb-accounts': ['In QuickBooks Online, open Settings ⚙ → Chart of accounts.', 'Click Run report (or open Reports → "Account List").', 'Click the export icon and choose Export to Excel.', 'Drop the file here.'],
    'qb-contacts': ['Customers: Sales (or Get paid & pay) → Customers → export icon → Export to Excel.', 'Vendors: Expenses (or Pay bills) → Vendors → export icon → Export to Excel.', 'Drop either file here.'],
    'qb-transactions': ['In QuickBooks Online, go to Reports and open "Transaction Detail by Account".', 'Set the report period (for example, This Year) and run it.', 'Click the export icon and choose Export to Excel.', 'Import the chart of accounts first so every category matches.'],
    'qb-desktop': ['QuickBooks Desktop: Reports → Accountant & Taxes → Transaction Detail by Account.', 'Click Excel → Create New Worksheet (or CSV file).', 'Lists: File → Utilities → Export → Lists to IIF Files.']
  };

  return { readRows, readXlsx, detect, KINDS, HOWTO, squareSales, squareCustomers, qbAccounts, qbContacts, qbIif, qbTransactions, buildQbTransactions, mapQbType, splitQbName, low };
})();
if (typeof module !== 'undefined') module.exports = Imports;
