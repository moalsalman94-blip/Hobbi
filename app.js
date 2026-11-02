'use strict';

/* =========================================================
   محاسبة المحل — مشتريات، مبيعات، سندات، كشوفات حسابات
   كل البيانات محفوظة في المتصفح (localStorage)
   ========================================================= */

const DB_KEY = 'shop-accounting-v1';

/* ---------- أدوات عامة ---------- */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const round = n => Math.round((+n || 0) * 100) / 100;
const money = n => round(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const num = v => { const n = parseFloat(String(v ?? '').replace(',', '.')); return isFinite(n) ? n : 0; };
const byName = (a, b) => a.name.localeCompare(b.name, 'ar');

function today() {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

/* ---------- قاعدة البيانات ---------- */
function blankDb() {
  return {
    settings: { shopName: 'مؤسسة طريق القمة', currency: 'د.أ', openingCash: 0 },
    parties: [],   // {id, type:'customer'|'supplier', name, phone, opening, at}
    items: [],     // {id, name, unit, buyPrice, sellPrice, openingQty, at}
    invoices: [],  // {id, kind:'sale'|'purchase', no, date, partyId, pay:'cash'|'credit', lines:[{itemId,name,qty,price}], discount, note, at}
    payments: []   // {id, kind:'receipt'|'payment', no, date, partyId, amount, note, at}
  };
}

function normalizeDb(d) {
  const b = blankDb();
  if (!d || typeof d !== 'object') return b;
  d.settings = { ...b.settings, ...(d.settings || {}) };
  for (const k of ['parties', 'items', 'invoices', 'payments']) if (!Array.isArray(d[k])) d[k] = [];
  if (!d.settings.shopName || d.settings.shopName === 'محلي') d.settings.shopName = b.settings.shopName;
  // طريقة الدفع: نقدي أو ذمم
  for (const inv of d.invoices) {
    if (!inv.pay) inv.pay = inv.partyId && num(inv.paid) < invTotal(inv) ? 'credit' : 'cash';
    delete inv.paid;
  }
  return d;
}

function loadDb() {
  try { return normalizeDb(JSON.parse(localStorage.getItem(DB_KEY))); }
  catch (e) { return blankDb(); }
}

function save() {
  try { localStorage.setItem(DB_KEY, JSON.stringify(db)); }
  catch (e) { alert('تعذّر حفظ البيانات على هذا الجهاز. خذ نسخة احتياطية من الإعدادات.'); }
}

/* ---------- مسمّيات ---------- */
const KIND = { sale: 'بيع', purchase: 'شراء' };
const PAYMETHOD = { cash: 'نقدي', credit: 'ذمم' };
const PAY = { receipt: 'سند قبض', payment: 'سند صرف' };
const PTYPE = { customer: 'عميل', supplier: 'مورد' };
const PTYPES = { customer: 'العملاء', supplier: 'الموردين' };
const partyTypeFor = kind => (kind === 'sale' ? 'customer' : 'supplier');

const getParty = id => db.parties.find(p => p.id === id);
const getItem = id => db.items.find(i => i.id === id);
const partyName = id => getParty(id)?.name || '—';
const isCredit = inv => inv.pay === 'credit' && !!inv.partyId;
const cur = () => esc(db.settings.currency);

const subTotal = inv => round(inv.lines.reduce((s, l) => s + num(l.qty) * num(l.price), 0));
const invTotal = inv => round(subTotal(inv) - num(inv.discount));
const nextNo = list => list.reduce((m, x) => Math.max(m, +x.no || 0), 0) + 1;
const byDate = (a, b) => (a.date || '').localeCompare(b.date || '') || (a.at || 0) - (b.at || 0);

let db = loadDb();

/* ---------- الحسابات ---------- */
// كل حركة: مدين (debit) / دائن (credit). الرصيد = مدين − دائن
// موجب = عليه (مدين لنا)، سالب = له (دائن لنا)
function partyEntries(p) {
  const e = [];
  const ob = num(p.opening);
  if (ob) e.push({ date: '', at: 0, desc: 'رصيد افتتاحي', debit: p.type === 'customer' ? ob : 0, credit: p.type === 'supplier' ? ob : 0 });

  for (const inv of db.invoices) {
    // الفواتير النقدية لا تظهر في كشف الحساب، فقط الذمم
    if (inv.partyId !== p.id || !isCredit(inv)) continue;
    const t = invTotal(inv), sale = inv.kind === 'sale';
    e.push({ date: inv.date, at: inv.at, link: '#/invoice/' + inv.id, desc: `فاتورة ${KIND[inv.kind]} ذمم رقم ${inv.no}${inv.note ? ' — ' + inv.note : ''}`, debit: sale ? t : 0, credit: sale ? 0 : t });
  }
  for (const pm of db.payments) {
    if (pm.partyId !== p.id) continue;
    const r = pm.kind === 'receipt';
    e.push({ date: pm.date, at: pm.at, desc: `${PAY[pm.kind]} رقم ${pm.no}${pm.note ? ' — ' + pm.note : ''}`, debit: r ? 0 : num(pm.amount), credit: r ? num(pm.amount) : 0 });
  }
  return e.sort(byDate);
}

// الصندوق: مدين = وارد، دائن = صادر
function cashEntries() {
  const e = [];
  const ob = num(db.settings.openingCash);
  if (ob) e.push({ date: '', at: 0, desc: 'رصيد افتتاحي للصندوق', debit: ob > 0 ? ob : 0, credit: ob < 0 ? -ob : 0 });
  for (const inv of db.invoices) {
    if (isCredit(inv)) continue;
    const t = invTotal(inv), sale = inv.kind === 'sale';
    if (!t) continue;
    e.push({ date: inv.date, at: inv.at, link: '#/invoice/' + inv.id, desc: `فاتورة ${KIND[inv.kind]} نقدي رقم ${inv.no}${inv.partyId ? ' — ' + partyName(inv.partyId) : ''}`, debit: sale ? t : 0, credit: sale ? 0 : t });
  }
  for (const pm of db.payments) {
    const r = pm.kind === 'receipt';
    e.push({ date: pm.date, at: pm.at, desc: `${PAY[pm.kind]} رقم ${pm.no} — ${partyName(pm.partyId)}${pm.note ? ' — ' + pm.note : ''}`, debit: r ? num(pm.amount) : 0, credit: r ? 0 : num(pm.amount) });
  }
  return e.sort(byDate);
}

const entriesBalance = e => round(e.reduce((s, x) => s + x.debit - x.credit, 0));
const partyBalance = p => entriesBalance(partyEntries(p));

function partyBal(v) {
  v = round(v);
  if (v > 0) return `<span class="owes">${money(v)}</span> <small>عليه</small>`;
  if (v < 0) return `<span class="cred">${money(-v)}</span> <small>له</small>`;
  return money(0);
}
const cashBal = v => (round(v) < 0 ? '-' : '') + money(Math.abs(v));

function itemStock(it) {
  let q = num(it.openingQty);
  for (const inv of db.invoices) for (const l of inv.lines) {
    if (l.itemId === it.id) q += inv.kind === 'purchase' ? num(l.qty) : -num(l.qty);
  }
  return round(q);
}

function statementTable(entries, from, to, o) {
  let prev = 0, hasPrev = false;
  const rows = [];
  for (const e of entries) {
    if (from && (e.date || '') < from) { prev += e.debit - e.credit; hasPrev = true; continue; }
    if (to && e.date && e.date > to) continue;
    rows.push(e);
  }
  let bal = prev, td = 0, tc = 0;
  let html = `<div class="table-wrap"><table class="tbl"><thead><tr>
    <th>التاريخ</th><th>البيان</th><th class="num">${o.dr}</th><th class="num">${o.cr}</th><th class="num">الرصيد</th></tr></thead><tbody>`;
  if (hasPrev) html += `<tr class="muted-row"><td>${esc(from)}</td><td>رصيد ما قبل الفترة</td><td></td><td></td><td class="num">${o.bal(prev)}</td></tr>`;
  for (const e of rows) {
    bal += e.debit - e.credit; td += e.debit; tc += e.credit;
    const d = e.link ? `<a href="${e.link}">${esc(e.desc)}</a>` : esc(e.desc);
    html += `<tr><td>${esc(e.date)}</td><td>${d}</td>
      <td class="num">${e.debit ? money(e.debit) : ''}</td><td class="num">${e.credit ? money(e.credit) : ''}</td>
      <td class="num">${o.bal(bal)}</td></tr>`;
  }
  if (!rows.length && !hasPrev) html += `<tr><td colspan="5" class="empty">لا توجد حركات</td></tr>`;
  html += `</tbody><tfoot><tr><th colspan="2">مجموع الفترة</th><th class="num">${money(td)}</th><th class="num">${money(tc)}</th><th class="num">${o.bal(bal)}</th></tr></tfoot></table></div>`;
  return { html, balance: round(bal) };
}

/* ---------- واجهة: أدوات ---------- */
const app = $('#app');

function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => t.classList.remove('show'), 1800);
}

