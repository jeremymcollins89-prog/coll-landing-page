'use strict';
/* =====================================================================
   Coll Ledger Academy — Study center: case studies and client emails
   Four graded case studies. Each builds a pretend client with real-world
   problems and is graded on account balances, so any correct method
   earns credit. Five client-email practice scenarios with a checklist,
   simple automatic checks and a model email.
   Tax facts checked October 2026: 1099-NEC threshold $2,000 for
   payments made in 2026; employer FICA 7.65% (6.2% Social Security +
   1.45% Medicare); Colorado state sales tax 2.9%.
   ===================================================================== */
(() => {
  const { S, C, U, act, go, render, save } = App;
  const { $, esc, money, fmtDate, ICON } = U;
  const today = App.today;

  // ------------------------------------------------------------------
  // Progress: S.data.training.lab = { cases: { id: {score, passed, date} }, emails: { id: {draft, ticks, done} } }
  // ------------------------------------------------------------------
  const L = () => {
    S.data.training = S.data.training || {};
    const t = S.data.training;
    t.lab = t.lab || {}; t.lab.cases = t.lab.cases || {}; t.lab.emails = t.lab.emails || {};
    return t.lab;
  };
  const UI = () => { S.ui.lab = S.ui.lab || { tab: 'cases', open: null, email: null }; S.ui.lcGrade = S.ui.lcGrade || {}; return S.ui.lab; };

  // ------------------------------------------------------------------
  // Dates: every case lives in the months just before today
  // ------------------------------------------------------------------
  const pad = n => String(n).padStart(2, '0');
  const per = back => { const d = C.parseISO(today()); const s = new Date(d.getFullYear(), d.getMonth() - back, 1); return { from: C.isoOf(s), to: C.isoOf(new Date(s.getFullYear(), s.getMonth() + 1, 0)) }; };
  const dayOf = (M, n) => `${M.from.slice(0, 8)}${pad(Math.min(n, +M.to.slice(8)))}`;
  const mname = M => U.fmtMonth(M.from);
  const short = iso => fmtDate(iso);

  // Shared builder: a fresh case client with helpers
  function base(id, opts, M) {
    const c = C.newClient(Object.assign({ startDate: M.from }, opts));
    c.practice = true; c.caseStudy = id; c.checklistDismissed = true;
    const A = n => (C.acctByName(c, n) || {}).id;
    const ens = (name, type, sub) => C.acctByName(c, name) || C.ensureAccount(c, { name, type, sub });
    const K = {};
    const add = (key, date, desc, amt, cat, o = {}) => {
      const t = { id: C.uid(), date, description: desc, payee: o.payee || C.cleanPayee(desc), amount: C.round2(amt), accountId: A(o.account || 'Business Checking'), categoryId: cat ? A(cat) : '', memo: o.memo || '', status: o.review ? 'review' : 'posted', cleared: false, reconciled: false };
      if (o.review) { t.categoryId = ''; t.importId = 'case-' + id; }
      if (o.vendorId) t.vendorId = o.vendorId;
      c.transactions.push(t); if (key) K[key] = t.id; return t;
    };
    const vendor = (name, notes, extra) => { const v = Object.assign({ id: C.uid(), kind: 'vendor', name, email: '', phone: '', address: '', notes: notes || '', is1099: false }, extra || {}); c.contacts.push(v); return v; };
    return { c, A, ens, add, K, vendor };
  }
  const sum = arr => C.round2(arr.reduce((s, x) => s + x, 0));

  // ------------------------------------------------------------------
  // The four case studies
  // ------------------------------------------------------------------
  const CASES = [
    // ================================================================
    // 1. Catch-up cleanup
    // ================================================================
    {
      id: 'catchup', n: 1, count: 5, title: 'Catch-up cleanup', client: 'Bristlecone Lawn & Landscape', level: 'Foundations', minutes: 90, start: 'review',
      summary: 'A landscaper three months behind: Uncategorized items, a duplicate import, a personal purchase, loan payments that were never split, and a customer check counted twice.',
      months: () => [per(3), per(2), per(1)],
      period: () => ({ from: per(3).from, to: per(1).to }),
      brief: P => ({
        who: `Bristlecone Lawn & Landscape LLC is a single-member LLC in Arvada run by Luis Ortega: mowing, cleanups and small installs for homes and HOAs, with two employees in season. Luis did his own books until ${mname(P.months[0])}, then got busy.`,
        wrong: `Nobody has really looked at the books for three months (${mname(P.months[0])} through ${mname(P.months[2])}). Luis's nephew imported the bank feed and clicked "accept" on things he didn't recognize, so some items landed in Uncategorized and a few more are still waiting in To Review. Luis also thinks something "got imported twice."`,
        wants: `Luis is meeting his lender next week about financing a new mower. He wants clean books for the three months: everything categorized, the loan balance matching FirstBank's statement, and a Profit & Loss he can trust.`
      }),
      tasks: [
        'Categorize everything in To Review and everything sitting in Uncategorized Expense or Uncategorized Income, using the receipts envelope.',
        'Find the duplicate imported charge and delete the extra copy.',
        'Move the owner\'s personal purchase out of the business\'s expenses.',
        'Split each FirstBank loan payment into principal and interest using the lender statement.',
        'Apply the HOA\'s check to its open invoice so the income isn\'t counted twice.'
      ],
      rules: [
        'Uncategorized is a parking spot, not a category. A lender reading a P&L with Uncategorized lines sees books nobody finished.',
        'A duplicate import means the bank shows one charge and the books show two. Delete the copy; don\'t "fix" it by recategorizing it.',
        'Personal spending paid from the business account is an owner\'s draw. It comes out of equity, not out of profit.',
        'Only principal reduces a loan. Interest is an expense in the month it\'s charged.',
        'When an invoice was already recorded as income, the customer\'s payment just collects the receivable. Recording it as income again double-counts the sale.'
      ],
      docs: P => {
        const [m0, m1, m2] = P.months;
        return [
          ['Receipts envelope (from Luis)', [
            `${short(dayOf(m0, 21))} · Hiscox $558.00 — quarterly general liability insurance premium`,
            `${short(dayOf(m1, 7))} and ${short(dayOf(m2, 7))} · Verizon Wireless $118.00 — the business phones, every month`,
            `${short(dayOf(m2, 9))} · Front Range Nursery $1,240.00 — sod and shrubs for the Kipling St install job`,
            `${short(dayOf(m2, 12))} · Shell $92.40 — fuel for the work truck`
          ]],
          ['Text from Luis', [
            `"The $1,500 that came in on ${short(dayOf(m2, 14))} was me moving money from my personal savings so payroll wouldn't bounce. It's not a sale."`
          ]],
          ['Text from Luis, part 2', [
            `"Oh — the Best Buy charge for $899.99 on ${short(dayOf(m1, 22))} is the TV for our living room. I used the wrong card, sorry!"`
          ]],
          ['Jobber subscription', [
            'Jobber bills $129.00 once a month on the 3rd. The bank statements show one Jobber charge each month.'
          ]],
          ['FirstBank equipment loan statement', [
            'Payment $1,000.00 a month on the 15th · 6% annual interest on the balance before each payment.',
            `${mname(m0)}: interest $24,000.00 × 6% ÷ 12 = $120.00; principal $880.00; new balance $23,120.00`,
            `${mname(m1)}: interest $23,120.00 × 6% ÷ 12 = $115.60; principal $884.40; new balance $22,235.60`,
            `${mname(m2)}: interest $22,235.60 × 6% ÷ 12 = $111.18; principal $888.82; new balance $21,346.78`
          ]],
          ['Invoice BL-1042 and the HOA\'s check', [
            `Invoice BL-1042 to Ralston Creek HOA, dated ${short(dayOf(m0, 5))}: fall cleanup and aeration, $2,400.00. It was marked sent, so the $2,400 is already in Service Revenue.`,
            `The HOA paid it by check, deposited ${short(dayOf(m1, 18))} — $2,400.00, recorded as Service Revenue.`
          ]]
        ];
      },
      build() {
        const months = this.months(), period = this.period(), [m0, m1, m2] = months;
        const { c, A, add, K } = base('catchup', { name: 'Bristlecone Lawn & Landscape', legalName: 'Bristlecone Lawn & Landscape LLC', industry: 'Landscaping · case study', color: '#4F7A3A', invoicePrefix: 'BL-', nextInvoice: 1043, email: 'luis@bristlecone.example', phone: '(303) 555-0161', address: '6120 Lamar St\nArvada, CO 80003' }, period);
        c.entity = 'llc1';
        const open = { 'Business Checking': 18000, 'Equipment & Vehicles': 42000, 'Loans Payable': 24000 };
        for (const [n, v] of Object.entries(open)) C.acctByName(c, n).opening = v;
        const unc = A('Uncategorized Expense');
        const dep1 = [6850, 7420, 5980], dep2 = [4210, 3960, 4480], nurs = [1120.40, 980.15, 760], fuel = [148.22, 162.10, 139.85];
        months.forEach((M, i) => {
          add(null, dayOf(M, 10), 'MOBILE DEPOSIT - CUSTOMER CHECKS', dep1[i], 'Service Revenue', { payee: 'Customer checks' });
          add(null, dayOf(M, 24), 'MOBILE DEPOSIT - CUSTOMER CHECKS', dep2[i], 'Service Revenue', { payee: 'Customer checks' });
          add(null, dayOf(M, 5), 'FRONT RANGE NURSERY', -nurs[i], 'Cost of Goods Sold', { payee: 'Front Range Nursery' });
          add(null, dayOf(M, 8), 'SHELL OIL 57442', -fuel[i], 'Car & Truck', { payee: 'Shell' });
          add(null, dayOf(M, 15), 'GUSTO PAYROLL PPD', -3200, 'Payroll & Wages', { payee: 'Gusto Payroll' });
          add(null, dayOf(M, 28), 'GUSTO PAYROLL PPD', -3200, 'Payroll & Wages', { payee: 'Gusto Payroll' });
          add('loan' + i, dayOf(M, 15), 'FIRSTBANK EQUIPMENT LOAN PMT', -1000, 'Loans Payable', { payee: 'FirstBank' });
          add(null, dayOf(M, 3), 'JOBBER SOFTWARE', -129, 'Software & Subscriptions', { payee: 'Jobber' });
          add(null, dayOf(M, 20), 'TRANSFER TO OWNER - L ORTEGA', -2000, "Owner's Draw", { payee: 'Owner draw' });
        });
        add('dup', dayOf(m1, 3), 'JOBBER SOFTWARE', -129, 'Software & Subscriptions', { payee: 'Jobber' });
        add(null, dayOf(m0, 11), 'STAPLES 01284', -42.18, 'Office Supplies', { payee: 'Staples' });
        add('tv', dayOf(m1, 22), 'BEST BUY 00412', -899.99, 'Office Supplies', { payee: 'Best Buy' });
        add(null, dayOf(m0, 7), 'VERIZON WIRELESS', -118, 'Phone & Internet', { payee: 'Verizon Wireless' });
        const ins = add('ins', dayOf(m0, 21), 'HISCOX INSURANCE', -558, null, { payee: 'Hiscox' }); ins.categoryId = unc;
        const vz = add('vz1', dayOf(m1, 7), 'VERIZON WIRELESS', -118, null, { payee: 'Verizon Wireless' }); vz.categoryId = unc;
        add('vz2', dayOf(m2, 7), 'VERIZON WIRELESS', -118, null, { review: true, payee: 'Verizon Wireless' });
        add('nurs', dayOf(m2, 9), 'FRONT RANGE NURSERY', -1240, null, { review: true, payee: 'Front Range Nursery' });
        add('gas', dayOf(m2, 12), 'SHELL OIL 57442', -92.40, null, { review: true, payee: 'Shell' });
        add('contrib', dayOf(m2, 14), 'ONLINE TRANSFER FROM SAV ...4471', 1500, null, { review: true, payee: 'Transfer from personal savings' });
        add('hoa', dayOf(m1, 18), 'MOBILE DEPOSIT - RALSTON CREEK HOA', 2400, 'Service Revenue', { payee: 'Ralston Creek HOA' });
        const hoa = { id: C.uid(), kind: 'customer', name: 'Ralston Creek HOA', email: 'board@ralstoncreek.example', phone: '', address: 'Arvada, CO', notes: 'Pays by check' };
        c.contacts.push(hoa, { id: C.uid(), kind: 'vendor', name: 'Front Range Nursery', email: '', phone: '', address: '', notes: '' }, { id: C.uid(), kind: 'vendor', name: 'FirstBank', email: '', phone: '', address: '', notes: 'Equipment loan, 6%' });
        const inv = { id: C.uid(), number: 'BL-1042', contactId: hoa.id, date: dayOf(m0, 5), dueDate: C.addDays(dayOf(m0, 5), 30), status: 'sent', taxRate: 0, discount: 0, notes: 'Thank you!', lines: [{ id: C.uid(), desc: 'Fall cleanup and core aeration — common areas', qty: 1, rate: 2400, accountId: A('Service Revenue') }] };
        c.invoices.push(inv); K.inv = inv.id;
        c.transactions.sort((a, b) => a.date.localeCompare(b.date));
        // Interest from the lender statement, rounded to the cent each month
        let bal = 24000; const interest = [];
        for (let i = 0; i < 3; i++) { const it = C.round2(bal * 0.06 / 12); interest.push(it); bal = C.round2(bal - (1000 - it)); }
        const chk = A('Business Checking');
        const checking = C.round2(18000 + c.transactions.filter(t => t.accountId === chk && t.id !== K.dup).reduce((s, t) => s + t.amount, 0));
        c.caseKey = { ...K, period, interest, expect: {
          'Uncategorized Expense': 0, 'Uncategorized Income': 0,
          'Cost of Goods Sold': sum([...nurs, 1240]), 'Car & Truck': sum([...fuel, 92.40]), 'Insurance': 558, 'Phone & Internet': 354, "Owner's Contributions": 1500,
          'Software & Subscriptions': 387, 'Business Checking': checking,
          "Owner's Draw": -6899.99, 'Office Supplies': 42.18,
          'Loans Payable': bal, 'Interest Expense': sum(interest),
          'Accounts Receivable': 0, 'Service Revenue': sum([...dep1, ...dep2, 2400])
        } };
        return c;
      },
      checks: ({ k, is, now }) => [
        ['Uncategorized cleared and every item in its right account', 25, ['Uncategorized Expense', 'Uncategorized Income', 'Cost of Goods Sold', 'Car & Truck', 'Insurance', 'Phone & Internet', "Owner's Contributions"].every(is),
          `Uncategorized Expense and Uncategorized Income should both be $0.00. Using the receipts envelope: Hiscox $558.00 → Insurance; both Verizon $118.00 charges → Phone & Internet (3 × $118 = $354 for the three months); Front Range Nursery $1,240.00 → Cost of Goods Sold (materials for a job); Shell $92.40 → Car & Truck. The $1,500.00 transfer from Luis's savings → Owner's Contributions — money the owner puts in is equity, not income. Now: ${now('Uncategorized Expense')}; ${now('Uncategorized Income')}; ${now('Insurance')}; ${now("Owner's Contributions")}.`],
        ['Duplicate Jobber charge deleted', 15, is('Software & Subscriptions') && is('Business Checking'),
          `Jobber was imported twice on the 3rd of the second month — two $129.00 charges, but the bank shows one. Delete the extra copy (don't recategorize it, or checking stays $129.00 too low). Software & Subscriptions should be 3 × $129 = $387. Now: ${now('Software & Subscriptions')}; ${now('Business Checking')}.`],
        ['Personal TV moved to Owner\'s Draw', 15, is("Owner's Draw") && is('Office Supplies'),
          `The $899.99 Best Buy charge is Luis's living-room TV, not office supplies. Recategorize it to Owner's Draw. Personal spending paid by the business is a draw: it lowers equity, not profit, and it isn't deductible. Owner's Draw should be $6,000 of regular draws + $899.99 = $6,899.99. Now: ${now("Owner's Draw")}; ${now('Office Supplies')}.`],
        ['Loan payments split into principal and interest', 25, is('Loans Payable') && is('Interest Expense'),
          `Each $1,000.00 FirstBank payment was coded entirely to Loans Payable, so the interest was taken off the loan too — the books show $346.78 less debt than FirstBank does, and the P&L is missing that interest. Split each payment using the lender statement: month 1 $880.00 Loans Payable + $120.00 Interest Expense; month 2 $884.40 + $115.60; month 3 $888.82 + $111.18. Only principal reduces the loan. Loans Payable should match FirstBank's balance of ${money(k.expect['Loans Payable'])}, and Interest Expense should be $120.00 + $115.60 + $111.18 = $346.78. Now: ${now('Loans Payable')}; ${now('Interest Expense')}.`],
        ['HOA check applied to invoice BL-1042', 20, is('Accounts Receivable') && is('Service Revenue'),
          `Invoice BL-1042 already put the $2,400.00 into Service Revenue and Accounts Receivable. The HOA's $2,400.00 deposit was then recorded as Service Revenue again — the sale counted twice. Open the deposit and apply it to BL-1042 (or recategorize it to Accounts Receivable). Accounts Receivable should be $0.00 and the invoice should show Paid. Now: ${now('Accounts Receivable')}; ${now('Service Revenue')}.`]
      ],
      coach: 'Clear To Review and Uncategorized, delete the duplicate Jobber charge, move the TV to Owner\'s Draw, split the three loan payments, and apply the HOA check to BL-1042.'
    },

    // ================================================================
    // 2. Café with tips and sales tax
    // ================================================================
    {
      id: 'cafe', n: 2, count: 5, title: 'Café with tips and sales tax', client: 'Columbine Corner Café', level: 'Intermediate', minutes: 75, start: 'transactions',
      summary: 'Card deposits that mix sales, sales tax and staff tips; tips paid out through payroll; last month\'s sales tax payment booked as an expense; and fees left in To Review.',
      period: () => per(1),
      brief: M => ({
        who: `Columbine Corner Café LLC is a 30-seat breakfast-and-lunch café in Littleton owned by Grace Kim, with seven hourly staff. Customers pay mostly by card; the card processor deposits each week's batch into checking.`,
        wrong: `For ${mname(M)}, every card deposit was recorded as Sales — including the sales tax the café collected for the state and the tips customers added for the staff. Both payroll runs went entirely to Payroll & Wages, even though they paid out those tips and included employer taxes. Last month's sales tax payment was booked as an expense, and two fees are still waiting in To Review.`,
        wants: `Grace's Sales line looks about 20% higher than her register reports and she's worried she'll pay income tax on money that was never hers. She wants ${mname(M)} to match the processor reports, the sales tax liability to match what she'll file on the 20th, and the tips accounted for.`
      }),
      tasks: [
        'Split each card deposit (or post one journal entry) so Sales holds only sales, sales tax goes to Sales Tax Payable, and tips go to Tips Payable.',
        'Recategorize last month\'s sales tax payment so it clears the liability instead of being an expense.',
        'Split both payroll runs into wages, tips paid out and employer taxes, using the payroll reports.',
        'Categorize the processor\'s monthly fees and the bank service charge.'
      ],
      rules: [
        'Sales tax collected belongs to the state. It\'s a liability (Sales Tax Payable) from the moment it\'s collected — never income.',
        'Paying the state clears that liability. It isn\'t a new expense; booking it as Taxes & Licenses counts the cost of something that was never income.',
        'Voluntary card tips belong to the staff. Hold them in a liability (Tips Payable) until they\'re paid out.',
        'Tips paid through payroll are taxable wages: income tax and FICA are withheld, and the employer pays its 7.65% share of FICA on them too.',
        'Colorado\'s state sales tax is 2.9%; county, city and special-district taxes are added on top, so the combined rate depends on the location.'
      ],
      docs: M => [
        ['Card processor — weekly deposit report', [
          'This case\'s combined sales tax rate is 8% (Colorado\'s 2.9% state rate plus local taxes).',
          `Week 1 (${short(dayOf(M, 7))}): sales $5,000.00 · sales tax $400.00 · tips $620.00 · deposit $6,020.00`,
          `Week 2 (${short(dayOf(M, 14))}): sales $4,500.00 · sales tax $360.00 · tips $540.00 · deposit $5,400.00`,
          `Week 3 (${short(dayOf(M, 21))}): sales $5,250.00 · sales tax $420.00 · tips $655.00 · deposit $6,325.00`,
          `Week 4 (${short(dayOf(M, 28))}): sales $4,750.00 · sales tax $380.00 · tips $585.00 · deposit $5,715.00`,
          'Month: sales $19,500.00 · tax $1,560.00 · tips $2,400.00. Check: $19,500 + $1,560 + $2,400 = $23,460.'
        ]],
        ['Colorado sales tax return (last month)', [
          `Paid ${short(dayOf(M, 20))}: $1,410.00 — the tax collected last month, already on the books as Sales Tax Payable at the start of ${mname(M)}. It was recorded as Taxes & Licenses.`
        ]],
        ['Payroll report — run 1', [
          `Paid ${short(dayOf(M, 15))}. Hourly wages $3,000.00 · card tips paid out $1,160.00 (weeks 1 and 2: $620 + $540 = $1,160).`,
          'Employer taxes (Social Security and Medicare): $4,160 × 7.65% = $318.24.',
          'Total pulled from checking: $3,000 + $1,160 + $318.24 = $4,478.24. Employee withholding is inside the $4,160 gross.'
        ]],
        ['Payroll report — run 2', [
          `Paid ${short(dayOf(M, 30))}. Hourly wages $3,000.00 · card tips paid out $1,240.00 (weeks 3 and 4: $655 + $585 = $1,240).`,
          'Employer taxes: $4,240 × 7.65% = $324.36.',
          'Total pulled from checking: $3,000 + $1,240 + $324.36 = $4,564.36.'
        ]],
        ['Fees', [
          `Card processor monthly statement fees, ${short(dayOf(M, 29))}: $612.40.`,
          `Bank monthly service charge, ${short(dayOf(M, 30))}: $35.00.`
        ]]
      ],
      build() {
        const M = this.period();
        const { c, A, ens, add, K } = base('cafe', { name: 'Columbine Corner Café', legalName: 'Columbine Corner Café LLC', industry: 'Café · case study', color: '#C0603A', invoicePrefix: 'CC-', email: 'grace@columbinecorner.example', phone: '(303) 555-0119', address: '2590 W Main St\nLittleton, CO 80120' }, M);
        c.entity = 'llc1';
        ens('Tips Payable', 'liability', 'current');
        C.acctByName(c, 'Business Checking').opening = 14000;
        C.acctByName(c, 'Sales Tax Payable').opening = 1410;
        const deps = [[7, 6020], [14, 5400], [21, 6325], [28, 5715]];
        deps.forEach(([d, v], i) => add('dep' + (i + 1), dayOf(M, d), 'FRONT RANGE PAYMENTS DEPOSIT', v, 'Sales', { payee: 'Card processor deposit' }));
        add(null, dayOf(M, 1), 'BELLEVIEW PROPERTIES RENT', -3400, 'Rent & Lease', { payee: 'Belleview Properties' });
        add(null, dayOf(M, 3), 'SYSCO DENVER', -2860.45, 'Cost of Goods Sold', { payee: 'Sysco' });
        add(null, dayOf(M, 17), 'SYSCO DENVER', -3012.80, 'Cost of Goods Sold', { payee: 'Sysco' });
        add(null, dayOf(M, 12), 'XCEL ENERGY ONLINE PMT', -486.12, 'Utilities', { payee: 'Xcel Energy' });
        add(null, dayOf(M, 25), 'TRANSFER TO OWNER - G KIM', -2500, "Owner's Draw", { payee: 'Owner draw' });
        add('stax', dayOf(M, 20), 'COLORADO DEPT OF REVENUE', -1410, 'Taxes & Licenses', { payee: 'Colorado Dept of Revenue' });
        add('pay1', dayOf(M, 15), 'GUSTO PAYROLL PPD', -4478.24, 'Payroll & Wages', { payee: 'Gusto Payroll' });
        add('pay2', dayOf(M, 30), 'GUSTO PAYROLL PPD', -4564.36, 'Payroll & Wages', { payee: 'Gusto Payroll' });
        add('fee1', dayOf(M, 29), 'FRONT RANGE PAYMENTS MONTHLY FEES', -612.40, null, { review: true, payee: 'Card processor fees' });
        add('fee2', dayOf(M, 30), 'MONTHLY SERVICE CHARGE', -35, null, { review: true, payee: 'Bank service charge' });
        c.transactions.sort((a, b) => a.date.localeCompare(b.date));
        c.caseKey = { ...K, period: M, expect: {
          'Sales': 19500, 'Sales Tax Payable': 1560, 'Taxes & Licenses': 0,
          'Tips Payable': 0, 'Payroll & Wages': 6000, 'Payroll Taxes': 642.6,
          'Bank & Merchant Fees': 647.4, 'Uncategorized Expense': 0
        } };
        return c;
      },
      checks: ({ is, now }) => [
        ['Sales show only sales ($19,500.00)', 25, is('Sales'),
          `The four deposits total $23,460.00, but only $19,500.00 is the café's sales. Split each deposit the way the processor report reads — week 1: $5,000.00 Sales, $400.00 Sales Tax Payable, $620.00 Tips Payable, and so on — or post one journal entry dated the last day of the month: debit Sales $3,960.00, credit Sales Tax Payable $1,560.00, credit Tips Payable $2,400.00 ($1,560 + $2,400 = $3,960). Now: ${now('Sales')}.`],
        ['Sales tax collected is a liability ($1,560.00 owed)', 25, is('Sales Tax Payable'),
          `Sales tax collected belongs to the state, so it goes to Sales Tax Payable: $19,500 × 8% = $1,560. The balance should end at last month's $1,410 + this month's $1,560 collected − the $1,410 paid = $1,560 — exactly what Grace will file on the 20th of next month. That needs both the deposit splits and the payment fix below. Now: ${now('Sales Tax Payable')}.`],
        ['Last month\'s sales tax payment cleared the liability', 15, is('Taxes & Licenses'),
          `The $1,410.00 Colorado Dept of Revenue payment paid over tax the café collected last month. Recategorize it from Taxes & Licenses to Sales Tax Payable: paying collected tax clears a liability; it's not an expense. Now: ${now('Taxes & Licenses')}.`],
        ['Tips held for staff and paid out through payroll', 25, is('Tips Payable') && is('Payroll & Wages') && is('Payroll Taxes'),
          `Tips go into Tips Payable when the deposits are split, and come out when payroll pays them. Split payroll run 1 ($4,478.24): $3,000.00 Payroll & Wages, $1,160.00 Tips Payable, $318.24 Payroll Taxes. Split run 2 ($4,564.36): $3,000.00 Payroll & Wages, $1,240.00 Tips Payable, $324.36 Payroll Taxes. Tips Payable then ends at $0.00, wages at $6,000.00 and employer taxes at $318.24 + $324.36 = $642.60 — the employer's 7.65% FICA applies to tips too ($8,400 × 7.65% = $642.60). Now: ${now('Tips Payable')}; ${now('Payroll & Wages')}; ${now('Payroll Taxes')}.`],
        ['Processor and bank fees categorized', 10, is('Bank & Merchant Fees') && is('Uncategorized Expense'),
          `Categorize the $612.40 processor fees and the $35.00 service charge to Bank & Merchant Fees ($612.40 + $35 = $647.40). Now: ${now('Bank & Merchant Fees')}; ${now('Uncategorized Expense')}.`]
      ],
      coach: 'Split the card deposits into sales, sales tax and tips, fix the sales tax payment, split both payroll runs, and categorize the fees.'
    },

    // ================================================================
    // 3. Contractor and 1099s
    // ================================================================
    {
      id: 'contractor', n: 3, count: 4, title: 'Contractor and 1099s', client: 'Bear Creek Handyman Co.', level: 'Intermediate', minutes: 75, start: 'contacts',
      summary: 'A handyman paying subcontractors: decide who gets a 1099-NEC, fix a contractor coded as payroll, capitalize a truck that was expensed, and book its first month of depreciation.',
      period: () => per(1),
      brief: M => ({
        who: `Bear Creek Handyman Co. LLC is a single-member LLC in Lakewood owned by Tom Becker. Tom has one employee and hires subcontractors — drywall, tile, electrical, painting, plumbing — for bigger jobs.`,
        wrong: `In ${mname(M)} Tom paid five subcontractors, bought a used pickup, and coded it all himself. None of his vendors are marked for 1099s, one subcontractor went into Payroll & Wages, and the $27,000 truck went straight to Car & Truck — which makes the month look like a big loss.`,
        wants: `Tom's CPA asked for "1099 vendors flagged, a clean P&L, and the truck on the balance sheet with depreciation started." ${C.parseISO(M.from).getFullYear() === 2026 ? 'Everything in this case happened in 2026, so the 2026 rule applies: a' : `Everything in this case happened in ${C.parseISO(M.from).getFullYear()}. This case uses the 2026 rule (later years can be adjusted for inflation, so check the current IRS instructions for real clients): a`} 1099-NEC is required when a business pays a non-employee $2,000 or more for services during the year.`
      }),
      tasks: [
        'Read the W-9 summary and payment history, then mark the vendors who need a 1099-NEC (Customers & Vendors → edit the vendor → 1099 contractor).',
        'Move the subcontractor who was coded as payroll to Contract Labor.',
        'Capitalize the truck: it\'s an asset, not a monthly expense.',
        'Post the truck\'s first month of straight-line depreciation as a journal entry dated the last day of the month.'
      ],
      rules: [
        'For payments made in 2026, a 1099-NEC is required for $2,000 or more paid to a non-employee for services in the year — add up every payment, not just one.',
        'Payments to corporations generally don\'t get a 1099-NEC (legal fees are the big exception). A single-member LLC that hasn\'t elected corporate tax treatment is treated like a sole proprietor and does get one.',
        'Payments made by credit card are reported by the card company on a 1099-K, so they\'re left off the 1099-NEC.',
        'An employee is paid through payroll with withholding; a subcontractor is paid gross and goes to Contract Labor. Mixing them distorts both payroll and 1099 reports.',
        'A vehicle used for years is a fixed asset. The books spread its cost over its useful life with depreciation; whether to take bonus depreciation or Section 179 on the tax return is the CPA\'s call.'
      ],
      docs: M => [
        ['W-9 summary (from Tom\'s files)', [
          'Peak Drywall LLC — single-member LLC, taxed as a sole proprietor',
          'Diego Fuentes — individual / sole proprietor (tile setter)',
          'Rocky Mountain Electric Inc. — C corporation',
          'Sam Whitaker — individual / sole proprietor (painter)',
          'Mile High Plumbing Repair — individual / sole proprietor'
        ]],
        [`Subcontractor payments in ${C.parseISO(M.from).getFullYear()}`, [
          'This is the business\'s first year with subcontractors, so these are all the payments for the year.',
          `Peak Drywall LLC: $1,600.00 (${short(dayOf(M, 9))}) + $1,250.00 (${short(dayOf(M, 23))}) = $2,850.00 · by check`,
          `Diego Fuentes: $2,000.00 (${short(dayOf(M, 16))}) · by check`,
          `Rocky Mountain Electric Inc.: $3,400.00 (${short(dayOf(M, 12))}) · by check`,
          `Sam Whitaker: $1,100.00 + $750.00 = $1,850.00 · by check`,
          `Mile High Plumbing Repair: $2,300.00 (${short(dayOf(M, 20))}) · business credit card`
        ]],
        ['Text from Tom', [
          `"Diego isn't on payroll — he does tile for us when we need him and sends an invoice. I think I clicked the wrong thing for his $2,000."`
        ]],
        ['Mountain View Auto Sales — bill of sale', [
          `Used 2022 pickup, purchased and put in service ${short(dayOf(M, 2))}: $27,000.00, paid by check #1044 (recorded as Car & Truck).`,
          'CPA\'s book policy: straight-line over 5 years (60 months), $3,000.00 salvage value, a full month of depreciation in the month an asset is placed in service.',
          'Monthly depreciation: ($27,000 − $3,000) ÷ 60 = $400.'
        ]]
      ],
      build() {
        const M = this.period();
        const { c, A, add, K, vendor } = base('contractor', { name: 'Bear Creek Handyman Co.', legalName: 'Bear Creek Handyman Co. LLC', industry: 'Handyman services · case study', color: '#5A5FA8', invoicePrefix: 'BC-', email: 'tom@bearcreekhandyman.example', phone: '(720) 555-0108', address: '1450 S Wadsworth Blvd\nLakewood, CO 80232' }, M);
        c.entity = 'llc1';
        C.acctByName(c, 'Business Checking').opening = 45000;
        const peak = vendor('Peak Drywall LLC', 'W-9 on file: single-member LLC, taxed as a sole proprietor');
        const diego = vendor('Diego Fuentes', 'W-9 on file: individual / sole proprietor. Tile setter.');
        const rme = vendor('Rocky Mountain Electric Inc.', 'W-9 on file: C corporation');
        const sam = vendor('Sam Whitaker', 'W-9 on file: individual / sole proprietor. Painter.');
        const mhp = vendor('Mile High Plumbing Repair', 'W-9 on file: individual / sole proprietor. Paid by business credit card.');
        [[6, 9800], [13, 7450], [22, 11200], [29, 8650]].forEach(([d, v]) => add(null, dayOf(M, d), 'MOBILE DEPOSIT - CUSTOMER PAYMENTS', v, 'Service Revenue', { payee: 'Customer payments' }));
        add(null, dayOf(M, 9), 'CHECK 1046 PEAK DRYWALL', -1600, 'Contract Labor', { payee: peak.name, vendorId: peak.id });
        add(null, dayOf(M, 23), 'CHECK 1058 PEAK DRYWALL', -1250, 'Contract Labor', { payee: peak.name, vendorId: peak.id });
        add('diego', dayOf(M, 16), 'CHECK 1051 DIEGO FUENTES', -2000, 'Payroll & Wages', { payee: diego.name, vendorId: diego.id });
        add(null, dayOf(M, 12), 'CHECK 1049 ROCKY MTN ELECTRIC', -3400, 'Contract Labor', { payee: rme.name, vendorId: rme.id });
        add(null, dayOf(M, 19), 'CHECK 1053 SAM WHITAKER', -1100, 'Contract Labor', { payee: sam.name, vendorId: sam.id });
        add(null, dayOf(M, 26), 'CHECK 1060 SAM WHITAKER', -750, 'Contract Labor', { payee: sam.name, vendorId: sam.id });
        add(null, dayOf(M, 20), 'MILE HIGH PLUMBING REPAIR', -2300, 'Contract Labor', { account: 'Business Credit Card', payee: mhp.name, vendorId: mhp.id });
        add(null, dayOf(M, 15), 'GUSTO PAYROLL PPD', -2100, 'Payroll & Wages', { payee: 'Gusto Payroll' });
        add(null, dayOf(M, 30), 'GUSTO PAYROLL PPD', -2100, 'Payroll & Wages', { payee: 'Gusto Payroll' });
        add('truck', dayOf(M, 2), 'CHECK 1044 MOUNTAIN VIEW AUTO SALES', -27000, 'Car & Truck', { payee: 'Mountain View Auto Sales' });
        [[5, 96.40], [18, 104.85], [27, 88.35]].forEach(([d, v]) => add(null, dayOf(M, d), 'SHELL OIL 57311', -v, 'Car & Truck', { payee: 'Shell' }));
        add(null, dayOf(M, 8), 'THE HOME DEPOT #1522', -1486.22, 'Cost of Goods Sold', { payee: 'The Home Depot' });
        c.transactions.sort((a, b) => a.date.localeCompare(b.date));
        c.caseKey = { ...K, period: M, year: C.parseISO(M.from).getFullYear(), vendors: { yes: [peak.name, diego.name], no: [rme.name, sam.name, mhp.name] }, expect: {
          'Contract Labor': 12400, 'Payroll & Wages': 4200,
          'Equipment & Vehicles': 27000, 'Car & Truck': sum([96.40, 104.85, 88.35]),
          'Depreciation Expense': 400, 'Accumulated Depreciation': -400
        } };
        return c;
      },
      checks: ({ c, k, is, now }) => {
        const flag = name => { const v = c.contacts.find(x => C.normName(x.name) === C.normName(name)); return v ? !!v.is1099 : null; };
        const wrongYes = k.vendors.yes.filter(n => flag(n) !== true), wrongNo = k.vendors.no.filter(n => flag(n) === true);
        return [
          ['1099 vendors marked correctly', 30, !wrongYes.length && !wrongNo.length,
            `Mark Peak Drywall LLC ($1,600 + $1,250 = $2,850 — a single-member LLC is treated like a sole proprietor) and Diego Fuentes ($2,000.00 — the rule is $2,000 or more, so exactly $2,000 counts) as 1099 contractors. Leave Rocky Mountain Electric Inc. unmarked (a corporation), Sam Whitaker unmarked ($1,100 + $750 = $1,850, under $2,000) and Mile High Plumbing Repair unmarked (paid by credit card, so the card company reports it on a 1099-K).${wrongYes.length ? ' Still needs marking: ' + wrongYes.join(', ') + '.' : ''}${wrongNo.length ? ' Shouldn\'t be marked: ' + wrongNo.join(', ') + '.' : ''}`],
          ['Diego Fuentes moved to Contract Labor', 20, is('Contract Labor') && is('Payroll & Wages'),
            `Diego is a subcontractor who invoices Tom — he isn't on payroll and nothing was withheld. Recategorize his $2,000.00 check from Payroll & Wages to Contract Labor. Contract Labor should be $2,850 + $2,000 + $3,400 + $1,850 + $2,300 = $12,400, and Payroll & Wages should be the employee's two $2,100 payrolls, $4,200. Now: ${now('Contract Labor')}; ${now('Payroll & Wages')}.`],
          ['Truck capitalized to Equipment & Vehicles', 25, is('Equipment & Vehicles') && is('Car & Truck'),
            `A pickup Tom will use for years is a fixed asset. Recategorize the $27,000.00 Mountain View Auto Sales check from Car & Truck to Equipment & Vehicles. Car & Truck keeps only the fuel: $96.40 + $104.85 + $88.35 = $289.60. Now: ${now('Equipment & Vehicles')}; ${now('Car & Truck')}.`],
          ['First month\'s depreciation posted ($400.00)', 25, is('Depreciation Expense') && is('Accumulated Depreciation'),
            `Straight-line depreciation is (cost − salvage) ÷ months of life: ($27,000 − $3,000) ÷ 60 = $400. Post a journal entry dated ${short(k.period.to)}: debit Depreciation Expense $400.00, credit Accumulated Depreciation $400.00. Now: ${now('Depreciation Expense')}; ${now('Accumulated Depreciation')}.`]
        ];
      },
      coach: 'Mark the two 1099 vendors, move Diego to Contract Labor, capitalize the truck, and post $400 of depreciation on the last day of the month.'
    },

    // ================================================================
    // 4. S-corp owner pay
    // ================================================================
    {
      id: 'scorp', n: 4, count: 4, title: 'S-corp owner pay', client: 'Flatirons Design Studio', level: 'Advanced', minutes: 75, start: 'review',
      summary: 'An S corporation owner who has only taken distributions starts a real salary. Post her first payroll from the payroll report, move a personal expense to distributions, and accrue a month-end bill.',
      period: () => per(1),
      brief: M => ({
        who: `Flatirons Design Studio, Inc. is a Boulder branding studio owned 100% by Priya Shah. It has elected S corporation status. Priya is the only person who works in the business.`,
        wrong: `Until now Priya paid herself only distributions — transfers to her personal account. Her CPA warned her that an S-corp owner who works in the business has to take a reasonable salary through payroll, so she started payroll in ${mname(M)}. The two Gusto withdrawals are sitting in To Review, a family ski-pass purchase was coded to Travel, and the CPA's bill for the payroll setup hasn't been entered.`,
        wants: `Priya wants ${mname(M)} right before her CPA reviews it: payroll recorded the way the payroll report reads, business and personal spending kept apart, and every cost of the month in the month.`
      }),
      tasks: [
        'Categorize the net-pay withdrawal and split the tax withdrawal so gross wages land in Payroll & Wages and employer taxes in Payroll Taxes.',
        'Move the ski passes out of Travel to Shareholder Distributions.',
        `Accrue Wren & Ash CPAs' invoice for work done in ${mname(M)} — enter it as a bill dated the invoice date, or post an accrual journal entry.`
      ],
      rules: [
        'S-corp distributions aren\'t subject to payroll taxes, which is exactly why the IRS requires owners who work in the business to take a reasonable salary through payroll first.',
        'Gross wages are the expense — net pay plus everything withheld from the paycheck. The withholdings are the employee\'s money, sent to the government on her behalf.',
        'The employer\'s share of FICA is 7.65% of wages (6.2% Social Security on wages up to $184,500 in 2026, plus 1.45% Medicare with no cap). That share is the business\'s own expense: Payroll Taxes.',
        'A shareholder\'s personal costs paid by the corporation are distributions, not business expenses.',
        'Under accrual, an expense belongs to the month the work was done, even if the bill is paid next month.'
      ],
      docs: M => [
        ['Gusto payroll report — Priya Shah', [
          `Pay date ${short(dayOf(M, 30))} · gross salary $5,000.00`,
          'Withheld from Priya: Social Security $5,000 × 6.2% = $310.00 · Medicare $5,000 × 1.45% = $72.50 · federal income tax $600.00 · Colorado income tax $210.00',
          'Net pay: $5,000 − $310 − $72.50 − $600 − $210 = $3,807.50',
          'Employer taxes: $5,000 × 7.65% = $382.50 (unemployment taxes are filed and paid quarterly — not part of this case).'
        ]],
        ['Gusto bank withdrawals', [
          `${short(dayOf(M, 30))} · GUSTO NET PAY $3,807.50 — Priya's direct deposit`,
          `${short(dayOf(M, 30))} · GUSTO TAX IMPOUND $1,575.00 — all the taxes: $310.00 + $72.50 + $600.00 + $210.00 + $382.50 = $1,575.00`
        ]],
        ['Card statement note from Priya', [
          `"The $1,050 Peak Ski Passes charge on ${short(dayOf(M, 9))} is our family's season passes. The $286.40 Mountain Lodge stay was the client workshop in Aspen."`
        ]],
        ['Wren & Ash CPAs — invoice #2291', [
          `Dated ${short(M.to)}: S-corp payroll setup and reasonable-salary memo, work done in ${mname(M)} · $1,200.00 · due in 30 days. Not paid yet and not in the books.`
        ]]
      ],
      build() {
        const M = this.period();
        const { c, A, ens, add, K } = base('scorp', { name: 'Flatirons Design Studio', legalName: 'Flatirons Design Studio, Inc.', industry: 'Branding studio · S corporation · case study', color: '#2E7C86', invoicePrefix: 'FD-', email: 'priya@flatironsdesign.example', phone: '(720) 555-0133', address: '1909 Pearl St\nBoulder, CO 80302' }, M);
        c.entity = 'scorp';
        ens('Shareholder Distributions', 'equity', 'equity');
        C.acctByName(c, 'Business Checking').opening = 38000;
        [[4, 8500], [12, 6250], [19, 9100], [27, 7400]].forEach(([d, v]) => add(null, dayOf(M, d), 'ACH DEPOSIT - CLIENT PAYMENT', v, 'Service Revenue', { payee: 'Client payment' }));
        add(null, dayOf(M, 1), 'PEARL ST STUDIOS RENT', -2200, 'Rent & Lease', { payee: 'Pearl St Studios' });
        add(null, dayOf(M, 2), 'TRANSFER TO P SHAH PERSONAL', -4000, 'Shareholder Distributions', { payee: 'Priya Shah (distribution)' });
        add(null, dayOf(M, 5), 'ADOBE *CREATIVE CLD', -89.99, 'Software & Subscriptions', { payee: 'Adobe' });
        add(null, dayOf(M, 14), 'COMCAST BUSINESS', -119.99, 'Phone & Internet', { payee: 'Comcast Business' });
        add('ski', dayOf(M, 9), 'PEAK SKI PASSES', -1050, 'Travel', { account: 'Business Credit Card', payee: 'Peak Ski Passes' });
        add(null, dayOf(M, 17), 'MOUNTAIN LODGE ASPEN', -286.40, 'Travel', { account: 'Business Credit Card', payee: 'Mountain Lodge' });
        add('net', dayOf(M, 30), 'GUSTO NET PAY', -3807.50, null, { review: true, payee: 'Gusto' });
        add('tax', dayOf(M, 30), 'GUSTO TAX IMPOUND', -1575, null, { review: true, payee: 'Gusto' });
        c.contacts.push({ id: C.uid(), kind: 'vendor', name: 'Wren & Ash CPAs', email: 'office@wrenash.example', phone: '', address: 'Boulder, CO', notes: 'Tax and payroll advice' });
        c.transactions.sort((a, b) => a.date.localeCompare(b.date));
        c.caseKey = { ...K, period: M, expect: {
          'Payroll & Wages': 5000, 'Payroll Taxes': 382.5, 'Uncategorized Expense': 0,
          distributions: -5050, 'Travel': 286.4,
          'Legal & Professional Fees': 1200, owed: 1200
        } };
        return c;
      },
      checks: ({ k, v, is, now }) => {
        const dist = C.round2(v("Owner's Draw") + v('Shareholder Distributions')), owed = C.round2(v('Accounts Payable') + v('Accrued Liabilities'));
        return [
          ['Gross wages recorded ($5,000.00)', 30, is('Payroll & Wages') && is('Uncategorized Expense'),
            `Wages are the gross pay, not just the net deposit. Categorize the $3,807.50 net-pay withdrawal to Payroll & Wages, then split the $1,575.00 tax withdrawal: $1,192.50 to Payroll & Wages (the $310.00 + $72.50 + $600.00 + $210.00 withheld from Priya) and $382.50 to Payroll Taxes. Wages then total $3,807.50 + $1,192.50 = $5,000. Now: ${now('Payroll & Wages')}; ${now('Uncategorized Expense')}.`],
          ['Employer payroll taxes recorded ($382.50)', 20, is('Payroll Taxes'),
            `The employer's matching FICA is the business's own expense: $5,000 × 7.65% = $382.50 → Payroll Taxes. The rest of the tax withdrawal was withheld from Priya's pay, so it's part of her wages. Now: ${now('Payroll Taxes')}.`],
          ['Ski passes moved to distributions', 25, Math.abs(dist - k.expect.distributions) < 0.005 && is('Travel'),
            `The $1,050.00 family ski passes are personal. Recategorize them from Travel to Shareholder Distributions — a shareholder's personal costs paid by the corporation are distributions, not deductible expenses. Distributions for the month should be $4,000 + $1,050 = $5,050, and Travel keeps only the $286.40 client workshop. Now: distributions ${money(-dist)} (should be ${money(5050)}); ${now('Travel')}.`],
          ['CPA\'s bill accrued in the right month', 25, is('Legal & Professional Fees') && Math.abs(owed - k.expect.owed) < 0.005,
            `The CPA did the work in ${mname(k.period)} and dated the invoice ${short(k.period.to)}, so the expense belongs to this month even though it's paid next month. Enter it as a bill from Wren & Ash CPAs dated ${short(k.period.to)} for $1,200.00 to Legal & Professional Fees — or post a journal entry that day: debit Legal & Professional Fees $1,200.00, credit Accrued Liabilities $1,200.00. Now: ${now('Legal & Professional Fees')}; owed to vendors ${money(owed)} (should be ${money(1200)}).`]
        ];
      },
      coach: 'Record Priya\'s gross wages and employer taxes from the payroll report, move the ski passes to distributions, and accrue the CPA\'s $1,200 bill.'
    }
  ];
  const byId = id => CASES.find(d => d.id === id) || null;
  const caseClient = id => S.data.clients.find(c => c.caseStudy === id) || null;
  const periodOf = d => (d.months ? { from: d.period().from, to: d.period().to, months: d.months() } : d.period());

  function build(id) {
    const d = byId(id); if (!d) return null;
    return d.build();
  }

  function grade(c) {
    const d = byId(c && c.caseStudy); if (!d || !c.caseKey) return null;
    const k = c.caseKey, bal = C.balances(c, { to: k.period.to });
    const v = n => { const a = C.acctByName(c, n); return a ? C.round2(bal.get(a.id) || 0) : 0; };
    const is = n => Math.abs(v(n) - k.expect[n]) < 0.005;
    const now = n => `${n} is ${money(v(n))} (should be ${money(k.expect[n])})`;
    const items = d.checks({ c, k, v, is, now }).map(([label, pts, ok, why]) => ({ label, pts, ok: !!ok, why, got: ok ? pts : 0 }));
    const score = items.reduce((s, x) => s + x.got, 0);
    return { id: d.id, items, score, total: items.reduce((s, x) => s + x.pts, 0), passed: score >= 80 };
  }

  function coachText(c) {
    const d = byId(c && c.caseStudy);
    return d ? d.coach : 'Work through the case brief, then grade your work in the Study center.';
  }

  // ------------------------------------------------------------------
  // Case screens
  // ------------------------------------------------------------------
  const statusOf = d => {
    const rec = L().cases[d.id], c = caseClient(d.id);
    if (rec && rec.passed) return `<span class="tag green">${ICON.check}Passed · ${rec.score}/100</span>`;
    if (c) return `<span class="tag gold">In progress${rec ? ` · best ${rec.score}/100` : ''}</span>`;
    return '<span class="tag">Not started</span>';
  };
  const docList = docs => `<div class="adv-docs">${docs.map(([title, lines], i) => `<div class="adv-doc"><b>${i + 1} · ${esc(title)}</b>${lines.map(l => `<span>${esc(l)}</span>`).join('')}</div>`).join('')}</div>`;

  function renderCases() {
    const ui = UI();
    const d = ui.open && byId(ui.open);
    if (d) return renderCase(d);
    const done = CASES.filter(x => (L().cases[x.id] || {}).passed).length;
    return `<div class="tm-head"><span class="tag navy">Study center · case studies</span><span class="tag ${done === CASES.length ? 'green' : ''}">${done} of ${CASES.length} passed</span></div>
      <h2 class="tm-title">Case studies</h2>
      <p class="tm-learn">Real client situations, start to finish. Each case builds a pretend client with the kind of mess you'll actually inherit — read the brief and the source documents, fix the books, then grade your work. Grading looks at the account balances, so any correct method earns full credit. Pass with 80 points or more; you can start over as many times as you like.</p>
      <div class="lc-grid">${CASES.map(x => {
        const c = caseClient(x.id);
        return `<div class="card lc-card"><div class="card-head"><span class="tag navy">Case ${x.n} · ${esc(x.level)}</span>${statusOf(x)}</div>
          <div class="card-body"><h3 class="lc-title">${esc(x.title)}</h3><div class="muted">${esc(x.client)} · about ${x.minutes} minutes</div><p class="lc-sum">${esc(x.summary)}</p>
          <div class="lc-actions"><button class="btn primary sm" data-action="lc-open-brief" data-id="${x.id}">Read the brief ${ICON.right}</button>${c ? `<button class="btn sm" data-action="lc-open" data-id="${x.id}">Open ${esc(x.client)}</button>` : ''}</div></div></div>`;
      }).join('')}</div>`;
  }

  function renderCase(d) {
    const c = caseClient(d.id), P = periodOf(d), rec = L().cases[d.id];
    const res = c ? S.ui.lcGrade[d.id] : null;
    const B = d.brief(P);
    return `<div class="tm-nav lc-top" style="border-top:0;padding-top:0"><button class="btn ghost sm" data-action="lc-back">${ICON.back}All case studies</button><span></span></div>
      <div class="tm-head"><span class="tag navy">Case ${d.n} of ${CASES.length} · ${esc(d.level)}</span>${statusOf(d)}</div>
      <h2 class="tm-title">${esc(d.title)}: ${esc(d.client)}</h2>
      <p class="tm-learn">${esc(d.summary)}</p>
      <div class="exam-brief">
        <p><b>The client.</b> ${esc(B.who)}</p>
        <p><b>What's wrong.</b> ${esc(B.wrong)}</p>
        <p><b>What the owner wants.</b> ${esc(B.wants)}</p>
        <div class="cap-label" style="margin-top:12px">Your job</div>
        <ol class="t-list">${d.tasks.map(t => `<li>${esc(t)}</li>`).join('')}</ol>
      </div>
      <div class="cap-label">Source documents</div>
      ${docList(d.docs(P))}
      <div class="cap-label" style="margin-top:6px">The rules behind it</div>
      <ul class="t-list lc-rules">${d.rules.map(r => `<li>${esc(r)}</li>`).join('')}</ul>
      <p class="muted">Plan on about ${d.minutes} minutes. Graded on ${d.count} checks worth 100 points; pass with 80 or more. Grading looks at balances through ${esc(fmtDate(P.to))}, so journal entries, splits and recategorizing all count.${rec ? ` Your best so far: ${rec.score}/100${rec.passed ? ' — passed' : ''}.` : ''}</p>
      ${res ? `<div class="exam-result ${res.passed ? 'pass' : ''}"><div class="er-score">${res.score}<span>/ 100</span></div><div><h2 class="tm-title" style="margin:0">${res.passed ? (res.score === 100 ? 'Case solved — perfect books.' : 'Case passed!') : res.score === 0 ? 'Nothing fixed yet' : 'Not passed yet'}</h2><div class="muted">${res.passed ? (res.score === 100 ? 'Every balance matches. This is exactly what the owner needed.' : 'Solid work. Fix the item marked below for a perfect score.') : 'Each item below says exactly what to post. Fix them, then grade again.'}</div></div></div>
        <div class="grade-list">${res.items.map(x => `<div class="gl ${x.ok ? 'ok' : ''}"><span class="tick ${x.ok ? 'on' : ''}">${x.ok ? ICON.check : ICON.close}</span><div class="grow"><b>${esc(x.label)}</b>${x.ok ? '' : `<div class="muted">${esc(x.why)}</div>`}</div><span class="num">${x.got}/${x.pts}</span></div>`).join('')}</div>` : ''}
      <div class="tm-nav">${c ? `<button class="btn ghost" data-action="lc-reset" data-id="${d.id}">${ICON.refresh}Start over</button><span style="flex:1"></span><button class="btn" data-action="lc-open" data-id="${d.id}">Open ${esc(d.client)} ${ICON.right}</button><button class="btn primary" data-action="lc-grade" data-id="${d.id}">${ICON.check}Grade my work</button>` : `<span></span><button class="btn primary" data-action="lc-start" data-id="${d.id}">Start the case ${ICON.right}</button>`}</div>`;
  }

  function start(id, fresh) {
    const d = byId(id); if (!d) return;
    if (fresh) { S.data.clients = S.data.clients.filter(c => c.caseStudy !== id); S.ui.lcGrade[id] = null; }
    let c = caseClient(id);
    const isNew = !c;
    if (!c) { c = d.build(); S.data.clients.push(c); }
    save();
    App.switchClient(c.id, d.start);
    if (isNew) U.toast(`${d.client} is ready — the coach in the corner keeps the brief handy`);
  }

  // ------------------------------------------------------------------
  // Client email practice
  // ------------------------------------------------------------------
  // auto: a simple check that ticks the item when the draft passes it
  const AUTO = {
    greeting: t => /^\s*(hi|hello|hey|dear|good (morning|afternoon|evening))\b/i.test(t),
    money: t => /\$\s?\d/.test(t),
    ask: t => /\?|\b(please|could you|can you|would you|let me know|let's|shall we)\b/i.test(t),
    date: t => /\b(mon|tues|wednes|thurs|fri|satur|sun)day\b|\b(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?\s+\d{1,2}\b|\b\d{1,2}\/\d{1,2}\b|\b(tomorrow|end of (the )?(day|week|month)|next week|this week)\b/i.test(t),
    signoff: t => /\b(thanks|thank you|best|warmly|kind regards|regards|sincerely|cheers|talk soon|all the best)\b[^\n]*\n+\s*\S/i.test(t.split(/\n/).slice(-6).join('\n')),
    noblame: t => t.trim().length > 40 && !/\b(you forgot|your fault|you failed|you never|you should have|you didn'?t bother|careless|obviously|as i already (said|told)|per my last email|again\?\?|irresponsible)\b/i.test(t),
    decline: t => /\b(can'?t|cannot|can not|unable to|won'?t be able|not able to|isn'?t something i can)\b/i.test(t),
    list3: t => (t.match(/^\s*([-•*]|\d+[.)])\s+\S/gm) || []).length >= 3,
    invoice: t => /\b[A-Z]{1,4}-?\d{3,5}\b/.test(t) && /\$\s?\d/.test(t)
  };
  const AUTO_LABEL = { greeting: 'a greeting', money: 'a $ amount', ask: 'a clear ask or question', date: 'a day or date', signoff: 'a sign-off and your name', noblame: 'no blaming words', decline: 'a clear "can\'t"', list3: 'three list items', invoice: 'the invoice number and amount' };

  const EMAILS = [
    {
      id: 'missing-docs', title: 'Ask for missing receipts and a statement', who: 'Dana Ortiz, Ortiz Mobile Detailing',
      situation: 'You\'re doing Dana\'s September books. The business credit card statement (Capital One ending 4471) is missing, and three September charges of $75 or more need receipts: Shell $86.40 on Sept 4, Detail King Supply $312.18 on Sept 11, and Hilton Garden Inn $189.00 on Sept 22 (a car show in Grand Junction). You can\'t finish the month without them. Dana is busy and reads email on her phone.',
      items: [
        ['A friendly greeting by name', 'greeting'],
        ['Lists exactly what\'s missing — the card statement and each receipt', null],
        ['Specific amounts and dates so she can find each one fast', 'money'],
        ['One line on why it matters (deductions she can defend, closing the month)', null],
        ['A clear deadline', 'date'],
        ['An easy way to send them (reply with phone photos, or the upload link)', null],
        ['A warm sign-off with your name', 'signoff']
      ],
      model: N => `Hi Dana,

I'm wrapping up September's books and I'm missing just a few things:

1. The Capital One business card statement (ending 4471) for September
2. Receipt: Shell, $86.40 on Sept 4
3. Receipt: Detail King Supply, $312.18 on Sept 11
4. Receipt: Hilton Garden Inn, $189.00 on Sept 22 (the Grand Junction car show)

The IRS expects receipts for travel and lodging of $75 or more, and having them on file means those deductions hold up if anyone ever asks. The statement lets me reconcile the card so your numbers are exact.

Could you send them by this Friday? Phone photos are perfect — just reply to this email with them attached. Once I have them, I'll close September and send your reports the same week.

Thank you so much!
${N}`
    },
    {
      id: 'cash-crunch', title: 'Explain a cash crunch kindly, with numbers', who: 'Marcus Bell, Bell & Birch Woodworks',
      situation: 'Marcus asked whether he can buy a $4,000 jointer this month. Checking has $6,200. In the next 30 days he has two payrolls totaling $7,800, rent of $2,400 and a credit card payment of $1,150. Customers owe him $9,600, and $5,400 of that is more than 30 days past due (mostly Cedar Ridge Homes). He\'s proud of the business and a little stressed.',
      items: [
        ['A warm greeting', 'greeting'],
        ['The real numbers: cash on hand, what\'s coming out, what customers owe', 'money'],
        ['A plain-English explanation of why profit isn\'t cash right now', null],
        ['No blame — it\'s a timing problem, not a failure', 'noblame'],
        ['Two or three concrete options (collect the overdue invoices, wait on the jointer, financing)', null],
        ['A clear next step or offer to talk', 'ask'],
        ['A warm sign-off', 'signoff']
      ],
      model: N => `Hi Marcus,

Great question to ask before buying — and the short answer is "not quite yet."

The business is profitable, but the cash is tied up in what customers owe you. Here's the next 30 days:

- In checking today: $6,200
- Going out: payroll $7,800 + rent $2,400 + the card $1,150 = $11,350
- That's $11,350 − $6,200 = $5,150 more than you have right now

The good news: customers owe you $9,600, and $5,400 of it is over 30 days past due — mostly Cedar Ridge Homes. Collecting that alone covers the gap.

A few options:
1. Let me send friendly reminders on the overdue invoices this week (I can draft them for you).
2. Wait on the jointer until Cedar Ridge pays, then buy it with cash.
3. If you need it now, ask the dealer about financing so the cost is spread out.

Would you like to hop on a 15-minute call Thursday to pick a plan? This is a timing issue, not a business problem — you're in good shape once the money that's owed comes in.

Warmly,
${N}`
    },
    {
      id: 'backdate', title: 'Decline a request to backdate an invoice', who: 'Tessa Reyes, Reyes Event Rentals',
      situation: 'Tessa writes: "Summit Weddings says their budget year closed June 30 and they\'ll only pay the $2,850 if the invoice is dated June 30. Can you redate the invoice? The work was the July 12 wedding." Changing the date would misstate when the sale happened — in her books and in theirs. You want to say no clearly, keep things friendly, and still help her get paid.',
      items: [
        ['A friendly greeting', 'greeting'],
        ['A clear "I can\'t" — no maybe', 'decline'],
        ['A short, non-preachy reason (the invoice date has to show when the work was done)', null],
        ['A helpful alternative (service dates on the invoice, a letter confirming the dates, or talking with their AP)', null],
        ['Keeps the relationship warm — you\'re on her side', null],
        ['No blame toward Tessa or her customer', 'noblame'],
        ['A sign-off with your name', 'signoff']
      ],
      model: N => `Hi Tessa,

Thanks for checking with me first — I know you want to get that $2,850 in.

I can't redate the invoice to June 30. The invoice date has to show when the work actually happened, and putting a date before the July 12 wedding would make both your books and Summit Weddings' books wrong. That's the kind of thing that causes real trouble in an audit, for you and for them.

Here's what I can do instead:
- Add the service date clearly on the invoice: "Event rentals for the July 12 wedding."
- Write a short letter confirming the order date and the event date, in case their finance team needs it for their records.
- Suggest they ask their accounts payable team how they handle invoices that arrive after year end — most companies have a simple process for it.

Want me to draft that note to Summit Weddings for you? Happy to help get this paid.

Best,
${N}`
    },
    {
      id: 'month-end', title: 'Send the month-end package with three highlights', who: 'Harper Nguyen, Juniper & Sage Yoga',
      situation: 'September is closed for Harper\'s studio. Revenue was $17,920, up 12% from August\'s $16,000. Net profit was $4,180. Cash in checking is $22,650. Memberships are 82% of revenue. The next quarterly estimated tax payment is due January 15, and you suggest setting aside 25% of profit. You\'re attaching the Profit & Loss, Balance Sheet and a one-page summary. One question: a $240 Venmo deposit on Sept 18 has no description.',
      items: [
        ['A friendly greeting', 'greeting'],
        ['Names what\'s attached (P&L, Balance Sheet, summary)', null],
        ['Exactly three highlights, as a short list', 'list3'],
        ['Numbers with a comparison (vs. last month)', 'money'],
        ['One action item or question for the client', 'ask'],
        ['An offer to walk through it', null],
        ['A warm sign-off', 'signoff']
      ],
      model: N => `Hi Harper,

September is closed! Attached are your Profit & Loss, Balance Sheet and a one-page summary.

Three highlights:
1. Revenue was $17,920 — up 12% from August's $16,000 ($16,000 × 1.12 = $17,920).
2. Net profit was $4,180, and you have $22,650 in checking. Memberships made up 82% of revenue, which keeps income steady.
3. Your next quarterly estimated tax payment is due January 15. I'd set aside about $1,045 from September (25% of $4,180) so it's ready.

One quick question: what was the $240 Venmo deposit on Sept 18? There was no description — if it was a private session, I'll record it as revenue.

Happy to walk through any of it on a quick call if that's helpful.

Warmly,
${N}`
    },
    {
      id: 'overdue', title: 'Follow up on an overdue invoice — friendly but firm', who: 'For your client Ridgeline Roofing, to their customer Alpine Property Management',
      situation: 'You handle collections for Ridgeline Roofing. Invoice RR-2214 for $3,850 (roof repair at 412 Aspen Way) was due 30 days ago, and a polite reminder two weeks ago got no reply. Ridgeline\'s terms, printed on the invoice, add a 1.5% monthly late charge after 30 days past due. Payment can be made by ACH (details on the invoice) or check. You want the money without souring a good customer relationship.',
      items: [
        ['A professional greeting', 'greeting'],
        ['The invoice number, amount and original due date', 'invoice'],
        ['Assumes good faith (it may have been missed)', null],
        ['A specific pay-by date', 'date'],
        ['How to pay (ACH or check)', null],
        ['What happens next if it isn\'t paid (the late charge from the terms)', null],
        ['An offer to sort out any problem, and a sign-off', 'signoff']
      ],
      model: N => `Hello Alpine Property Management team,

I'm following up on Ridgeline Roofing invoice RR-2214 for $3,850.00 for the roof repair at 412 Aspen Way. It was due 30 days ago, and I haven't seen a payment or a reply to my reminder two weeks ago — it may simply have been missed.

Could you please arrange payment by this Friday? You can pay by ACH using the bank details on the invoice, or mail a check to the address shown there.

Per the terms on the invoice, a 1.5% monthly late charge applies once an invoice is more than 30 days past due — on this invoice that's $3,850 × 1.5% = $57.75 a month. Ridgeline would much rather not add it, so paying by Friday avoids it.

If there's a question about the work or the invoice, or it's waiting on an approval, just let me know and I'll help sort it out right away.

Thank you,
${N}
on behalf of Ridgeline Roofing`
    }
  ];
  const sigName = () => { const f = (S.data && S.data.firm) || {}; return [f.owner || '[Your name]', f.name || ''].filter(Boolean).join('\n'); };
  const emailRec = id => { const e = L().emails; e[id] = e[id] || { draft: '', ticks: [], done: false }; return e[id]; };

  function renderEmails() {
    const ui = UI();
    const sc = ui.email && EMAILS.find(x => x.id === ui.email);
    if (sc) return renderEmail(sc);
    const done = EMAILS.filter(x => (L().emails[x.id] || {}).done).length;
    return `<div class="tm-head"><span class="tag navy">Study center · client emails</span><span class="tag ${done === EMAILS.length ? 'green' : ''}">${done} of ${EMAILS.length} done</span></div>
      <h2 class="tm-title">Client email practice</h2>
      <p class="tm-learn">Half of bookkeeping is the email. Clients remember how you made them feel as much as whether the numbers were right. Write each email the way you'd really send it, check it against what a great email needs, then compare it with a model.</p>
      <div class="lc-grid">${EMAILS.map((x, i) => {
        const r = L().emails[x.id];
        return `<div class="card lc-card"><div class="card-head"><span class="tag navy">Email ${i + 1}</span>${r && r.done ? `<span class="tag green">${ICON.check}Done</span>` : r && r.draft ? '<span class="tag gold">Draft started</span>' : '<span class="tag">Not started</span>'}</div>
          <div class="card-body"><h3 class="lc-title">${esc(x.title)}</h3><div class="muted">${esc(x.who)}</div><p class="lc-sum">${esc(x.situation.split('. ')[0])}.</p>
          <div class="lc-actions"><button class="btn primary sm" data-action="lc-email-open" data-id="${x.id}">${r && r.draft ? 'Keep writing' : 'Write it'} ${ICON.right}</button></div></div></div>`;
      }).join('')}</div>`;
  }

  function renderEmail(sc) {
    const r = emailRec(sc.id), ticks = new Set(r.ticks || []);
    const n = EMAILS.indexOf(sc) + 1;
    const model = sc.model(sigName());
    return `<div class="tm-nav lc-top" style="border-top:0;padding-top:0"><button class="btn ghost sm" data-action="lc-email-back">${ICON.back}All emails</button><span></span></div>
      <div class="tm-head"><span class="tag navy">Email ${n} of ${EMAILS.length}</span>${r.done ? `<span class="tag green">${ICON.check}Done</span>` : ''}</div>
      <h2 class="tm-title">${esc(sc.title)}</h2>
      <p class="tm-learn"><b>To:</b> ${esc(sc.who)}</p>
      <div class="exam-brief"><p><b>The situation.</b> ${esc(sc.situation)}</p></div>
      <div class="field"><label for="lc-draft">Your email</label><textarea class="input lc-draft" id="lc-draft" rows="14" data-input="lc-email-draft" data-id="${sc.id}" placeholder="Hi …">${esc(r.draft || '')}</textarea><span class="hint">Your draft saves as you type.</span></div>
      <div class="tm-nav" style="border-top:0"><span class="muted">${r.checked ? 'Edit your draft and check again any time.' : 'Write it first — the checklist and the model email open when you check it.'}</span><button class="btn primary" data-action="lc-email-check" data-id="${sc.id}">${ICON.check}Check my email</button></div>
      ${r.checked ? `<div class="cap-label" style="margin-top:14px">What a great email has</div>
        <div class="grade-list">${sc.items.map(([label, auto], i) => {
          const on = ticks.has(i);
          return `<div class="gl ${on ? 'ok' : ''}">${auto ? `<span class="tick ${on ? 'on' : ''}">${on ? ICON.check : ICON.close}</span>` : `<button class="tick lc-tick ${on ? 'on' : ''}" data-action="lc-email-tick" data-id="${sc.id}" data-i="${i}" aria-pressed="${on}" aria-label="Mark: ${esc(label)}">${ICON.check}</button>`}<div class="grow"><b>${esc(label)}</b><div class="muted">${auto ? (on ? `Found ${esc(AUTO_LABEL[auto])}.` : `Couldn't find ${esc(AUTO_LABEL[auto])} — add it and check again.`) : 'Your call — tick it honestly when your draft does this.'}</div></div></div>`;
        }).join('')}</div>
        ${r.done ? `<p class="pos"><b>Every point covered.</b> That's an email a client is glad to get.</p>` : `<p class="muted">${sc.items.length - ticks.size} to go. Change your draft, then press Check my email again.</p>`}
        <div class="cap-label" style="margin-top:14px">A model email</div>
        <div class="adv-doc lc-model"><span class="lc-model-text">${esc(model)}</span></div>
        <div class="tm-nav" style="border-top:0"><span class="muted">One good version among many — yours doesn't need to match it word for word.</span><button class="btn" data-action="lc-email-copy" data-id="${sc.id}">${ICON.copy}Copy model email</button></div>` : ''}`;
  }

  function checkEmail(id, draft) {
    const sc = EMAILS.find(x => x.id === id); if (!sc) return null;
    const r = emailRec(id);
    r.draft = draft;
    const ticks = new Set(r.ticks || []);
    sc.items.forEach(([, auto], i) => { if (!auto) return; if (AUTO[auto](draft || '')) ticks.add(i); else ticks.delete(i); });
    r.ticks = [...ticks].sort((a, b) => a - b);
    r.checked = true;
    r.done = sc.items.every((_, i) => ticks.has(i));
    return r;
  }

  // ------------------------------------------------------------------
  // Actions
  // ------------------------------------------------------------------
  const backToLab = (patch) => { S.ui.lab = Object.assign(UI(), patch); if (S.route.page !== 'lab') go('lab'); else { render(); const v = $('#view'); if (v) v.scrollTop = 0; } };
  act({
    'lc-open-brief': el => backToLab({ tab: 'cases', open: el.dataset.id }),
    'lc-back': () => backToLab({ tab: 'cases', open: null }),
    'lc-start': el => { UI(); start(el.dataset.id, false); },
    'lc-open': el => { UI(); start(el.dataset.id, false); },
    'lc-reset': async el => {
      const d = byId(el.dataset.id); if (!d) return;
      if (!await U.confirmBox({ title: 'Start this case over?', body: `${esc(d.client)} goes back to the beginning. Your best score is kept.`, ok: 'Start over' })) return;
      UI(); start(d.id, true);
    },
    'lc-grade': el => {
      const id = el.dataset.id, c = caseClient(id); if (!c) return;
      const r = grade(c); UI(); S.ui.lcGrade[id] = r;
      const all = L().cases, prev = all[id];
      if (!prev || r.score > prev.score || (r.passed && !prev.passed)) all[id] = { score: r.score, passed: r.passed, date: today() };
      save();
      backToLab({ tab: 'cases', open: id });
      U.toast(r.passed ? `Case passed — ${r.score}/100` : `${r.score}/100 — see what's left`);
    },
    'lc-email-open': el => backToLab({ tab: 'emails', email: el.dataset.id }),
    'lc-email-back': () => backToLab({ tab: 'emails', email: null }),
    'input:lc-email-draft': el => { const r = emailRec(el.dataset.id); r.draft = el.value; save(); },
    'lc-email-check': el => {
      const id = el.dataset.id, box = $('#lc-draft');
      const draft = box ? box.value : emailRec(id).draft;
      if (!String(draft || '').trim()) return U.toast('Write your email first', null, 'warn');
      const r = checkEmail(id, draft); save(); render();
      U.toast(r.done ? 'Every point covered — nicely done' : 'Checked — see the list below');
    },
    'lc-email-tick': el => {
      const id = el.dataset.id, i = +el.dataset.i, sc = EMAILS.find(x => x.id === id); if (!sc || sc.items[i][1]) return;
      const r = emailRec(id), box = $('#lc-draft'); if (box) r.draft = box.value;
      const s = new Set(r.ticks || []); if (s.has(i)) s.delete(i); else s.add(i);
      r.ticks = [...s].sort((a, b) => a - b); r.done = sc.items.every((_, k) => s.has(k));
      save(); render();
    },
    'lc-email-copy': el => { const sc = EMAILS.find(x => x.id === el.dataset.id); if (sc) U.copyText(sc.model(sigName())); }
  });

  App.labCases = { CASES, EMAILS, renderCases, renderEmails, coachText, grade, build, checkEmail, AUTO, caseClient };
})();