function openDialog(title, body, onSave) {
  const dlg = $('#dlg'), f = $('#dlgForm');
  f.innerHTML = `<h3>${title}</h3>${body}
    <div class="actions"><button class="btn primary" type="submit">حفظ</button>
    <button class="btn" type="button" data-close>إلغاء</button></div>`;
  f.onsubmit = e => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(f));
    if (onSave(data) !== false) dlg.close();
  };
  $('[data-close]', f).onclick = () => dlg.close();
  dlg.showModal();
  $('input, select', f)?.focus();
}

function partyOptions(selected, types = ['customer', 'supplier']) {
  return types.map(t => {
    const ps = db.parties.filter(p => p.type === t).sort(byName);
    if (!ps.length) return '';
    return `<optgroup label="${PTYPES[t]}">${ps.map(p => `<option value="${p.id}" ${p.id === selected ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}</optgroup>`;
  }).join('');
}

function partyDialog(type, p, after) {
  const isNew = !p;
  p = p || { type, name: '', phone: '', opening: '' };
  const obHint = type === 'customer' ? 'مبلغ مستحق على العميل قبل بدء البرنامج' : 'مبلغ مستحق للمورد قبل بدء البرنامج';
  openDialog(isNew ? `${PTYPE[type]} جديد` : `تعديل ${PTYPE[type]}`, `
    <label>الاسم<input name="name" required value="${esc(p.name)}"></label>
    <label>الهاتف<input name="phone" inputmode="tel" value="${esc(p.phone)}"></label>
    <label>رصيد افتتاحي<input name="opening" type="number" step="any" min="0" value="${esc(p.opening)}">
      <span class="hint">${obHint}</span></label>`,
    d => {
      const name = d.name.trim();
      if (!name) { alert('اكتب الاسم'); return false; }
      if (db.parties.some(x => x.type === type && x.id !== p.id && x.name.trim() === name)) {
        alert('في ' + PTYPE[type] + ' بنفس الاسم'); return false;
      }
      if (isNew) {
        p = { id: uid(), type, at: Date.now() };
        db.parties.push(p);
      }
      Object.assign(p, { name, phone: d.phone.trim(), opening: round(num(d.opening)) });
      save(); toast('تم الحفظ');
      after && after(p);
    });
}

function itemDialog(it, after) {
  const isNew = !it;
  it = it || { name: '', unit: '', buyPrice: '', sellPrice: '', openingQty: '' };
  openDialog(isNew ? 'صنف جديد' : 'تعديل صنف', `
    <label>اسم الصنف<input name="name" required value="${esc(it.name)}"></label>
    <label>الوحدة<input name="unit" placeholder="حبة، كيلو، كرتونة..." value="${esc(it.unit)}"></label>
    <div class="grid">
      <label>سعر الشراء<input name="buyPrice" type="number" step="any" min="0" value="${esc(it.buyPrice)}"></label>
      <label>سعر البيع<input name="sellPrice" type="number" step="any" min="0" value="${esc(it.sellPrice)}"></label>
    </div>
    <label>الكمية الافتتاحية<input name="openingQty" type="number" step="any" value="${esc(it.openingQty)}">
      <span class="hint">الكمية الموجودة بالمحل قبل بدء البرنامج</span></label>`,
    d => {
      const name = d.name.trim();
      if (!name) { alert('اكتب اسم الصنف'); return false; }
      if (db.items.some(x => x.id !== it.id && x.name.trim() === name)) { alert('في صنف بنفس الاسم'); return false; }
      if (isNew) { it = { id: uid(), at: Date.now() }; db.items.push(it); }
      Object.assign(it, { name, unit: d.unit.trim(), buyPrice: round(num(d.buyPrice)), sellPrice: round(num(d.sellPrice)), openingQty: round(num(d.openingQty)) });
      // تحديث أسماء الصنف في الفواتير القديمة
      for (const inv of db.invoices) for (const l of inv.lines) if (l.itemId === it.id) l.name = it.name;
      save(); toast('تم الحفظ');
      after && after(it);
    });
}

function paymentDialog(pm, kind, partyId, after) {
  const isNew = !pm;
  kind = pm ? pm.kind : (kind || 'receipt');
  pm = pm || { kind, no: nextNo(db.payments.filter(x => x.kind === kind)), date: today(), partyId: partyId || '', amount: '', note: '' };
  const ptype = kind === 'receipt' ? 'customer' : 'supplier';
  if (!db.parties.some(p => p.type === ptype)) { alert(`أضف ${PTYPE[ptype]} أولاً من صفحة ${PTYPES[ptype]}`); return; }
  openDialog(isNew ? `${PAY[kind]} جديد` : `تعديل ${PAY[kind]} رقم ${pm.no}`, `
    <p class="hint" style="margin:0">${kind === 'receipt' ? 'استلام مبلغ من عميل' : 'دفع مبلغ لمورد'}</p>
    <div class="grid">
      <label>الرقم<input name="no" type="number" min="1" required value="${esc(pm.no)}"></label>
      <label>التاريخ<input name="date" type="date" required value="${esc(pm.date)}"></label>
    </div>
    <label>${kind === 'receipt' ? 'العميل' : 'المورد'}<select name="partyId" required><option value="">— اختر —</option>${partyOptions(pm.partyId, [ptype])}</select></label>
    <label>المبلغ (${cur()})<input name="amount" type="number" step="any" min="0" required value="${esc(pm.amount)}"></label>
    <label>ملاحظة<input name="note" value="${esc(pm.note)}"></label>`,
    d => {
      const k = kind;
      const amount = round(num(d.amount));
      if (!d.partyId) { alert('اختر ' + (k === 'receipt' ? 'العميل' : 'المورد')); return false; }
      if (!(amount > 0)) { alert('اكتب المبلغ'); return false; }
      if (!d.date) { alert('اختر التاريخ'); return false; }
      const no = parseInt(d.no, 10) || nextNo(db.payments.filter(x => x.kind === k));
      if (db.payments.some(x => x.kind === k && x.id !== pm.id && +x.no === no)) { alert(`رقم ${PAY[k]} مستخدم`); return false; }
      if (isNew) { pm = { id: uid(), at: Date.now() }; db.payments.push(pm); }
      Object.assign(pm, { kind: k, no, date: d.date, partyId: d.partyId, amount, note: d.note.trim() });
      save(); toast('تم الحفظ');
      after && after(pm);
    });
}

/* ---------- الصفحات ---------- */
function home() {
  const t = today(), m = t.slice(0, 7);
  const sum = (kind, pred) => db.invoices.filter(i => i.kind === kind && pred(i.date || '')).reduce((s, i) => s + invTotal(i), 0);
  const recv = db.parties.filter(p => p.type === 'customer').reduce((s, p) => s + Math.max(0, partyBalance(p)), 0);
  const payable = db.parties.filter(p => p.type === 'supplier').reduce((s, p) => s + Math.max(0, -partyBalance(p)), 0);
  const cash = entriesBalance(cashEntries());
  const c = `<small>${cur()}</small>`;

  app.innerHTML = `
    <div class="welcome"><h2>${esc(db.settings.shopName)}</h2></div>
    <div class="tiles">
      <a class="tile purchase" href="#/new/purchase"><span class="ic">📦</span>فاتورة شراء</a>
      <a class="tile sale" href="#/new/sale"><span class="ic">🧾</span>فاتورة بيع</a>
      <button class="tile receipt" type="button" id="qReceipt"><span class="ic">💵</span>سند قبض</button>
      <button class="tile payment" type="button" id="qPayment"><span class="ic">💸</span>سند صرف</button>
    </div>
    <div class="stats">
      <div class="stat"><div class="k">مبيعات اليوم</div><div class="v">${money(sum('sale', d => d === t))} ${c}</div></div>
      <div class="stat"><div class="k">مبيعات هذا الشهر</div><div class="v">${money(sum('sale', d => d.startsWith(m)))} ${c}</div></div>
      <div class="stat"><div class="k">مشتريات هذا الشهر</div><div class="v">${money(sum('purchase', d => d.startsWith(m)))} ${c}</div></div>
      <div class="stat"><div class="k">رصيد الصندوق</div><div class="v">${cashBal(cash)} ${c}</div></div>
      <div class="stat"><div class="k">ديون لنا على العملاء</div><div class="v owes">${money(recv)} ${c}</div></div>
      <div class="stat"><div class="k">ديون علينا للموردين</div><div class="v">${money(payable)} ${c}</div></div>
    </div>`;
  $('#qReceipt').onclick = () => paymentDialog(null, 'receipt', '', () => render());
  $('#qPayment').onclick = () => paymentDialog(null, 'payment', '', () => render());
}

function invoiceTable(list, showKind = true) {
  if (!list.length) return `<p class="hint">لا توجد فواتير بعد.</p>`;
  let tc = 0, tr = 0;
  const rows = list.map(i => {
    const t = invTotal(i), cr = isCredit(i);
    if (cr) tr += t; else tc += t;
    return `<tr class="clickable" data-href="#/invoice/${i.id}">
      ${showKind ? `<td><span class="tag ${i.kind}">${KIND[i.kind]}</span></td>` : ''}
      <td>${esc(i.no)}</td><td>${esc(i.date)}</td><td>${esc(partyName(i.partyId))}</td>
      <td><span class="tag ${cr ? 'credit' : 'cash'}">${PAYMETHOD[cr ? 'credit' : 'cash']}</span></td>
      <td class="num">${money(t)}</td></tr>`;
  }).join('');
  return `<div class="table-wrap"><table class="tbl"><thead><tr>
    ${showKind ? '<th>النوع</th>' : ''}<th>الرقم</th><th>التاريخ</th><th>الحساب</th><th>الدفع</th>
    <th class="num">الصافي</th></tr></thead>
    <tbody>${rows}</tbody>
    <tfoot>
      <tr><th colspan="${showKind ? 5 : 4}">مجموع النقدي</th><th class="num">${money(tc)}</th></tr>
      <tr><th colspan="${showKind ? 5 : 4}">مجموع الذمم</th><th class="num">${money(tr)}</th></tr>
      <tr><th colspan="${showKind ? 5 : 4}">الإجمالي (${list.length} فاتورة)</th><th class="num">${money(tc + tr)}</th></tr>
    </tfoot></table></div>`;
}

function bindRowLinks(root = app) {
  $$('tr[data-href]', root).forEach(tr => tr.onclick = e => {
    if (e.target.closest('a, button')) return;
    location.hash = tr.dataset.href;
  });
}

/* ----- فاتورة جديدة / تعديل ----- */
function newInvoice(kind) {
  if (!KIND[kind]) kind = 'sale';
  invoiceForm({
    kind, no: nextNo(db.invoices.filter(i => i.kind === kind)), date: today(), partyId: '',
    pay: 'cash', lines: [{ itemId: null, name: '', qty: 1, price: '' }], discount: '', note: ''
  }, true);
}

function editInvoice(id) {
  const inv = db.invoices.find(i => i.id === id);
  if (!inv) return notFound();
  invoiceForm(JSON.parse(JSON.stringify(inv)), false);
}

function invoiceForm(inv, isNew) {
  const kind = inv.kind, ptype = partyTypeFor(kind);
  const priceKey = kind === 'sale' ? 'sellPrice' : 'buyPrice';

  app.innerHTML = `
    <div class="page-head"><h2>${isNew ? `فاتورة ${KIND[kind]} جديدة` : `تعديل فاتورة ${KIND[kind]} رقم ${esc(inv.no)}`}</h2></div>
    <form id="invForm" class="card" novalidate>
      <div class="grid">
        <label>رقم الفاتورة<input name="no" type="number" min="1" required value="${esc(inv.no)}"></label>
        <label>التاريخ<input name="date" type="date" required value="${esc(inv.date)}"></label>
      </div>
      <div class="paybox">
        <span class="paylbl">طريقة الدفع</span>
        <label class="radio"><input type="radio" name="pay" value="cash" ${inv.pay !== 'credit' ? 'checked' : ''}> 💵 نقدي</label>
        <label class="radio"><input type="radio" name="pay" value="credit" ${inv.pay === 'credit' ? 'checked' : ''}> 📒 ذمم (على الحساب)</label>
      </div>
      <div class="grid">
        <label><span id="partyLbl"></span>
          <select name="partyId" id="partySel"></select></label>
        <button type="button" class="btn" id="addParty">➕ ${PTYPE[ptype]} جديد</button>
      </div>
      <p class="hint" id="payHint"></p>

      <h3>الأصناف</h3>
      <div class="table-wrap"><table class="tbl lines">
        <thead><tr><th>الصنف</th><th>الكمية</th><th>السعر</th><th class="num">المجموع</th><th></th></tr></thead>
        <tbody id="lines"></tbody>
      </table></div>
      <datalist id="itemList">${[...db.items].sort(byName).map(i => `<option value="${esc(i.name)}">`).join('')}</datalist>
      <div class="actions" style="margin-top:8px"><button type="button" class="btn" id="addLine">➕ سطر جديد</button></div>
      <p class="hint">اكتب اسم الصنف أو اختاره من القائمة. إذا كان صنف جديد بينضاف للأصناف تلقائياً.</p>

      <div class="totals">
        <div class="sum">المجموع<b id="tSub"></b></div>
        <label>الخصم<input name="discount" type="number" step="any" min="0" value="${esc(inv.discount)}"></label>
        <div class="sum">الصافي<b id="tNet"></b></div>
      </div>
      <label>ملاحظات<input name="note" value="${esc(inv.note)}"></label>

      <div class="actions">
        <button class="btn primary" type="submit">💾 حفظ الفاتورة</button>
        <a class="btn" href="${isNew ? '#/invoices/' + kind : '#/invoice/' + inv.id}">إلغاء</a>
      </div>
    </form>`;

  const form = $('#invForm'), tbody = $('#lines');

  function lineRow(l, i) {
    return `<tr>
      <td><input list="itemList" data-i="${i}" data-f="name" value="${esc(l.name)}" placeholder="اسم الصنف"></td>
      <td><input type="number" step="any" min="0" data-i="${i}" data-f="qty" value="${esc(l.qty)}"></td>
      <td><input type="number" step="any" min="0" data-i="${i}" data-f="price" value="${esc(l.price)}"></td>
      <td class="num" data-total="${i}">${money(num(l.qty) * num(l.price))}</td>
      <td><button type="button" class="btn sm danger" data-del="${i}" title="حذف السطر">✕</button></td></tr>`;
  }
  function renderLines() { tbody.innerHTML = inv.lines.map(lineRow).join(''); recalc(); }

  const payMethod = () => form.querySelector('[name=pay]:checked').value;
  const who = kind === 'sale' ? 'العميل' : 'المورد';
  function updatePay(selected) {
    const credit = payMethod() === 'credit';
    const sel = selected !== undefined ? selected : form.partyId.value;
    $('#partyLbl').textContent = credit ? who : `${who} (اختياري)`;
    $('#partySel').innerHTML = `<option value="">${credit ? '— اختر —' : 'نقدي بدون اسم'}</option>${partyOptions(sel, [ptype])}`;
    $('#payHint').textContent = credit
      ? `فاتورة ذمم: المبلغ بيتسجل على حساب ${who} وبيظهر بكشف الحساب.`
      : 'فاتورة نقدية: المبلغ بينحسب بالصندوق وما بيظهر بكشف الحساب.';
  }
  function recalc() {
    inv.discount = form.discount.value;
    $('#tSub').textContent = money(subTotal(inv));
    $('#tNet').textContent = money(invTotal(inv));
  }

  tbody.addEventListener('input', e => {
    const el = e.target, i = +el.dataset.i, f = el.dataset.f;
    if (!f) return;
    const l = inv.lines[i];
    l[f] = el.value;
    if (f === 'name') {
      const it = db.items.find(x => x.name.trim() === el.value.trim());
      l.itemId = it ? it.id : null;
      if (it && !num(l.price) && num(it[priceKey])) {
        l.price = it[priceKey];
        $(`[data-i="${i}"][data-f="price"]`, tbody).value = l.price;
      }
    }
    $(`[data-total="${i}"]`, tbody).textContent = money(num(l.qty) * num(l.price));
    recalc();
  });
  tbody.addEventListener('click', e => {
    const b = e.target.closest('[data-del]');
    if (!b) return;
    inv.lines.splice(+b.dataset.del, 1);
    if (!inv.lines.length) inv.lines.push({ itemId: null, name: '', qty: 1, price: '' });
    renderLines();
  });
  $('#addLine').onclick = () => {
    inv.lines.push({ itemId: null, name: '', qty: 1, price: '' });
    renderLines();
    $(`[data-i="${inv.lines.length - 1}"][data-f="name"]`, tbody).focus();
  };
  form.discount.oninput = recalc;
  $$('[name=pay]', form).forEach(r => r.onchange = () => updatePay());
  $('#addParty').onclick = () => partyDialog(ptype, null, p => updatePay(p.id));

  form.onsubmit = e => {
    e.preventDefault();
    const lines = inv.lines
      .map(l => ({ itemId: l.itemId, name: String(l.name || '').trim(), qty: round(num(l.qty)), price: round(num(l.price)) }))
      .filter(l => l.name);
    if (!lines.length) return alert('أضف صنف واحد على الأقل');
    if (lines.some(l => !(l.qty > 0))) return alert('في سطر كميته صفر أو فاضية');
    const no = parseInt(form.no.value, 10);
    if (!(no > 0)) return alert('اكتب رقم الفاتورة');
    if (db.invoices.some(x => x.kind === kind && x.id !== inv.id && +x.no === no)) return alert('رقم الفاتورة مستخدم بفاتورة ثانية');
    if (!form.date.value) return alert('اختر التاريخ');
    const discount = round(num(form.discount.value));
    const total = round(lines.reduce((s, l) => s + l.qty * l.price, 0) - discount);
    if (total < 0) return alert('الخصم أكبر من المجموع');
    const partyId = form.partyId.value;
    const pay = payMethod();
    if (pay === 'credit' && !partyId) return alert(`فاتورة الذمم لازم تختار فيها ${who}`);

    // ربط الأصناف أو إنشاؤها
    for (const l of lines) {
      let it = getItem(l.itemId);
      if (!it || it.name.trim() !== l.name) it = db.items.find(x => x.name.trim() === l.name);
      if (!it) {
        it = { id: uid(), at: Date.now(), name: l.name, unit: '', buyPrice: kind === 'purchase' ? l.price : 0, sellPrice: kind === 'sale' ? l.price : 0, openingQty: 0 };
        db.items.push(it);
      } else if (kind === 'purchase' && l.price > 0) {
        it.buyPrice = l.price; // آخر سعر شراء
      }
      l.itemId = it.id;
    }

    let rec = db.invoices.find(x => x.id === inv.id);
    if (!rec) { rec = { id: uid(), at: Date.now(), kind }; db.invoices.push(rec); }
    Object.assign(rec, { no, date: form.date.value, pay, partyId, lines, discount, note: form.note.value.trim() });
    save();
    toast('تم حفظ الفاتورة');
    location.hash = '#/invoice/' + rec.id;
  };

  updatePay(inv.partyId || '');
  renderLines();
}

/* ----- عرض فاتورة ----- */
function viewInvoice(id) {
  const inv = db.invoices.find(i => i.id === id);
  if (!inv) return notFound();
  const t = invTotal(inv), party = getParty(inv.partyId), cr = isCredit(inv);
  app.innerHTML = `
    <div class="page-head"><h2>فاتورة ${KIND[inv.kind]} رقم ${esc(inv.no)}</h2>
      <div class="btn-row">
        <button class="btn primary" type="button" onclick="print()">🖨️ طباعة</button>
        <a class="btn" href="#/edit/${inv.id}">✏️ تعديل</a>
        ${party && cr ? `<a class="btn" href="#/statement/${party.id}">📄 كشف حساب</a>` : ''}
        <button class="btn danger" type="button" id="delInv">🗑️ حذف</button>
      </div></div>
    <div class="card">
      <div class="doc-head"><h2>${esc(db.settings.shopName)}</h2><h2>فاتورة ${KIND[inv.kind]}</h2></div>
      <div class="doc-meta">
        <div><span>رقم الفاتورة: </span>${esc(inv.no)}</div>
        <div><span>التاريخ: </span>${esc(inv.date)}</div>
        <div><span>طريقة الدفع: </span><b>${PAYMETHOD[cr ? 'credit' : 'cash']}</b></div>
        <div><span>${inv.kind === 'sale' ? 'العميل' : 'المورد'}: </span>${esc(partyName(inv.partyId))}</div>
        ${party?.phone ? `<div><span>الهاتف: </span>${esc(party.phone)}</div>` : ''}
      </div>
      <div class="table-wrap"><table class="tbl"><thead><tr><th>#</th><th>الصنف</th><th class="num">الكمية</th><th class="num">السعر</th><th class="num">المجموع</th></tr></thead>
        <tbody>${inv.lines.map((l, i) => `<tr><td>${i + 1}</td><td>${esc(l.name)}</td><td class="num">${esc(l.qty)}</td><td class="num">${money(l.price)}</td><td class="num">${money(num(l.qty) * num(l.price))}</td></tr>`).join('')}</tbody>
      </table></div>
      <div class="doc-sum">
        <div><span>المجموع</span><b>${money(subTotal(inv))}</b></div>
        ${num(inv.discount) ? `<div><span>الخصم</span><b>${money(inv.discount)}</b></div>` : ''}
        <div><span>الصافي</span><b>${money(t)} ${cur()}</b></div>
      </div>
      ${inv.note ? `<p><b>ملاحظات:</b> ${esc(inv.note)}</p>` : ''}
    </div>`;
  $('#delInv').onclick = () => {
    if (!confirm(`متأكد بدك تحذف فاتورة ${KIND[inv.kind]} رقم ${inv.no}؟`)) return;
    db.invoices = db.invoices.filter(x => x.id !== inv.id);
    save(); toast('تم الحذف');
    location.hash = '#/invoices/' + inv.kind;
  };
}

/* ----- قائمة الفواتير ----- */
function invoicesList(kind) {
  if (!KIND[kind]) kind = 'sale';
  app.innerHTML = `
    <div class="page-head"><h2>فواتير ${kind === 'sale' ? 'البيع' : 'الشراء'}</h2>
      <div class="btn-row"><a class="btn primary" href="#/new/${kind}">➕ فاتورة ${KIND[kind]} جديدة</a>
      <button class="btn" type="button" onclick="print()">🖨️ طباعة</button></div></div>
    <div class="card filters">
      <label>بحث<input id="fq" placeholder="اسم الحساب أو رقم الفاتورة"></label>
      <label>من تاريخ<input id="ff" type="date"></label>
      <label>إلى تاريخ<input id="ft" type="date"></label>
      <label>طريقة الدفع<select id="fs"><option value="">الكل</option><option value="cash">نقدي</option><option value="credit">ذمم</option></select></label>
    </div>
    <div class="card" id="invList"></div>`;
  const draw = () => {
    const q = $('#fq').value.trim(), f = $('#ff').value, t = $('#ft').value, s = $('#fs').value;
    const list = db.invoices.filter(i => i.kind === kind)
      .filter(i => !q || String(i.no) === q || partyName(i.partyId).includes(q))
      .filter(i => (!f || i.date >= f) && (!t || i.date <= t))
      .filter(i => !s || (s === 'credit') === isCredit(i))
      .sort(byDate).reverse();
    $('#invList').innerHTML = invoiceTable(list, false);
    bindRowLinks($('#invList'));
  };
  $$('.filters input, .filters select').forEach(el => el.oninput = draw);
  draw();
}

/* ----- السندات ----- */
function paymentsPage(kind) {
  if (!PAY[kind]) kind = 'receipt';
  const who = kind === 'receipt' ? 'العميل' : 'المورد';
  app.innerHTML = `
    <div class="page-head"><h2>${kind === 'receipt' ? 'سندات القبض' : 'سندات الصرف'}</h2>
      <div class="btn-row">
        <button class="btn primary" type="button" id="nV">${kind === 'receipt' ? '💵' : '💸'} ${PAY[kind]} جديد</button>
        <button class="btn" type="button" onclick="print()">🖨️ طباعة</button>
      </div></div>
    <div class="card filters">
      <label>بحث<input id="pq" placeholder="اسم ${who} أو ملاحظة"></label>
      <label>من تاريخ<input id="pf" type="date"></label>
      <label>إلى تاريخ<input id="pt" type="date"></label>
    </div>
    <div class="card" id="payList"></div>`;
  const draw = () => {
    const q = $('#pq').value.trim(), f = $('#pf').value, t = $('#pt').value;
    const list = db.payments
      .filter(p => p.kind === kind)
      .filter(p => !q || partyName(p.partyId).includes(q) || (p.note || '').includes(q) || String(p.no) === q)
      .filter(p => (!f || p.date >= f) && (!t || p.date <= t))
      .sort(byDate).reverse();
    let tot = 0;
    const rows = list.map(p => {
      tot += num(p.amount);
      return `<tr><td>${esc(p.no)}</td><td>${esc(p.date)}</td>
        <td><a href="#/statement/${p.partyId}">${esc(partyName(p.partyId))}</a></td><td class="num">${money(p.amount)}</td><td>${esc(p.note)}</td>
        <td><div class="btn-row"><button class="btn sm" data-edit="${p.id}">تعديل</button><button class="btn sm danger" data-del="${p.id}">حذف</button></div></td></tr>`;
    }).join('');
    $('#payList').innerHTML = list.length ? `<div class="table-wrap"><table class="tbl"><thead><tr>
      <th>الرقم</th><th>التاريخ</th><th>${who}</th><th class="num">المبلغ</th><th>ملاحظة</th><th></th></tr></thead>
      <tbody>${rows}</tbody>
      <tfoot><tr><th colspan="3">المجموع (${list.length})</th><th class="num">${money(tot)}</th><th colspan="2"></th></tr></tfoot></table></div>`
      : '<p class="hint">لا توجد سندات.</p>';
  };
  $('#payList').onclick = e => {
    const ed = e.target.closest('[data-edit]'), dl = e.target.closest('[data-del]');
    if (ed) paymentDialog(db.payments.find(p => p.id === ed.dataset.edit), null, null, draw);
    if (dl) {
      const p = db.payments.find(x => x.id === dl.dataset.del);
      if (p && confirm(`متأكد بدك تحذف ${PAY[p.kind]} رقم ${p.no}؟`)) {
        db.payments = db.payments.filter(x => x.id !== p.id); save(); toast('تم الحذف'); draw();
      }
    }
  };
  $('#nV').onclick = () => paymentDialog(null, kind, '', draw);
  $$('.filters input, .filters select').forEach(el => el.oninput = draw);
  draw();
}

/* ----- العملاء / الموردين ----- */
function partiesPage(type) {
  if (!PTYPE[type]) type = 'customer';
  app.innerHTML = `
    <div class="page-head"><h2>${PTYPES[type]}</h2>
      <div class="btn-row"><button class="btn primary" type="button" id="addP">➕ ${PTYPE[type]} جديد</button>
      <button class="btn" type="button" onclick="print()">🖨️ طباعة</button></div></div>
    <div class="card filters"><label>بحث<input id="sq" placeholder="الاسم أو الهاتف"></label>
      <label>عرض<select id="sf"><option value="">الكل</option><option value="nz">اللي إلهم أو عليهم رصيد</option></select></label></div>
    <div class="card" id="pList"></div>`;
  const draw = () => {
    const q = $('#sq').value.trim(), nz = $('#sf').value === 'nz';
    const list = db.parties.filter(p => p.type === type)
      .filter(p => !q || p.name.includes(q) || (p.phone || '').includes(q))
      .map(p => ({ p, b: partyBalance(p) }))
      .filter(x => !nz || Math.abs(x.b) > 0.004)
      .sort((a, b) => byName(a.p, b.p));
    const total = list.reduce((s, x) => s + x.b, 0);
    $('#pList').innerHTML = list.length ? `<div class="table-wrap"><table class="tbl"><thead><tr>
      <th>الاسم</th><th>الهاتف</th><th class="num">الرصيد</th><th></th></tr></thead><tbody>
      ${list.map(({ p, b }) => `<tr class="clickable" data-href="#/statement/${p.id}"><td>${esc(p.name)}</td><td>${esc(p.phone)}</td><td class="num">${partyBal(b)}</td>
        <td><div class="btn-row"><a class="btn sm" href="#/statement/${p.id}">كشف حساب</a>
        <button class="btn sm" data-edit="${p.id}">تعديل</button><button class="btn sm danger" data-del="${p.id}">حذف</button></div></td></tr>`).join('')}
      </tbody><tfoot><tr><th colspan="2">الإجمالي (${list.length})</th><th class="num">${partyBal(total)}</th><th></th></tr></tfoot></table></div>`
      : `<p class="hint">لا يوجد ${PTYPES[type]} بعد.</p>`;
    bindRowLinks($('#pList'));
  };
  $('#pList').onclick = e => {
    const ed = e.target.closest('[data-edit]'), dl = e.target.closest('[data-del]');
    if (ed) partyDialog(type, getParty(ed.dataset.edit), draw);
    if (dl) {
      const p = getParty(dl.dataset.del);
      if (db.invoices.some(i => i.partyId === p.id) || db.payments.some(x => x.partyId === p.id)) {
        return alert('ما بنقدر نحذفه لأنه عليه فواتير أو سندات. احذفها أولاً.');
      }
      if (confirm(`متأكد بدك تحذف ${p.name}؟`)) { db.parties = db.parties.filter(x => x.id !== p.id); save(); toast('تم الحذف'); draw(); }
    }
  };
  $('#addP').onclick = () => partyDialog(type, null, draw);
  $$('.filters input, .filters select').forEach(el => el.oninput = draw);
  draw();
}

/* ----- الأصناف ----- */
function itemsPage() {
  app.innerHTML = `
    <div class="page-head"><h2>الأصناف والمخزون</h2>
      <div class="btn-row"><button class="btn primary" type="button" id="addI">➕ صنف جديد</button>
      <button class="btn" type="button" onclick="print()">🖨️ طباعة</button></div></div>
    <div class="card filters"><label>بحث<input id="iq" placeholder="اسم الصنف"></label></div>
    <div class="card" id="iList"></div>`;
  const draw = () => {
    const q = $('#iq').value.trim();
    const list = db.items.filter(i => !q || i.name.includes(q)).sort(byName);
    let value = 0;
    $('#iList').innerHTML = list.length ? `<div class="table-wrap"><table class="tbl"><thead><tr>
      <th>الصنف</th><th>الوحدة</th><th class="num">سعر الشراء</th><th class="num">سعر البيع</th><th class="num">الكمية الموجودة</th><th class="num">قيمة المخزون</th><th></th></tr></thead><tbody>
      ${list.map(i => {
        const s = itemStock(i), v = Math.max(0, s) * num(i.buyPrice);
        value += v;
        return `<tr><td>${esc(i.name)}</td><td>${esc(i.unit)}</td><td class="num">${money(i.buyPrice)}</td><td class="num">${money(i.sellPrice)}</td>
          <td class="num ${s < 0 ? 'owes' : ''}">${s}</td><td class="num">${money(v)}</td>
          <td><div class="btn-row"><button class="btn sm" data-edit="${i.id}">تعديل</button><button class="btn sm danger" data-del="${i.id}">حذف</button></div></td></tr>`;
      }).join('')}
      </tbody><tfoot><tr><th colspan="5">قيمة المخزون الإجمالية (بسعر الشراء)</th><th class="num">${money(value)}</th><th></th></tr></tfoot></table></div>`
      : '<p class="hint">لا توجد أصناف بعد. الأصناف بتنضاف تلقائياً لما تكتبها بالفواتير، أو بتقدر تضيفها من هون.</p>';
  };
  $('#iList').onclick = e => {
    const ed = e.target.closest('[data-edit]'), dl = e.target.closest('[data-del]');
    if (ed) itemDialog(getItem(ed.dataset.edit), draw);
    if (dl) {
      const it = getItem(dl.dataset.del);
      if (db.invoices.some(inv => inv.lines.some(l => l.itemId === it.id))) return alert('ما بنقدر نحذف الصنف لأنه موجود بفواتير.');
      if (confirm(`متأكد بدك تحذف ${it.name}؟`)) { db.items = db.items.filter(x => x.id !== it.id); save(); toast('تم الحذف'); draw(); }
    }
  };
  $('#addI').onclick = () => itemDialog(null, draw);
  $('#iq').oninput = draw;
  draw();
}

/* ----- كشف حساب ----- */
function statementPage(arg) {
  const st = statementPage.state || (statementPage.state = { from: '', to: '' });
  const p = getParty(arg);
  const type = p ? p.type : (PTYPE[arg] ? arg : 'customer');
  const partyId = p ? p.id : '';
  app.innerHTML = `
    <div class="page-head"><h2>كشف حساب ${PTYPE[type]}</h2>
      <div class="btn-row">${p ? `<button class="btn primary" type="button" onclick="print()">🖨️ طباعة</button>
        <button class="btn" type="button" id="stPay">${p.type === 'customer' ? '💵 سند قبض' : '💸 سند صرف'}</button>` : ''}</div></div>
    <div class="card filters">
      <label>${type === 'customer' ? 'العميل' : 'المورد'}<select id="sp"><option value="">— اختر —</option>${partyOptions(partyId, [type])}</select></label>
      <label>من تاريخ<input id="sf" type="date" value="${st.from}"></label>
      <label>إلى تاريخ<input id="stt" type="date" value="${st.to}"></label>
    </div>
    <div class="card" id="stBody"></div>`;

  $('#sp').onchange = e => { location.hash = '#/statement/' + (e.target.value || type); };
  const draw = () => {
    st.from = $('#sf').value; st.to = $('#stt').value;
    if (!p) {
      $('#stBody').innerHTML = db.parties.some(x => x.type === type) ? `<p class="hint">اختر ${type === 'customer' ? 'العميل' : 'المورد'} من فوق.</p>`
        : `<p class="hint">لا يوجد ${PTYPES[type]} بعد.</p>`;
      return;
    }
    const { html, balance } = statementTable(partyEntries(p), st.from, st.to, { dr: 'مدين (عليه)', cr: 'دائن (له)', bal: partyBal });
    const period = st.from || st.to ? `الفترة: ${st.from || 'البداية'} — ${st.to || today()}` : `حتى تاريخ ${today()}`;
    let verdict = 'الحساب مسكّر (الرصيد صفر)';
    if (balance > 0) verdict = `الرصيد المستحق على ${esc(p.name)}: ${money(balance)} ${cur()}`;
    if (balance < 0) verdict = `الرصيد المستحق لـ ${esc(p.name)}: ${money(-balance)} ${cur()}`;
    $('#stBody').innerHTML = `
      <div class="doc-head"><h2>${esc(db.settings.shopName)}</h2><h2>كشف حساب ${PTYPE[p.type]}</h2></div>
      <div class="doc-meta"><div><span>الاسم: </span><b>${esc(p.name)}</b></div>
        ${p.phone ? `<div><span>الهاتف: </span>${esc(p.phone)}</div>` : ''}<div>${period}</div></div>
      ${html}
      <div class="balance-box">${verdict}</div>
      <p class="hint no-print">كشف الحساب بيعرض فواتير الذمم والسندات بس. الفواتير النقدية ما بتظهر فيه.</p>`;
  };
  $('#sf').oninput = draw; $('#stt').oninput = draw;
  if (p) $('#stPay').onclick = () => paymentDialog(null, p.type === 'customer' ? 'receipt' : 'payment', p.id, draw);
  draw();
}

/* ----- الصندوق ----- */
function cashPage() {
  const st = cashPage.state || (cashPage.state = { from: '', to: '' });
  app.innerHTML = `
    <div class="page-head"><h2>حركة الصندوق (الكاش)</h2>
      <div class="btn-row"><button class="btn primary" type="button" onclick="print()">🖨️ طباعة</button></div></div>
    <div class="card filters">
      <label>من تاريخ<input id="cf" type="date" value="${st.from}"></label>
      <label>إلى تاريخ<input id="ct" type="date" value="${st.to}"></label>
    </div>
    <div class="card" id="cBody"></div>`;
  const draw = () => {
    st.from = $('#cf').value; st.to = $('#ct').value;
    const { html, balance } = statementTable(cashEntries(), st.from, st.to, { dr: 'وارد', cr: 'صادر', bal: cashBal });
    $('#cBody').innerHTML = `
      <div class="print-only"><div class="doc-head"><h2>${esc(db.settings.shopName)}</h2><h2>حركة الصندوق</h2></div></div>
      ${html}<div class="balance-box">رصيد الصندوق: ${cashBal(balance)} ${cur()}</div>
      <p class="hint">الصندوق بيحسب المدفوع نقداً بالفواتير وسندات القبض والصرف.</p>`;
  };
  $('#cf').oninput = draw; $('#ct').oninput = draw;
  draw();
}

/* ----- الإعدادات ----- */
function settingsPage() {
  const s = db.settings;
  app.innerHTML = `
    <div class="page-head"><h2>الإعدادات</h2></div>
    <form class="card" id="setForm">
      <div class="grid">
        <label>اسم المحل<input name="shopName" value="${esc(s.shopName)}"></label>
        <label>العملة<input name="currency" value="${esc(s.currency)}" placeholder="د.أ، ل.س، $ ..."></label>
        <label>رصيد الصندوق الافتتاحي<input name="openingCash" type="number" step="any" value="${esc(s.openingCash)}"></label>
      </div>
      <div class="actions"><button class="btn primary" type="submit">💾 حفظ</button></div>
    </form>
    <div class="card">
      <h3 style="margin-top:0">النسخ الاحتياطي</h3>
      <p class="hint">البيانات محفوظة على هذا الجهاز وهذا المتصفح بس. خذ نسخة احتياطية بشكل دوري، وبتقدر ترجعها على أي جهاز ثاني.</p>
      <div class="btn-row">
        <button class="btn primary" type="button" id="exp">⬇️ تنزيل نسخة احتياطية</button>
        <label class="btn" style="flex-direction:row;color:var(--text)">⬆️ استرجاع نسخة<input type="file" id="imp" accept="application/json,.json" hidden></label>
      </div>
    </div>
    <div class="card">
      <h3 style="margin-top:0">منطقة الخطر</h3>
      <button class="btn danger" type="button" id="wipe">🗑️ مسح كل البيانات</button>
    </div>`;

  $('#setForm').onsubmit = e => {
    e.preventDefault();
    const f = e.target;
    Object.assign(db.settings, { shopName: f.shopName.value.trim() || 'محلي', currency: f.currency.value.trim(), openingCash: round(num(f.openingCash.value)) });
    save(); toast('تم الحفظ'); render();
  };
  $('#exp').onclick = () => {
    const blob = new Blob([JSON.stringify(db, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `نسخة-احتياطية-${today()}.json`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };
  $('#imp').onchange = e => {
    const file = e.target.files[0];
    if (!file) return;
    const r = new FileReader();
    r.onload = () => {
      try {
        const d = JSON.parse(r.result);
        if (!d || !Array.isArray(d.invoices) || !Array.isArray(d.parties)) throw new Error('bad');
        if (!confirm('استرجاع النسخة رح يستبدل كل البيانات الحالية. متأكد؟')) return;
        db = normalizeDb(d); save(); toast('تم الاسترجاع'); render();
      } catch (err) { alert('الملف مش نسخة احتياطية صحيحة'); }
    };
    r.readAsText(file);
    e.target.value = '';
  };
  $('#wipe').onclick = () => {
    if (prompt('رح ينمسح كل شي (فواتير، سندات، حسابات، أصناف). للتأكيد اكتب: مسح') !== 'مسح') return;
    db = blankDb(); save(); toast('تم مسح البيانات'); location.hash = '#/home';
  };
}

function notFound() {
  app.innerHTML = `<div class="card"><p>الصفحة غير موجودة. <a href="#/home">رجوع للرئيسية</a></p></div>`;
}

/* ---------- التوجيه ---------- */
const routes = {
  home, new: newInvoice, edit: editInvoice, invoice: viewInvoice, invoices: invoicesList,
  payments: paymentsPage, parties: partiesPage, items: itemsPage, statement: statementPage,
  cash: cashPage, settings: settingsPage
};

function render() {
  const [name = 'home', arg = ''] = location.hash.replace(/^#\/?/, '').split('/');
  const fn = routes[name] || home;
  const shop = db.settings.shopName || 'مؤسسة طريق القمة';
  $('#shopTitle').textContent = shop;
  document.title = `${shop} — محاسبة`;
  let navArg = decodeURIComponent(arg);
  if (name === 'statement' && getParty(navArg)) navArg = getParty(navArg).type;
  if (name === 'payments' && !PAY[navArg]) navArg = 'receipt';
  if (name === 'parties' && !PTYPE[navArg]) navArg = 'customer';
  if (name === 'invoices' && !KIND[navArg]) navArg = 'sale';
  if (name === 'statement' && !PTYPE[navArg]) navArg = 'customer';
  const full = '#/' + [name, navArg].filter(Boolean).join('/');
  $$('#nav a').forEach(a => {
    const h = a.getAttribute('href');
    a.classList.toggle('active', h === full || (h === '#/' + name && !navArg));
  });
  document.body.classList.remove('nav-open');
  if ($('#dlg').open) $('#dlg').close();
  fn(decodeURIComponent(arg));
  window.scrollTo(0, 0);
}

$('#menuBtn').onclick = () => document.body.classList.toggle('nav-open');
$('#navShade').onclick = () => document.body.classList.remove('nav-open');
window.addEventListener('hashchange', render);
// تحديث الصفحة إذا تغيّرت البيانات من تبويب ثاني
window.addEventListener('storage', e => { if (e.key === DB_KEY) { db = loadDb(); render(); } });
render();
