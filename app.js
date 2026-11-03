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
const round = n => Math.round((+n || 0) * 1000) / 1000;
const money = n => round(n).toLocaleString('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 });
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const num = v => { const n = parseFloat(String(v ?? '').replace(',', '.')); return isFinite(n) ? n : 0; };
const byName = (a, b) => a.name.localeCompare(b.name, 'ar');

function today() {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

/* ---------- أيقونات ---------- */
const ICONS = {
  menu: '<path d="M4 7h16M4 12h16M4 17h10"/>',
  tax: '<circle cx="12" cy="12" r="9"/><path d="m8.5 15.5 7-7"/><circle cx="9" cy="9" r="1.3"/><circle cx="15" cy="15" r="1.3"/>',
  share: '<circle cx="18" cy="5" r="2.6"/><circle cx="6" cy="12" r="2.6"/><circle cx="18" cy="19" r="2.6"/><path d="m8.3 10.8 7.4-4.4M8.3 13.2l7.4 4.4"/>',
  home: '<path d="M3 11.5 12 4l9 7.5"/><path d="M5.5 9.5V20h13V9.5"/><path d="M10 20v-5.5h4V20"/>',
  sale: '<path d="M6 2.8h12v18.4l-2.4-1.6-2.4 1.6-1.2-.8-1.2.8-2.4-1.6L6 21.2z"/><path d="M9 7.5h6M9 11h6M9 14.5h3.5"/>',
  purchase: '<path d="M4.5 8.5h15l-1.3 11.2a1.5 1.5 0 0 1-1.5 1.3H7.3a1.5 1.5 0 0 1-1.5-1.3z"/><path d="M8.5 8.5V7a3.5 3.5 0 0 1 7 0v1.5"/><path d="M9 13h6"/>',
  moneyIn: '<rect x="2.8" y="8.5" width="18.4" height="12" rx="2.2"/><path d="M16.5 14.5h2"/><path d="M12 1.8v5.4"/><path d="m9.6 4.9 2.4 2.4 2.4-2.4"/>',
  moneyOut: '<rect x="2.8" y="8.5" width="18.4" height="12" rx="2.2"/><path d="M16.5 14.5h2"/><path d="M12 7.2V1.8"/><path d="m9.6 4.1 2.4-2.4 2.4 2.4"/>',
  ledger: '<path d="M6.5 3h9l4 4v14h-13z"/><path d="M15.5 3v4h4"/><path d="M9.5 11.5h7M9.5 15h7M9.5 18.5h4"/><path d="M4.5 6v15.5"/>',
  list: '<path d="M9 6h11M9 12h11M9 18h11"/><circle cx="4.8" cy="6" r=".9"/><circle cx="4.8" cy="12" r=".9"/><circle cx="4.8" cy="18" r=".9"/>',
  users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M16 4.8a3.5 3.5 0 0 1 0 6.4"/><path d="M18 14.2a6.5 6.5 0 0 1 3.5 5.8"/>',
  truck: '<path d="M2.5 6h11v10h-11z"/><path d="M13.5 9.5h4l3.5 3.5V16h-7.5"/><circle cx="6.5" cy="17.5" r="1.8"/><circle cx="17" cy="17.5" r="1.8"/>',
  chart: '<path d="M3.5 20.5h17"/><rect x="5" y="11" width="3" height="7" rx=".8"/><rect x="10.5" y="6.5" width="3" height="11.5" rx=".8"/><rect x="16" y="13.5" width="3" height="4.5" rx=".8"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>'
};
const icon = n => `<svg class="i" viewBox="0 0 24 24" aria-hidden="true">${ICONS[n] || ''}</svg>`;

let emblemSeq = 0;
// شعار Summit Road: فرشاة وطريق متعرّج (viewBox 0 0 120 80)
function logoMark(c) {
  return `<g fill="none" stroke-linecap="round" stroke-linejoin="round">
    <path d="M52 3 L42.5 20" stroke="${c}" stroke-width="4.2"/>
    <path d="M38.6 18.6 L46.8 23.2" stroke="${c}" stroke-width="4.6"/>
    <path d="M37.6 21.2 L47.4 26.6 C 43 33, 37 39, 28 45 C 24.5 46.5, 21 45.8, 19.6 43.2 C 25 37, 32 29, 37.6 21.2 Z" fill="${c}" stroke="${c}" stroke-width="1"/>
    <path d="M24 42 L33 31 M27.5 43.6 L37 32.6 M31.5 43 L40.5 33" stroke="#0b101b" stroke-width=".8" opacity=".45"/>
    <path d="M24 46.5 C 30 46, 38 43.5, 44 42.5 C 47 42, 46 44, 38 47.5 C 33 49.6, 36 50.6, 42 49.8 C 48 49, 54 47.6, 58 47.4" stroke="${c}" stroke-width="2.6"/>
    <path d="M58 47.4 C 74 46.6, 94 47, 104 54 C 111 59, 110 69, 102 70.5 C 97 71.4, 95 66.5, 99.5 65" stroke="${c}" stroke-width="5"/>
    <circle cx="101.6" cy="67.6" r="2.2" fill="${c}" stroke="none"/>
  </g>`;
}
// شعار المؤسسة الأصلي (صورة)
const logoImg = (cls = '', dark = false) => `<img class="logo ${cls}" src="${dark ? 'logo-dark.png' : 'logo-gold.png'}" alt="Summit Road">`;

function emblem(cls = '') {
  const g = 'eg' + (++emblemSeq);
  return `<svg class="${cls}" viewBox="0 0 64 64" aria-hidden="true">
    <defs><linearGradient id="${g}" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#f8eab0"/><stop offset=".5" stop-color="#d4af37"/><stop offset="1" stop-color="#a8841f"/></linearGradient></defs>
    <circle cx="32" cy="32" r="30.5" fill="#0b101b" stroke="url(#${g})" stroke-width="1.5"/>
    <circle cx="32" cy="32" r="26.5" fill="none" stroke="url(#${g})" stroke-width=".6" opacity=".55"/>
    <g transform="translate(2.5 13.5) scale(.46)">${logoMark(`url(#${g})`)}</g>
  </svg>`;
}

/* ---------- قاعدة البيانات ---------- */
function blankDb() {
  return {
    settings: { shopName: 'مؤسسة طريق القمة', currency: 'د.أ', openingCash: 0, taxRate: 16, taxIncl: false },
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

function saveLocal() {
  try { localStorage.setItem(DB_KEY, JSON.stringify(db)); }
  catch (e) { if (!cloud.on) alert('تعذّر حفظ البيانات على هذا الجهاز. خذ نسخة احتياطية من الإعدادات.'); }
}

function save() {
  saveLocal();
  if (cloud.ready) cloudPush();
}

/* ---------- مسمّيات ---------- */
const KIND = { sale: 'بيع', purchase: 'شراء' };
const PAYMETHOD = { cash: 'نقدي', credit: 'ذمم' };
const PAY = { receipt: 'سند قبض', payment: 'سند صرف', taxpay: 'دفعة ضريبة' };
const PTYPE = { customer: 'عميل', supplier: 'مورد' };
const PTYPES = { customer: 'العملاء', supplier: 'الموردين' };
const partyTypeFor = kind => (kind === 'sale' ? 'customer' : 'supplier');

const getParty = id => db.parties.find(p => p.id === id);
const getItem = id => db.items.find(i => i.id === id);
const partyName = id => getParty(id)?.name || '—';
const isCredit = inv => inv.pay === 'credit' && !!inv.partyId;
const cur = () => esc(db.settings.currency);
const initial = n => (String(n || '').replace(/^(ال|مؤسسة|شركة)\s*/, '').trim()[0] || '؟');

const subTotal = inv => round(inv.lines.reduce((s, l) => s + num(l.qty) * num(l.price), 0));
const invBase = inv => round(subTotal(inv) - num(inv.discount));
// الضريبة: الأسعار قبل الضريبة (بتنضاف) أو شاملة الضريبة (بتنحسب من جوّا)
function invCalc(inv) {
  const base = invBase(inv), r = num(inv.taxRate) / 100;
  if (!r) return { net: base, tax: 0, total: base };
  if (inv.taxIncl) { const net = round(base / (1 + r)); return { net, tax: round(base - net), total: base }; }
  const tax = round(base * r);
  return { net: base, tax, total: round(base + tax) };
}
const invTotal = inv => invCalc(inv).total;
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
  if (window.innerWidth >= 900) $('input, select', f)?.focus();
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

function paymentDialog(pm, kind, partyId, after) {
  const isNew = !pm;
  kind = pm ? pm.kind : (kind || 'receipt');
  pm = pm || { kind, no: nextNo(db.payments.filter(x => x.kind === kind)), date: today(), partyId: partyId || '', amount: '', note: '' };
  const ptype = kind === 'receipt' ? 'customer' : 'supplier';
  if (!db.parties.some(p => p.type === ptype)) { alert(`أضف ${PTYPE[ptype]} أولاً من صفحة ${PTYPES[ptype]}`); return; }
  openDialog(isNew ? `${PAY[kind]} جديد` : `تعديل ${PAY[kind]} رقم ${pm.no}`, `
    <p class="hint" style="margin:0">${kind === 'receipt' ? 'استلام مبلغ من عميل' : 'دفع مبلغ لمورد'}</p>
    <div class="grid g2">
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
  comboSelect($('#dlgForm [name=partyId]'));
}

/* ---------- الصفحات ---------- */
function home() {
  const dateStr = new Date().toLocaleDateString('ar', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const tile = (tag, attrs, ic, t, sub, cls) => `<${tag} class="tile ${cls}" ${attrs}>
      <span class="badge">${icon(ic)}</span><span class="t">${t}</span><span class="s">${sub}</span></${tag}>`;
  app.innerHTML = `
    <section class="hero">
      ${logoImg('logo-hero')}
      <h2>${esc(db.settings.shopName)}</h2>
      <div class="date">${dateStr}</div>
      <div class="ornament"><span></span><i></i><span></span></div>
    </section>
    <div class="tiles">
      ${tile('a', 'href="#/new/purchase"', 'purchase', 'فاتورة شراء', 'من المورد', '')}
      ${tile('a', 'href="#/new/sale"', 'sale', 'فاتورة بيع', 'للعميل', '')}
      ${tile('button', 'type="button" id="qReceipt"', 'moneyIn', 'سند قبض', 'استلام مبلغ', '')}
      ${tile('button', 'type="button" id="qPayment"', 'moneyOut', 'سند صرف', 'دفع مبلغ', '')}
      <a class="tile wide" href="#/statement/all"><span class="badge">${icon('ledger')}</span>
        <span class="txt"><span class="t">كشف حساب</span><span class="s">أي عميل أو مورد</span></span></a>
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
    pay: 'cash', lines: [{ itemId: null, name: '', qty: 1, price: '' }], discount: '', note: '',
    taxRate: db.settings.taxRate ?? 16, taxIncl: !!db.settings.taxIncl
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
      <div class="grid g2">
        <label>رقم الفاتورة<input name="no" type="number" min="1" required value="${esc(inv.no)}"></label>
        <label>التاريخ<input name="date" type="date" required value="${esc(inv.date)}"></label>
      </div>
      <div class="paybox">
        <span class="paylbl">طريقة الدفع</span>
        <label class="radio"><input type="radio" name="pay" value="cash" ${inv.pay !== 'credit' ? 'checked' : ''}> نقدي</label>
        <label class="radio"><input type="radio" name="pay" value="credit" ${inv.pay === 'credit' ? 'checked' : ''}> ذمم (على الحساب)</label>
      </div>
      <div class="grid party-row">
        <label><span id="partyLbl"></span>
          <select name="partyId" id="partySel"></select></label>
        <button type="button" class="btn" id="addParty">+ <span class="hide-sm">${PTYPE[ptype]} جديد</span></button>
      </div>
      <p class="hint" id="payHint"></p>

      <h3>الأصناف</h3>
      <div class="table-wrap"><table class="tbl lines">
        <thead><tr><th>الصنف</th><th>الكمية</th><th>السعر</th><th class="num">المجموع</th><th></th></tr></thead>
        <tbody id="lines"></tbody>
      </table></div>
      <datalist id="itemList">${[...db.items].sort(byName).map(i => `<option value="${esc(i.name)}">`).join('')}</datalist>
      <div class="actions" style="margin-top:8px"><button type="button" class="btn" id="addLine">سطر جديد</button></div>
      <p class="hint">اكتب اسم الصنف، وبتطلعلك الأسماء اللي استعملتها قبل.</p>

      <div class="totals">
        <div class="sum">المجموع<b id="tSub"></b></div>
        <div class="sum">ضريبة المبيعات<b id="tTax"></b></div>
        <label>الخصم<input name="discount" type="number" step="any" min="0" value="${esc(inv.discount)}"></label>
        <label>نسبة الضريبة %<input name="taxRate" type="number" step="any" min="0" value="${esc(inv.taxRate ?? '')}" placeholder="0 = بدون ضريبة"></label>
        <label class="chk"><input type="checkbox" name="taxIncl" ${inv.taxIncl ? 'checked' : ''}> الأسعار شاملة الضريبة</label>
        <div class="sum grand">الإجمالي<b id="tNet"></b></div>
      </div>
      <label>ملاحظات<input name="note" value="${esc(inv.note)}"></label>

      <div class="actions">
        <button class="btn primary" type="submit">حفظ الفاتورة</button>
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
    inv.taxRate = form.taxRate.value;
    inv.taxIncl = form.taxIncl.checked;
    const c = invCalc(inv);
    $('#tSub').textContent = money(subTotal(inv));
    $('#tTax').textContent = money(c.tax);
    $('#tNet').textContent = money(c.total);
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
  form.taxRate.oninput = recalc;
  form.taxIncl.onchange = recalc;
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
    Object.assign(rec, { no, date: form.date.value, pay, partyId, lines, discount,
      taxRate: round(num(form.taxRate.value)), taxIncl: form.taxIncl.checked, note: form.note.value.trim() });
    save();
    toast('تم حفظ الفاتورة');
    location.hash = '#/invoice/' + rec.id;
  };

  updatePay(inv.partyId || '');
  comboSelect($('#partySel'));
  renderLines();
}

/* ----- عرض فاتورة ----- */
function viewInvoice(id) {
  const inv = db.invoices.find(i => i.id === id);
  if (!inv) return notFound();
  const tc = invCalc(inv), t = tc.total, party = getParty(inv.partyId), cr = isCredit(inv);
  app.innerHTML = `
    <div class="page-head"><h2>فاتورة ${KIND[inv.kind]} رقم ${esc(inv.no)}</h2>
      <div class="btn-row">
        <button class="btn primary" type="button" data-share>${icon('share')} مشاركة</button><button class="btn btn-print" type="button" onclick="print()">طباعة</button>
        <a class="btn" href="#/edit/${inv.id}">تعديل</a>
        ${party && cr ? `<a class="btn" href="#/statement/${party.id}">كشف حساب</a>` : ''}
        <button class="btn danger" type="button" id="delInv">حذف</button>
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
        ${tc.tax ? `<div><span>المبلغ قبل الضريبة</span><b>${money(tc.net)}</b></div>
        <div><span>ضريبة المبيعات ${esc(num(inv.taxRate))}%${inv.taxIncl ? ' (شاملة)' : ''}</span><b>${money(tc.tax)}</b></div>` : ''}
        <div><span>الإجمالي</span><b>${money(t)} ${cur()}</b></div>
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
      <div class="btn-row"><a class="btn primary" href="#/new/${kind}">فاتورة ${KIND[kind]} جديدة</a>
      <button class="btn primary" type="button" data-share>${icon('share')} مشاركة</button><button class="btn btn-print" type="button" onclick="print()">طباعة</button></div></div>
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
      .filter(i => !q || String(i.no) === q || normName(partyName(i.partyId)).includes(normName(q)))
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
        <button class="btn primary" type="button" id="nV">${PAY[kind]} جديد</button>
        <button class="btn primary" type="button" data-share>${icon('share')} مشاركة</button><button class="btn btn-print" type="button" onclick="print()">طباعة</button>
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
      .filter(p => !q || normName(partyName(p.partyId)).includes(normName(q)) || normName(p.note).includes(normName(q)) || String(p.no) === q)
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
      <div class="btn-row"><button class="btn primary" type="button" id="addP">${PTYPE[type]} جديد</button>
      <button class="btn primary" type="button" data-share>${icon('share')} مشاركة</button><button class="btn btn-print" type="button" onclick="print()">طباعة</button></div></div>
    <div class="card filters"><label>بحث<input id="sq" placeholder="الاسم أو الهاتف"></label>
      <label>عرض<select id="sf"><option value="">الكل</option><option value="nz">اللي إلهم أو عليهم رصيد</option></select></label></div>
    <div class="card" id="pList"></div>`;
  const draw = () => {
    const q = $('#sq').value.trim(), nz = $('#sf').value === 'nz';
    const list = db.parties.filter(p => p.type === type)
      .filter(p => !q || normName(p.name).includes(normName(q)) || (p.phone || '').includes(q))
      .map(p => ({ p, b: partyBalance(p) }))
      .filter(x => !nz || Math.abs(x.b) > 0.004)
      .sort((a, b) => byName(a.p, b.p));
    const total = list.reduce((s, x) => s + x.b, 0);
    $('#pList').innerHTML = list.length ? `<div class="table-wrap"><table class="tbl"><thead><tr>
      <th>الاسم</th><th>الهاتف</th><th class="num">الرصيد</th><th></th></tr></thead><tbody>
      ${list.map(({ p, b }) => `<tr class="clickable" data-href="#/statement/${p.id}"><td><span class="who-cell"><span class="avatar">${esc(initial(p.name))}</span>${esc(p.name)}</span></td><td>${esc(p.phone)}</td><td class="num">${partyBal(b)}</td>
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

/* ----- كشف حساب ----- */
function statementPage(arg) {
  const st = statementPage.state || (statementPage.state = { from: '', to: '', all: false });
  const p = getParty(arg);
  // all = كشف عام بيختار منه أي عميل أو مورد
  if (!p) st.all = !PTYPE[arg];
  const all = st.all;
  const type = p ? p.type : (PTYPE[arg] ? arg : 'customer');
  const partyId = p ? p.id : '';
  const types = all ? ['customer', 'supplier'] : [type];
  const pickLbl = all ? 'العميل أو المورد' : (type === 'customer' ? 'العميل' : 'المورد');
  app.innerHTML = `
    <div class="page-head"><h2>${all && !p ? 'كشف حساب' : 'كشف حساب ' + PTYPE[type]}</h2>
      <div class="btn-row">${p ? `<button class="btn primary" type="button" data-share>${icon('share')} مشاركة</button><button class="btn btn-print" type="button" onclick="print()">طباعة</button>
        <button class="btn" type="button" id="stPay">${p.type === 'customer' ? 'سند قبض' : 'سند صرف'}</button>` : ''}</div></div>
    <div class="card filters">
      <label>${pickLbl}<select id="sp"><option value="">— اختر —</option>${partyOptions(partyId, types)}</select></label>
      <label>من تاريخ<input id="sf" type="date" value="${st.from}"></label>
      <label>إلى تاريخ<input id="stt" type="date" value="${st.to}"></label>
    </div>
    <div class="card" id="stBody"></div>`;

  $('#sp').onchange = e => { location.hash = '#/statement/' + (e.target.value || (all ? 'all' : type)); };
  comboSelect($('#sp'));
  const draw = () => {
    st.from = $('#sf').value; st.to = $('#stt').value;
    if (!p) {
      $('#stBody').innerHTML = db.parties.some(x => types.includes(x.type)) ? `<p class="hint">اختر ${pickLbl} من فوق.</p>`
        : `<p class="hint">لا يوجد ${all ? 'عملاء أو موردين' : PTYPES[type]} بعد.</p>`;
      return;
    }
    const { html, balance } = statementTable(partyEntries(p), st.from, st.to, { dr: 'مدين - عليه', cr: 'دائن - له', bal: partyBal });
    const period = st.from || st.to ? `الفترة: ${st.from || 'البداية'} — ${st.to || today()}` : `حتى تاريخ ${today()}`;
    let verdict = 'الحساب مسكّر (الرصيد صفر)';
    if (balance > 0) verdict = `الرصيد المستحق على ${esc(p.name)}: ${money(balance)} ${cur()}`;
    if (balance < 0) verdict = `الرصيد المستحق لـ ${esc(p.name)}: ${money(-balance)} ${cur()}`;
    const ents = partyEntries(p).filter(e => (!st.from || (e.date || '') >= st.from) && (!st.to || !e.date || e.date <= st.to));
    const sDr = ents.reduce((a, e) => a + e.debit, 0), sCr = ents.reduce((a, e) => a + e.credit, 0);
    const state = balance > 0 ? 'عليه' : balance < 0 ? 'له' : 'مسكّر';
    $('#stBody').innerHTML = `
      <div class="stmt-hero no-pdf">
        <div class="who"><span class="avatar lg">${esc(initial(p.name))}</span>
          <div><div class="nm">${esc(p.name)}</div><div class="sub">${PTYPE[p.type]}${p.phone ? ' · <span dir="ltr">' + esc(p.phone) + '</span>' : ''} · ${period}</div></div></div>
        <div class="bal ${balance > 0 ? 'owes' : balance < 0 ? 'cred' : ''}"><small>الرصيد</small><b>${money(Math.abs(balance))}</b><span>${cur()} · ${state}</span></div>
        <div class="mini">
          <div><small>مجموع المدين</small><b>${money(sDr)}</b></div>
          <div><small>مجموع الدائن</small><b>${money(sCr)}</b></div>
          <div><small>عدد الحركات</small><b>${ents.length}</b></div>
        </div>
      </div>
      <div class="print-head">
        <div class="doc-head"><h2>${esc(db.settings.shopName)}</h2><h2>كشف حساب ${PTYPE[p.type]}</h2></div>
        <div class="doc-meta"><div><span>${PTYPE[p.type]}: </span><b>${esc(p.name)}</b></div>
          ${p.phone ? `<div><span>الهاتف: </span><b dir="ltr">${esc(p.phone)}</b></div>` : ''}<div><span>الفترة: </span><b>${period.replace(/^الفترة: /, '')}</b></div></div>
        <div class="sum-boxes">
          <div><small>مجموع المدين</small><b>${money(sDr)}</b></div>
          <div><small>مجموع الدائن</small><b>${money(sCr)}</b></div>
          <div class="hl"><small>الرصيد ${state === 'مسكّر' ? '' : '(' + state + ')'}</small><b>${money(Math.abs(balance))} ${cur()}</b></div>
        </div>
      </div>
      ${html}
      <div class="balance-box">${verdict}</div>
      <p class="hint no-print">كشف الحساب بيعرض فواتير الذمم والسندات بس. الفواتير النقدية ما بتظهر فيه.</p>`;
  };
  $('#sf').oninput = draw; $('#stt').oninput = draw;
  if (p) $('#stPay').onclick = () => paymentDialog(null, p.type === 'customer' ? 'receipt' : 'payment', p.id, draw);
  draw();
}

/* ----- التقارير ----- */
const REPORTS = {
  'sales-today': 'مبيعات اليوم',
  'sales-month': 'مبيعات هذا الشهر',
  'purchases-month': 'مشتريات هذا الشهر',
  'receivables': 'ديون لنا على العملاء',
  'payables': 'ديون علينا للموردين'
};

function reportsPage() {
  const t = today(), m = t.slice(0, 7);
  const sum = (kind, pred) => db.invoices.filter(i => i.kind === kind && pred(i.date || '')).reduce((s, i) => s + invTotal(i), 0);
  const recv = db.parties.filter(p => p.type === 'customer').reduce((s, p) => s + Math.max(0, partyBalance(p)), 0);
  const payable = db.parties.filter(p => p.type === 'supplier').reduce((s, p) => s + Math.max(0, -partyBalance(p)), 0);
  const c = `<small>${cur()}</small>`;
  const card = (href, ic, k, v, cls = '') => `<a class="stat link" href="${href}">
      <div class="k">${ic} ${k}</div><div class="v ${cls}">${v} ${c}</div><div class="go">عرض الحركات ←</div></a>`;
  app.innerHTML = `
    <div class="page-head"><h2>التقارير</h2></div>
    <div class="stats">
      ${card('#/report/sales-month', '', 'مبيعات هذا الشهر', money(sum('sale', d => d.startsWith(m))))}
      ${card('#/report/purchases-month', '', 'مشتريات هذا الشهر', money(sum('purchase', d => d.startsWith(m))))}
      ${card('#/report/receivables', '', 'ديون لنا على العملاء', money(recv), 'owes')}
      ${card('#/report/payables', '', 'ديون علينا للموردين', money(payable))}
      ${card('#/tax', '', 'ضريبة المبيعات المستحقة', money(entriesBalance(taxEntries())))}
    </div>`;
}

function reportPage(key) {
  if (!REPORTS[key] || key === 'sales-today') key = 'sales-month';
  const t = today(), m = t.slice(0, 7);
  const c = cur();
  let total = 0, body = '', sub = '';

  if (key === 'receivables' || key === 'payables') {
    const type = key === 'receivables' ? 'customer' : 'supplier';
    const sign = type === 'customer' ? 1 : -1;
    const list = db.parties.filter(p => p.type === type)
      .map(p => ({ p, b: round(sign * partyBalance(p)) }))
      .filter(x => x.b > 0.004)
      .sort((a, b) => b.b - a.b);
    total = list.reduce((s, x) => s + x.b, 0);
    sub = `عدد ${PTYPES[type]}: ${list.length}`;
    body = list.length ? `<div class="table-wrap"><table class="tbl"><thead><tr>
      <th>${type === 'customer' ? 'العميل' : 'المورد'}</th><th>الهاتف</th><th class="num">${type === 'customer' ? 'المبلغ المستحق عليه' : 'المبلغ المستحق له'}</th><th></th></tr></thead><tbody>
      ${list.map(({ p, b }) => `<tr class="clickable" data-href="#/statement/${p.id}"><td><span class="who-cell"><span class="avatar">${esc(initial(p.name))}</span>${esc(p.name)}</span></td><td>${esc(p.phone)}</td>
        <td class="num">${money(b)}</td><td><a class="btn sm" href="#/statement/${p.id}">كشف حساب</a></td></tr>`).join('')}
      </tbody><tfoot><tr><th colspan="2">الإجمالي</th><th class="num">${money(total)}</th><th></th></tr></tfoot></table></div>`
      : '<p class="hint">ما في ديون.</p>';
  } else {
    const kind = key.startsWith('sales') ? 'sale' : 'purchase';
    const pred = key === 'sales-today' ? (d => d === t) : (d => (d || '').startsWith(m));
    const list = db.invoices.filter(i => i.kind === kind && pred(i.date)).sort(byDate).reverse();
    total = list.reduce((s, i) => s + invTotal(i), 0);
    sub = key === 'sales-today' ? `تاريخ ${t}` : `شهر ${m}`;
    body = invoiceTable(list, false);
  }

  app.innerHTML = `
    <div class="page-head"><h2>${REPORTS[key]}</h2>
      <div class="btn-row"><a class="btn" href="#/reports">→ رجوع للتقارير</a><button class="btn primary" type="button" data-share>${icon('share')} مشاركة</button><button class="btn btn-print" type="button" onclick="print()">طباعة</button></div></div>
    <div class="card">
      <div class="print-only"><div class="doc-head"><h2>${esc(db.settings.shopName)}</h2><h2>${REPORTS[key]}</h2></div></div>
      <div class="report-total"><span>${REPORTS[key]}</span><b>${money(total)} <small>${c}</small></b><span class="hint">${sub}</span></div>
      ${body}
    </div>`;
  bindRowLinks();
}

/* ----- استيراد ودمج حركات (بدون حذف أي إشي) ----- */
// توحيد الأسماء للمطابقة (أ/ا، ة/ه، ى/ي، المسافات)
const normName = s => String(s || '').trim().replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي').replace(/\s+/g, ' ');
const findParty = p => db.parties.find(x => x.id === p.id) || db.parties.find(x => x.type === p.type && normName(x.name) === normName(p.name));

function mergeData(d) {
  const idMap = {}, added = { parties: 0, invoices: 0, payments: 0 };
  for (const p of d.parties || []) {
    const ex = findParty(p);
    if (ex) {
      idMap[p.id] = ex.id;
      if (num(p.opening) && round(num(ex.opening)) !== round(num(p.opening)) &&
          confirm(`الرصيد الافتتاحي لـ ${ex.name} حالياً ${money(ex.opening)}.\nبدك تخليه ${money(p.opening)} متل الكشف؟`)) ex.opening = round(num(p.opening));
    } else {
      const np = { phone: '', ...p, id: p.id || uid(), at: p.at || Date.now() };
      db.parties.push(np); idMap[p.id] = np.id; added.parties++;
    }
  }
  for (const inv of d.invoices || []) {
    if (db.invoices.some(x => x.id === inv.id)) continue;
    db.invoices.push({ ...inv, partyId: idMap[inv.partyId] || inv.partyId }); added.invoices++;
  }
  for (const v of d.payments || []) {
    if (db.payments.some(x => x.id === v.id)) continue;
    const no = v.no || nextNo(db.payments.filter(x => x.kind === v.kind));
    db.payments.push({ ...v, no, partyId: idMap[v.partyId] || v.partyId }); added.payments++;
  }
  save();
  return added;
}

async function importPage(name) {
  app.innerHTML = `<div class="page-head"><h2>استيراد حركات</h2></div><div class="card" id="impBody"><p class="hint">جاري التحميل...</p></div>`;
  let d;
  try {
    const r = await fetch(`imports/${encodeURIComponent(name)}.json?t=${Date.now()}`);
    if (!r.ok) throw new Error(r.status);
    d = await r.json();
  } catch (e) { $('#impBody').innerHTML = '<p class="owes">ما لقيت ملف الاستيراد.</p>'; return; }
  const p = (d.parties || [])[0];
  const sup = p && p.type === 'supplier';
  const invs = d.invoices || [], pays = d.payments || [];
  const tInv = invs.reduce((s, i) => s + invTotal(i), 0), tPay = pays.reduce((s, v) => s + num(v.amount), 0);
  const ob = p ? num(p.opening) : 0;
  const already = invs.filter(i => db.invoices.some(x => x.id === i.id)).length + pays.filter(v => db.payments.some(x => x.id === v.id)).length;
  $('#impBody').innerHTML = `
    <h3 style="margin-top:0">${esc(d.title || name)}</h3>
    <div class="doc-sum" style="margin-inline-start:0">
      ${p ? `<div><span>الحساب</span><b>${esc(p.name)}</b></div><div><span>رصيد افتتاحي</span><b>${money(ob)}</b></div>` : ''}
      <div><span>${sup ? 'فواتير شراء ذمم' : 'فواتير بيع ذمم'} (${invs.length})</span><b>${money(tInv)}</b></div>
      <div><span>${sup ? 'سندات صرف' : 'سندات قبض ودفعات'} (${pays.length})</span><b>${money(tPay)}</b></div>
      <div><span>${sup ? 'الرصيد المستحق للمورد' : 'الرصيد المستحق على العميل'}</span><b>${money(ob + tInv - tPay)}</b></div>
    </div>
    ${already ? `<p class="hint">${already} حركة منهم موجودة أصلاً، ما رح تتكرر.</p>` : ''}
    <p class="hint">رح تنضاف الحركات لبياناتك بدون ما ينمسح أي إشي، وبتتزامن على كل الأجهزة.</p>
    <div class="actions"><button class="btn primary" id="doImp">إضافة الحركات</button><a class="btn" href="#/home">إلغاء</a></div>`;
  $('#doImp').onclick = () => {
    const a = mergeData(d);
    toast(`تمت الإضافة: ${a.invoices} فاتورة و ${a.payments} سند`);
    const pid = p && findParty(p);
    location.hash = pid ? '#/statement/' + pid.id : '#/home';
  };
}

/* ----- كشف ضريبة المبيعات ----- */
// مدين = ضريبة على مبيعاتنا (علينا للضريبة)، دائن = ضريبة على مشترياتنا + دفعات للضريبة
function taxEntries() {
  const e = [];
  for (const inv of db.invoices) {
    const c = invCalc(inv);
    if (!c.tax) continue;
    const sale = inv.kind === 'sale';
    e.push({ date: inv.date, at: inv.at, link: '#/invoice/' + inv.id, base: c.net, rate: num(inv.taxRate),
      desc: `فاتورة ${KIND[inv.kind]} رقم ${inv.no}${getParty(inv.partyId) ? ' — ' + partyName(inv.partyId) : ''}`,
      debit: sale ? c.tax : 0, credit: sale ? 0 : c.tax, kind: inv.kind });
  }
  for (const v of db.payments) {
    if (v.kind !== 'taxpay') continue;
    e.push({ date: v.date, at: v.at, desc: `دفعة ضريبة رقم ${v.no}${v.note ? ' — ' + v.note : ''}`, debit: 0, credit: num(v.amount), kind: 'taxpay', id: v.id });
  }
  return e.sort(byDate);
}

function taxPayDialog(after) {
  openDialog('دفعة لضريبة المبيعات', `
    <p class="hint" style="margin:0">مبلغ دفعته لدائرة ضريبة الدخل والمبيعات</p>
    <div class="grid g2">
      <label>الرقم<input name="no" type="number" min="1" value="${nextNo(db.payments.filter(x => x.kind === 'taxpay'))}"></label>
      <label>التاريخ<input name="date" type="date" value="${today()}"></label>
    </div>
    <label>المبلغ (${cur()})<input name="amount" type="number" step="any" min="0" required></label>
    <label>ملاحظة<input name="note" placeholder="مثلاً: إقرار شهر 10"></label>`,
    d => {
      const amount = round(num(d.amount));
      if (!(amount > 0)) { alert('اكتب المبلغ'); return false; }
      if (!d.date) { alert('اختر التاريخ'); return false; }
      db.payments.push({ id: uid(), at: Date.now(), kind: 'taxpay', no: parseInt(d.no, 10) || nextNo(db.payments.filter(x => x.kind === 'taxpay')),
        date: d.date, partyId: '', amount, note: d.note.trim() });
      save(); toast('تم الحفظ'); after && after();
    });
}

function taxPage() {
  const st = taxPage.state || (taxPage.state = { from: '', to: '' });
  app.innerHTML = `
    <div class="page-head"><h2>كشف ضريبة المبيعات</h2>
      <div class="btn-row">
        <button class="btn primary" type="button" data-share>${icon('share')} مشاركة</button><button class="btn btn-print" type="button" onclick="print()">طباعة</button>
        <button class="btn" type="button" id="taxPay">دفعة للضريبة</button>
      </div></div>
    <div class="card filters dates">
      <label>من تاريخ<input id="xf" type="date" value="${st.from}"></label>
      <label>إلى تاريخ<input id="xt" type="date" value="${st.to}"></label>
    </div>
    <div class="card" id="xBody"></div>`;
  const draw = () => {
    st.from = $('#xf').value; st.to = $('#xt').value;
    const all = taxEntries();
    let prev = 0, hasPrev = false;
    const rows = [];
    for (const e of all) {
      if (st.from && (e.date || '') < st.from) { prev += e.debit - e.credit; hasPrev = true; continue; }
      if (st.to && e.date > st.to) continue;
      rows.push(e);
    }
    const sum = k => rows.filter(r => r.kind === k).reduce((a, r) => a + r.debit + r.credit, 0);
    const outTax = sum('sale'), inTax = sum('purchase'), paid = sum('taxpay');
    const sales = rows.filter(r => r.kind === 'sale').reduce((a, r) => a + r.base, 0);
    const buys = rows.filter(r => r.kind === 'purchase').reduce((a, r) => a + r.base, 0);
    let bal = prev;
    const balTxt = v => round(v) > 0 ? `${money(v)} <small>علينا</small>` : round(v) < 0 ? `${money(-v)} <small>لنا</small>` : money(0);
    const period = st.from || st.to ? `الفترة: ${st.from || 'البداية'} — ${st.to || today()}` : `حتى تاريخ ${today()}`;
    const net = prev + outTax - inTax - paid;
    $('#xBody').innerHTML = `
      <div class="print-head">
        <div class="doc-head"><h2>${esc(db.settings.shopName)}</h2><h2>كشف ضريبة المبيعات</h2></div>
        <div class="doc-meta"><div><span>الفترة: </span><b>${period.replace(/^الفترة: /, '')}</b></div></div>
      </div>
      <div class="sum-boxes tax-boxes">
        <div><small>مبيعات خاضعة (قبل الضريبة)</small><b>${money(sales)}</b></div>
        <div><small>ضريبة المبيعات (علينا)</small><b class="owes">${money(outTax)}</b></div>
        <div><small>مشتريات خاضعة (قبل الضريبة)</small><b>${money(buys)}</b></div>
        <div><small>ضريبة المشتريات (لنا)</small><b class="cred">${money(inTax)}</b></div>
        <div><small>دفعات للضريبة</small><b>${money(paid)}</b></div>
        <div class="hl"><small>الصافي المستحق للضريبة</small><b>${balTxt(net)}</b></div>
      </div>
      <div class="table-wrap"><table class="tbl"><thead><tr>
        <th>التاريخ</th><th>البيان</th><th class="num">قبل الضريبة</th><th class="num">ضريبة مبيعات</th><th class="num">ضريبة مشتريات ودفعات</th><th class="num">الرصيد</th><th></th></tr></thead><tbody>
        ${hasPrev ? `<tr class="muted-row"><td>${esc(st.from)}</td><td>رصيد ما قبل الفترة</td><td></td><td></td><td></td><td class="num">${balTxt(prev)}</td><td></td></tr>` : ''}
        ${rows.map(r => { bal += r.debit - r.credit; return `<tr>
          <td>${esc(r.date)}</td><td>${r.link ? `<a href="${r.link}">${esc(r.desc)}</a>` : esc(r.desc)}${r.rate ? ` <small>(${esc(r.rate)}%)</small>` : ''}</td>
          <td class="num">${r.base != null ? money(r.base) : ''}</td>
          <td class="num">${r.debit ? money(r.debit) : ''}</td><td class="num">${r.credit ? money(r.credit) : ''}</td>
          <td class="num">${balTxt(bal)}</td>
          <td>${r.kind === 'taxpay' ? `<button class="btn sm danger" type="button" data-taxdel="${r.id}">حذف</button>` : ''}</td></tr>`; }).join('')}
        ${!rows.length && !hasPrev ? '<tr><td colspan="7" class="empty">لا توجد حركات ضريبة</td></tr>' : ''}
      </tbody><tfoot><tr><th colspan="3">المجموع</th><th class="num">${money(outTax)}</th><th class="num">${money(inTax + paid)}</th><th class="num">${balTxt(bal)}</th><th></th></tr></tfoot></table></div>
      <div class="balance-box">الصافي المستحق للضريبة: ${balTxt(net)} ${cur()}</div>
      <p class="hint no-print">بيعرض الفواتير اللي عليها ضريبة بس. كشوفات العملاء والموردين بتعرض إجمالي الفاتورة بدون تفصيل الضريبة.</p>`;
  };
  $('#xBody').onclick = e => {
    const b = e.target.closest('[data-taxdel]');
    if (!b || !confirm('متأكد بدك تحذف دفعة الضريبة؟')) return;
    db.payments = db.payments.filter(x => x.id !== b.dataset.taxdel);
    save(); toast('تم الحذف'); draw();
  };
  $('#xf').oninput = draw; $('#xt').oninput = draw;
  $('#taxPay').onclick = () => taxPayDialog(draw);
  draw();
}

/* ----- الصندوق ----- */
function cashPage() {
  const st = cashPage.state || (cashPage.state = { from: '', to: '' });
  app.innerHTML = `
    <div class="page-head"><h2>رصيد الصندوق</h2>
      <div class="btn-row"><a class="btn" href="#/reports">→ رجوع للتقارير</a><button class="btn primary" type="button" data-share>${icon('share')} مشاركة</button><button class="btn btn-print" type="button" onclick="print()">طباعة</button></div></div>
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
        <label>نسبة ضريبة المبيعات الافتراضية %<input name="taxRate" type="number" step="any" min="0" value="${esc(s.taxRate ?? 16)}"></label>
        <label class="chk"><input type="checkbox" name="taxIncl" ${s.taxIncl ? 'checked' : ''}> الأسعار بالفواتير شاملة الضريبة (افتراضياً)</label>
      </div>
      <div class="actions"><button class="btn primary" type="submit">حفظ</button></div>
    </form>
    <div class="card">
      <h3 style="margin-top:0">المزامنة بين الأجهزة</h3>
      ${cloud.on ? `
        <p>الحالة: <b id="syncStatus">${esc(cloud.status || '')}</b></p>
        ${cloud.user ? `<p class="hint">مسجّل دخول باسم: <span dir="ltr">${esc(cloud.user.email || '')}</span></p>
        <div class="btn-row"><button class="btn danger" type="button" id="logoutBtn">تسجيل خروج من هذا الجهاز</button></div>` : ''}`
      : `<p class="hint">المزامنة مش مفعّلة. البيانات محفوظة على هذا الجهاز بس.</p>`}
    </div>
    <div class="card">
      <h3 style="margin-top:0">النسخ الاحتياطي</h3>
      <p class="hint">${cloud.on ? 'البيانات محفوظة على السيرفر ومتزامنة بين الأجهزة. برضه خذ نسخة احتياطية كل فترة للأمان.' : 'البيانات محفوظة على هذا الجهاز وهذا المتصفح بس. خذ نسخة احتياطية بشكل دوري، وبتقدر ترجعها على أي جهاز ثاني.'}</p>
      <div class="btn-row">
        <button class="btn primary" type="button" id="exp">تنزيل نسخة احتياطية</button>
        <label class="btn" style="flex-direction:row;color:var(--text)">استرجاع نسخة (استبدال الكل)<input type="file" id="imp" accept="application/json,.json" hidden></label>
        <label class="btn" style="flex-direction:row;color:var(--text)">استيراد وإضافة (بدون حذف)<input type="file" id="impMerge" accept="application/json,.json" hidden></label>
      </div>
    </div>
    <div class="card" id="logCard">
      <h3 style="margin-top:0">سجل الحركات (Log)</h3>
      <p class="hint">كل الفواتير والسندات المدخلة، الأحدث أولاً. فيك تحذف أي حركة لحالها.</p>
      <div class="filters" style="margin-bottom:12px">
        <label>النوع<select id="lt">
          <option value="">الكل</option>
          <option value="sale">فواتير البيع</option><option value="purchase">فواتير الشراء</option>
          <option value="receipt">سندات القبض</option><option value="payment">سندات الصرف</option>
        </select></label>
        <label>بحث<input id="lq" placeholder="الاسم أو الرقم"></label>
      </div>
      <div id="logList"></div>
    </div>
    <div class="card">
      <h3 style="margin-top:0">منطقة الخطر</h3>
      <button class="btn danger" type="button" id="wipe">مسح كل البيانات</button>
    </div>`;

  $('#setForm').onsubmit = e => {
    e.preventDefault();
    const f = e.target;
    Object.assign(db.settings, { shopName: f.shopName.value.trim() || 'محلي', currency: f.currency.value.trim(), openingCash: s.openingCash, taxRate: round(num(f.taxRate.value)), taxIncl: f.taxIncl.checked });
    save(); toast('تم الحفظ'); render();
  };
  if ($('#logoutBtn')) $('#logoutBtn').onclick = cloudLogout;
  $('#exp').onclick = () => {
    const blob = new Blob([JSON.stringify(db, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `نسخة-احتياطية-${today()}.json`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };
  $('#impMerge').onchange = e => {
    const file = e.target.files[0];
    if (!file) return;
    const r = new FileReader();
    r.onload = () => {
      try {
        const d = JSON.parse(r.result);
        if (!d || (!Array.isArray(d.invoices) && !Array.isArray(d.payments))) throw new Error('bad');
        const a = mergeData(d);
        toast(`تمت الإضافة: ${a.parties} حساب، ${a.invoices} فاتورة، ${a.payments} سند`); render();
      } catch (err) { alert('الملف مش صحيح'); }
    };
    r.readAsText(file);
    e.target.value = '';
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
  const fmtAt = at => at ? new Date(at).toLocaleString('en-GB', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : '';
  const drawLog = () => {
    const t = $('#lt').value, q = $('#lq').value.trim();
    const rows = [
      ...db.invoices.map(i => ({ kind: i.kind, id: i.id, at: i.at, no: i.no, date: i.date, party: partyName(i.partyId),
        label: `فاتورة ${KIND[i.kind]}`, pay: PAYMETHOD[isCredit(i) ? 'credit' : 'cash'], amount: invTotal(i), inv: true })),
      ...db.payments.map(v => ({ kind: v.kind, id: v.id, at: v.at, no: v.no, date: v.date, party: partyName(v.partyId),
        label: PAY[v.kind], pay: '', amount: num(v.amount), inv: false }))
    ].filter(r => !t || r.kind === t)
     .filter(r => !q || normName(r.party).includes(normName(q)) || String(r.no) === q)
     .sort((a, b) => (b.at || 0) - (a.at || 0));
    $('#logList').innerHTML = rows.length ? `<div class="table-wrap"><table class="tbl"><thead><tr>
      <th>وقت الإدخال</th><th>الحركة</th><th>الرقم</th><th>التاريخ</th><th>الحساب</th><th>الدفع</th><th class="num">المبلغ</th><th></th></tr></thead><tbody>
      ${rows.map(r => `<tr><td class="num">${esc(fmtAt(r.at))}</td><td><span class="tag ${r.kind}">${r.label}</span></td>
        <td>${esc(r.no)}</td><td>${esc(r.date)}</td><td>${esc(r.party)}</td><td>${r.pay}</td><td class="num">${money(r.amount)}</td>
        <td><div class="btn-row">${r.inv ? `<a class="btn sm" href="#/invoice/${r.id}">عرض</a>` : ''}
          <button class="btn sm danger" type="button" data-logdel="${r.kind}:${r.id}">حذف</button></div></td></tr>`).join('')}
      </tbody></table></div><p class="hint">عدد الحركات: ${rows.length}</p>` : '<p class="hint">لا توجد حركات.</p>';
  };
  $('#logList').onclick = e => {
    const b = e.target.closest('[data-logdel]');
    if (!b) return;
    const [kind, id] = b.dataset.logdel.split(':');
    if (KIND[kind]) {
      const inv = db.invoices.find(x => x.id === id);
      if (!inv || !confirm(`متأكد بدك تحذف فاتورة ${KIND[kind]} رقم ${inv.no}${getParty(inv.partyId) ? ' — ' + partyName(inv.partyId) : ''} بمبلغ ${money(invTotal(inv))}؟`)) return;
      db.invoices = db.invoices.filter(x => x.id !== id);
    } else {
      const v = db.payments.find(x => x.id === id);
      if (!v || !confirm(`متأكد بدك تحذف ${PAY[kind]} رقم ${v.no} — ${partyName(v.partyId)} بمبلغ ${money(v.amount)}؟`)) return;
      db.payments = db.payments.filter(x => x.id !== id);
    }
    save(); toast('تم حذف الحركة'); drawLog();
  };
  $('#lt').onchange = drawLog; $('#lq').oninput = drawLog;
  drawLog();

  $('#wipe').onclick = () => {
    if (prompt('رح ينمسح كل شي (فواتير، سندات، حسابات، أصناف). للتأكيد اكتب: مسح') !== 'مسح') return;
    db = blankDb(); save(); toast('تم مسح البيانات'); location.hash = '#/home';
  };
}

function notFound() {
  app.innerHTML = `<div class="card"><p>الصفحة غير موجودة. <a href="#/home">رجوع للرئيسية</a></p></div>`;
}

/* =========================================================
   المزامنة بين الأجهزة (Firebase Firestore)
   كل الأجهزة بتسجل دخول بنفس الحساب وبتشوف نفس البيانات
   ========================================================= */
const COLS = ['parties', 'invoices', 'payments'];
const cloud = { on: false, ready: false, user: null, fs: null, root: null, unsub: [], last: { parties: {}, invoices: {}, payments: {}, settings: '' } };
const FB_VER = '10.12.2';

// JSON بترتيب ثابت للمفاتيح، للمقارنة
const stable = v => JSON.stringify(v, (k, val) =>
  val && typeof val === 'object' && !Array.isArray(val)
    ? Object.keys(val).sort().reduce((o, key) => (o[key] = val[key], o), {})
    : val);

function loadScript(src) {
  return new Promise((res, rej) => {
    const el = document.createElement('script');
    el.src = src; el.onload = res; el.onerror = () => rej(new Error(src));
    document.head.appendChild(el);
  });
}

function setSync(state, text) {
  const el = $('#syncDot');
  if (!el) return;
  el.hidden = false;
  el.className = 'sync ' + state;
  el.title = text;
  el.querySelector('span').textContent = text;
  cloud.status = text;
  const st = $('#syncStatus');
  if (st) st.textContent = text;
}

function showGate(mode) {
  let g = $('#gate');
  if (!g) { g = document.createElement('div'); g.id = 'gate'; document.body.appendChild(g); }
  const head = `${logoImg('logo-gate')}<h2>${esc(db.settings.shopName || 'مؤسسة طريق القمة')}</h2>`;
  if (mode === 'loading') {
    g.innerHTML = `<div class="gate-box">${head}<p class="hint">جاري تحميل البيانات...</p><div class="spinner"></div></div>`;
  } else {
    g.innerHTML = `<form class="gate-box" id="loginForm" novalidate>${head}
      <p class="hint">سجّل دخول لتشوف بيانات المؤسسة على هذا الجهاز</p>
      <label>البريد الإلكتروني<input name="email" type="email" autocomplete="username" dir="ltr" required></label>
      <label>كلمة السر<input name="pass" type="password" autocomplete="current-password" dir="ltr" required></label>
      <button class="btn primary" type="submit">دخول</button>
      <p class="hint err" id="loginErr"></p></form>`;
    $('#loginForm').onsubmit = async e => {
      e.preventDefault();
      const f = e.target, btn = $('button', f);
      btn.disabled = true; $('#loginErr').textContent = '';
      try { await firebase.auth().signInWithEmailAndPassword(f.email.value.trim(), f.pass.value); }
      catch (err) {
        $('#loginErr').textContent = err.code === 'auth/network-request-failed'
          ? 'ما في إنترنت. تأكد من الاتصال وجرّب مرة ثانية.'
          : 'الإيميل أو كلمة السر غلط.';
        btn.disabled = false;
      }
    };
  }
  g.hidden = false;
}
const hideGate = () => { const g = $('#gate'); if (g) g.hidden = true; };

async function cloudInit() {
  const cfg = window.FIREBASE_CONFIG;
  if (!cfg) return;
  cloud.on = true;
  showGate('loading');
  setSync('wait', 'جاري الاتصال...');
  try {
    if (!window.firebase) {
      const base = `https://www.gstatic.com/firebasejs/${FB_VER}/`;
      await loadScript(base + 'firebase-app-compat.js');
      await Promise.all([loadScript(base + 'firebase-auth-compat.js'), loadScript(base + 'firebase-firestore-compat.js')]);
    }
    if (!firebase.apps.length) firebase.initializeApp(cfg);
    cloud.fs = firebase.firestore();
    try { await cloud.fs.enablePersistence({ synchronizeTabs: true }); } catch (e) { /* متصفح ما بيدعمها */ }
    cloud.root = cloud.fs.collection('shops').doc(window.FIREBASE_SHOP_ID || 'main');
  } catch (e) {
    console.error(e);
    cloud.on = false;
    hideGate();
    setSync('off', 'المزامنة مش شغالة (ما في إنترنت) — البيانات على هذا الجهاز بس');
    return;
  }
  firebase.auth().onAuthStateChanged(user => {
    cloud.user = user;
    if (!user) { cloudStop(); setSync('off', 'غير مسجّل دخول'); showGate('login'); return; }
    cloudStart();
  });
}

function rememberRemote(remote) {
  for (const c of COLS) cloud.last[c] = Object.fromEntries(remote[c].map(x => [x.id, stable(x)]));
  cloud.last.settings = stable(remote.settings);
}

async function cloudStart() {
  showGate('loading');
  setSync('wait', 'جاري المزامنة...');
  try {
    const [rootSnap, ...snaps] = await Promise.all([cloud.root.get(), ...COLS.map(c => cloud.root.collection(c).get())]);
    const remote = blankDb();
    const rs = rootSnap.exists ? rootSnap.data().settings : null;
    if (rs) remote.settings = { ...remote.settings, ...rs };
    COLS.forEach((c, i) => { remote[c] = snaps[i].docs.map(d => d.data()); });
    rememberRemote(remote);

    // أول مرة هذا الجهاز بيرتبط: ضيف بياناته المحلية للبيانات المشتركة
    const merged = normalizeDb(JSON.parse(JSON.stringify(remote)));
    const linkKey = 'cloud-linked:' + cloud.user.uid;
    let linked = false;
    try { linked = !!localStorage.getItem(linkKey); } catch (e) {}
    if (!linked) {
      const remoteEmpty = COLS.every(c => !remote[c].length);
      const extra = {};
      let n = 0;
      for (const c of COLS) { const ids = new Set(remote[c].map(x => x.id)); extra[c] = db[c].filter(x => x && x.id && !ids.has(x.id)); n += extra[c].length; }
      if (n && (remoteEmpty || confirm(`في ${n} سجل (فواتير وسندات وحسابات) محفوظين على هذا الجهاز بس.\nبدك تضيفهم للبيانات المشتركة؟`))) {
        for (const c of COLS) merged[c].push(...extra[c]);
        if (remoteEmpty && !rs) merged.settings = { ...merged.settings, ...db.settings };
      }
      try { localStorage.setItem(linkKey, '1'); } catch (e) {}
    }
    db = merged;
    saveLocal();
    cloud.ready = true;
    cloudPush();
    cloudListen();
    hideGate();
    render();
  } catch (e) {
    console.error(e);
    hideGate();
    if (e.code === 'permission-denied') {
      setSync('off', 'هذا الحساب ما إله صلاحية على البيانات');
      alert('هذا الحساب ما إله صلاحية على بيانات المؤسسة. تأكد من الإيميل أو من قواعد Firebase.');
    } else {
      setSync('off', 'خطأ بالمزامنة — جرّب تحدّث الصفحة');
    }
  }
}

function cloudStop() {
  cloud.unsub.forEach(u => { try { u(); } catch (e) {} });
  cloud.unsub = [];
  cloud.ready = false;
}

function canRerender() {
  if ($('#dlg').open) return false;
  const name = location.hash.replace(/^#\/?/, '').split('/')[0] || 'home';
  if (['new', 'edit', 'settings'].includes(name)) return false;
  const a = document.activeElement;
  return !(a && /^(INPUT|SELECT|TEXTAREA)$/.test(a.tagName));
}

function cloudListen() {
  cloudStop();
  cloud.ready = true;
  let timer = null;
  const changed = () => {
    saveLocal();
    clearTimeout(timer);
    timer = setTimeout(() => { if (canRerender()) render(true); }, 120);
  };
  const status = snap => {
    if (snap.metadata.hasPendingWrites) setSync('wait', 'جاري الحفظ...');
    else if (snap.metadata.fromCache) setSync('wait', 'بدون إنترنت — بتتزامن لما يرجع النت');
    else setSync('ok', 'متزامن');
  };
  const onErr = e => { console.error(e); setSync('off', 'انقطعت المزامنة — حدّث الصفحة'); };

  for (const c of COLS) {
    cloud.unsub.push(cloud.root.collection(c).onSnapshot({ includeMetadataChanges: true }, snap => {
      status(snap);
      if (!snap.docChanges().length) return;
      db[c] = snap.docs.map(d => d.data());
      cloud.last[c] = Object.fromEntries(db[c].map(x => [x.id, stable(x)]));
      changed();
    }, onErr));
  }
  cloud.unsub.push(cloud.root.onSnapshot(snap => {
    const rs = snap.exists ? snap.data().settings : null;
    if (!rs) return;
    const next = { ...blankDb().settings, ...rs };
    const js = stable(next);
    if (js === stable(db.settings)) { cloud.last.settings = js; return; }
    db.settings = next;
    cloud.last.settings = js;
    $('#shopTitle').textContent = next.shopName;
    changed();
  }, onErr));
}

// بيرفع بس اللي تغيّر من آخر مزامنة
function cloudPush() {
  if (!cloud.ready || !cloud.root) return;
  const ops = [];
  for (const c of COLS) {
    const col = cloud.root.collection(c), seen = new Set();
    for (const x of db[c]) {
      if (!x || !x.id) continue;
      seen.add(x.id);
      const js = stable(x);
      if (cloud.last[c][x.id] !== js) {
        const data = JSON.parse(js);
        ops.push(b => b.set(col.doc(x.id), data));
        cloud.last[c][x.id] = js;
      }
    }
    for (const id of Object.keys(cloud.last[c])) {
      if (!seen.has(id)) { ops.push(b => b.delete(col.doc(id))); delete cloud.last[c][id]; }
    }
  }
  const sj = stable(db.settings);
  if (sj !== cloud.last.settings) {
    const data = JSON.parse(sj);
    ops.push(b => b.set(cloud.root, { settings: data }, { merge: true }));
    cloud.last.settings = sj;
  }
  for (let i = 0; i < ops.length; i += 400) {
    const b = cloud.fs.batch();
    ops.slice(i, i + 400).forEach(f => f(b));
    b.commit().catch(e => {
      console.error(e);
      setSync('off', 'ما انحفظت آخر تعديلات على السيرفر');
      toast('خطأ بالمزامنة: ' + (e.code || e.message));
    });
  }
}

function cloudLogout() {
  if (!confirm('بدك تسجّل خروج من هذا الجهاز؟')) return;
  cloudStop();
  firebase.auth().signOut();
}

/* ---------- مشاركة PDF (واتساب وغيره) ---------- */
function loadVendor() {
  const jobs = [];
  if (!window.html2canvas) jobs.push(loadScript('vendor/html2canvas.min.js'));
  if (!window.jspdf) jobs.push(loadScript('vendor/jspdf.umd.min.js'));
  return Promise.all(jobs);
}

function busy(on, text) {
  let b = $('#busy');
  if (!b) { b = document.createElement('div'); b.id = 'busy'; b.innerHTML = '<div class="gate-box"><div class="spinner"></div><p></p></div>'; document.body.appendChild(b); }
  $('p', b).textContent = text || '';
  b.hidden = !on;
}

async function shareView() {
  const title = (($('.page-head h2') || {}).textContent || 'كشف').trim();
  busy(true, 'جاري تجهيز الملف...');
  let sheet;
  try {
    await loadVendor();
    // نسخة نظيفة من الصفحة على ورق أبيض
    const clone = app.cloneNode(true);
    clone.removeAttribute('id');
    clone.querySelectorAll('.page-head, .filters, .actions, .btn-row, .no-print, .no-pdf, .doc-head, button, input, select, datalist, .combo, .hint').forEach(e => e.remove());
    clone.querySelectorAll('table.cards').forEach(t => t.classList.remove('cards'));
    clone.querySelectorAll('.card').forEach(c => { if (!c.textContent.trim()) c.remove(); });
    const dateStr = new Date().toLocaleDateString('ar', { day: 'numeric', month: 'long', year: 'numeric' });
    sheet = document.createElement('div');
    sheet.className = 'pdf-sheet';
    sheet.innerHTML = `
      <div class="pdf-head">
        <div class="brand">${logoImg('pdf-logo', true)}<div><div class="nm">${esc(db.settings.shopName)}</div><div class="tg">للبرمجة واللوازم المكتبية</div></div></div>
        <div class="doc"><div class="tt">${esc(title)}</div><div class="dt">${dateStr}</div></div>
      </div>
      <div class="pdf-rule"><span></span><i></i><span></span></div>`;
    sheet.appendChild(clone);
    document.body.appendChild(sheet);
    await (document.fonts ? document.fonts.ready : Promise.resolve());
    await Promise.all([...sheet.querySelectorAll('img')].map(i => i.complete ? 0 : new Promise(r => { i.onload = i.onerror = r; })));

    const w = sheet.offsetWidth, h = sheet.offsetHeight;
    const scale = Math.max(1.2, Math.min(2, Math.sqrt(16e6 / (w * h))));
    // حدود الأسطر بتنقاس من نفس النسخة اللي بتنرسم، لتجنب قص سطر بين صفحتين
    let breaks = [], tables = [];
    const measure = root => {
      const top0 = root.getBoundingClientRect().top;
      const Y = el => { const r = el.getBoundingClientRect(); return [(r.top - top0) * scale, (r.bottom - top0) * scale]; };
      breaks = [...root.querySelectorAll('tbody tr, tfoot tr, .doc-sum, .balance-box, .sum-boxes, .doc-meta, .report-total, .stats, p')]
        .map(el => Y(el)[1]).sort((a, b) => a - b);
      tables = [...root.querySelectorAll('table')].map(t => { const th = t.querySelector('thead'); return th ? { head: Y(th), body: Y(t) } : null; }).filter(Boolean);
    };
    const canvas = await html2canvas(sheet, {
      scale, backgroundColor: '#ffffff', useCORS: true, logging: false,
      windowWidth: document.documentElement.clientWidth, windowHeight: window.innerHeight,
      scrollX: 0, scrollY: -window.scrollY,
      onclone: async doc => {
        const root = doc.querySelector('.pdf-sheet');
        if (doc.fonts && doc.fonts.ready) { try { await doc.fonts.ready; } catch (e) {} }
        measure(root);
      }
    });
    if (!breaks.length) measure(sheet);
    const W = canvas.width, PH = Math.floor(W * 297 / 210);
    const footH = Math.round(44 * scale), topM = Math.round(34 * scale);

    // تقسيم الصفحات
    const pages = [];
    let y = 0;
    while (y < canvas.height - 2) {
      const first = !pages.length;
      const tbl = tables.find(t => y > t.head[1] && y < t.body[1]);
      const headH = !first && tbl ? tbl.head[1] - tbl.head[0] : 0;
      const room = PH - footH - (first ? 0 : topM) - headH;
      let end = Math.min(canvas.height, y + room);
      if (end < canvas.height) {
        const b = breaks.filter(v => v > y + 40 * scale && v <= end).pop();
        if (b) end = b;
      }
      pages.push({ y, end, tbl: headH ? tbl : null });
      y = end;
    }

    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF({ unit: 'pt', format: 'a4', orientation: 'portrait' });
    const pw = pdf.internal.pageSize.getWidth(), ph = pdf.internal.pageSize.getHeight();
    const part = document.createElement('canvas');
    part.width = W; part.height = PH;
    const ctx = part.getContext('2d');
    pages.forEach((pg, i) => {
      ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, W, PH);
      let dy = i ? topM : 0;
      if (pg.tbl) {
        const [a, b] = pg.tbl.head;
        ctx.drawImage(canvas, 0, a, W, b - a, 0, dy, W, b - a);
        dy += b - a;
      }
      ctx.drawImage(canvas, 0, pg.y, W, pg.end - pg.y, 0, dy, W, pg.end - pg.y);
      // تذييل
      const fy = PH - footH + 12 * scale, pad = 30 * scale;
      ctx.strokeStyle = '#c9a227'; ctx.lineWidth = 1.2 * scale;
      ctx.beginPath(); ctx.moveTo(pad, fy); ctx.lineTo(W - pad, fy); ctx.stroke();
      ctx.fillStyle = '#6b7280'; ctx.font = `${11 * scale}px Tajawal, Tahoma, sans-serif`;
      ctx.direction = 'rtl'; ctx.textAlign = 'right';
      ctx.fillText(`${db.settings.shopName} — ${title}`, W - pad, fy + 18 * scale);
      ctx.textAlign = 'left';
      ctx.fillText(`صفحة ${i + 1} من ${pages.length}`, pad, fy + 18 * scale);
      if (i) pdf.addPage();
      pdf.addImage(part.toDataURL('image/jpeg', 0.93), 'JPEG', 0, 0, pw, ph);
    });

    const name = `${title} - ${today()}.pdf`.replace(/[\\/:*?"<>|]/g, '-');
    const file = new File([pdf.output('blob')], name, { type: 'application/pdf' });
    busy(false);
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try { await navigator.share({ files: [file], title }); }
      catch (e) { if (e.name !== 'AbortError') throw e; }
    } else {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(file); a.download = name;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 4000);
      toast('تم تنزيل الملف — ابعته من واتساب');
    }
  } catch (e) {
    console.error(e);
    busy(false);
    alert('ما زبط تجهيز الملف. تأكد من الإنترنت وجرّب مرة ثانية.');
  } finally {
    if (sheet) sheet.remove();
  }
}

document.addEventListener('click', e => {
  if (e.target.closest('[data-share]')) { e.preventDefault(); shareView(); }
});

/* ---------- اختيار بالبحث بدل القائمة المنسدلة ---------- */
function comboSelect(sel) {
  if (!sel || sel.dataset.combo) return;
  sel.dataset.combo = '1';
  const wrap = document.createElement('div');
  wrap.className = 'combo';
  sel.parentNode.insertBefore(wrap, sel);
  wrap.appendChild(sel);
  sel.classList.add('combo-native');
  const inp = document.createElement('input');
  inp.type = 'text'; inp.className = 'combo-input'; inp.autocomplete = 'off'; inp.setAttribute('enterkeyhint', 'done');
  const list = document.createElement('div');
  list.className = 'combo-list'; list.hidden = true;
  wrap.append(inp, list);

  const opts = () => [...sel.options];
  const sync = () => {
    const o = sel.options[sel.selectedIndex];
    inp.value = o && o.value ? o.text : '';
    const empty = opts().find(x => !x.value);
    inp.placeholder = '🔍 ' + (empty && !/اختر/.test(empty.text) ? empty.text + ' — أو اكتب للبحث' : 'اكتب الاسم للبحث');
  };
  const draw = () => {
    const q = normName(inp.value);
    const cur = sel.options[sel.selectedIndex];
    const typing = q && !(cur && cur.value && normName(cur.text) === q);
    const items = opts().filter(o => o.value && (!typing || normName(o.text).includes(q)));
    list.innerHTML = items.length
      ? items.map(o => {
          const g = o.parentNode.tagName === 'OPTGROUP' ? `<small>${esc(o.parentNode.label === 'العملاء' ? 'عميل' : 'مورد')}</small>` : '';
          return `<div class="combo-item${o.selected ? ' sel' : ''}" data-v="${esc(o.value)}"><span>${esc(o.text)}</span>${g}</div>`;
        }).join('')
      : '<div class="combo-empty">ما في نتائج</div>';
    list.hidden = false;
  };
  const choose = v => {
    sel.value = v; sync(); list.hidden = true; inp.blur();
    sel.dispatchEvent(new Event('change', { bubbles: true }));
  };
  inp.addEventListener('focus', () => { draw(); setTimeout(() => inp.select(), 0); });
  inp.addEventListener('input', draw);
  ['mousedown', 'pointerdown'].forEach(ev => list.addEventListener(ev, e => e.preventDefault()));
  list.addEventListener('click', e => { const it = e.target.closest('[data-v]'); if (it) choose(it.dataset.v); });
  inp.addEventListener('blur', () => setTimeout(() => {
    list.hidden = true;
    if (!inp.value.trim() && sel.value) { sel.value = ''; sel.dispatchEvent(new Event('change', { bubbles: true })); }
    sync();
  }, 150));
  inp.addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); const first = list.querySelector('[data-v]'); if (first) choose(first.dataset.v); }
    if (e.key === 'Escape') { list.hidden = true; inp.blur(); }
  });
  new MutationObserver(sync).observe(sel, { childList: true, subtree: true });
  sel.addEventListener('change', sync);
  sync();
}

/* ---------- تحسينات العرض: جداول كبطاقات على التلفون + أيقونات العناوين ---------- */
function cardify(root = app) {
  const PRI = ['البيان', 'الاسم', 'الحساب', 'العميل', 'المورد', 'الصنف'];
  const AMT = ['الرصيد', 'الصافي', 'المبلغ', 'المجموع', 'الإجمالي'];
  for (const t of root.querySelectorAll('table.tbl')) {
    const ths = [...t.querySelectorAll('thead th')].map(th => th.textContent.trim());
    if (!ths.length) continue;
    t.classList.add('cards');
    let ti = -1;
    for (const h of PRI) { const i = ths.indexOf(h); if (i >= 0) { ti = i; break; } }
    const di = ths.findIndex(h => h === 'التاريخ' || h === 'وقت الإدخال');
    let ai = -1; ths.forEach((h, i) => { if (AMT.includes(h)) ai = i; });
    for (const tr of t.querySelectorAll('tbody tr:not([data-c]), tfoot tr:not([data-c])')) {
      tr.dataset.c = '1';
      const body = tr.parentNode.tagName === 'TBODY';
      let col = 0;
      for (const cell of [...tr.children]) {
        const span = cell.colSpan || 1;
        cell.dataset.label = span > 1 ? '' : (ths[col] || '');
        if (!cell.querySelector('input, select, textarea')) {
          const w = document.createElement('span'); w.className = 'cv';
          while (cell.firstChild) w.appendChild(cell.firstChild);
          cell.appendChild(w);
        }
        if (!cell.textContent.trim() && !cell.querySelector('input, select, button, a')) cell.classList.add('is-empty');
        if (body && span === 1) {
          if (col === ti) cell.classList.add('c-title');
          if (col === di) cell.classList.add('c-date');
          if (col === ai) cell.classList.add('c-amt');
          if (ths[col] === '#') cell.classList.add('is-empty');
        }
        if (!body && col === 0) cell.classList.add('c-foot');
        col += span;
      }
    }
  }
}

const HEAD_IC = { home: 'home', invoices: a => a === 'purchase' ? 'purchase' : 'sale', new: a => a === 'purchase' ? 'purchase' : 'sale',
  edit: 'sale', invoice: 'sale', payments: a => a === 'payment' ? 'moneyOut' : 'moneyIn', parties: a => a === 'supplier' ? 'truck' : 'users',
  statement: 'ledger', reports: 'chart', report: 'chart', cash: 'chart', settings: 'gear', import: 'list', tax: 'tax' };
function decorate(name, arg) {
  const h = $('.page-head h2', app);
  if (h && !h.querySelector('.ph-ic')) {
    const ic = typeof HEAD_IC[name] === 'function' ? HEAD_IC[name](arg) : HEAD_IC[name];
    if (ic) h.insertAdjacentHTML('afterbegin', `<span class="ph-ic">${icon(ic)}</span>`);
  }
  cardify();
}

function setTab(name, arg) {
  const grp = { home: 'home', reports: 'reports', report: 'reports', cash: 'reports', tax: 'reports', statement: 'statement' }[name]
    || (['invoices', 'new'].includes(name) ? (arg === 'purchase' ? 'purchase' : 'sale')
      : name === 'payments' ? (arg === 'payment' ? 'purchase' : 'sale')
      : name === 'parties' ? (arg === 'supplier' ? 'purchase' : 'sale') : '');
  $$('#tabbar a').forEach(a => a.classList.toggle('active', a.dataset.tab === grp));
}

new MutationObserver(() => {
  cancelAnimationFrame(decorate.raf);
  decorate.raf = requestAnimationFrame(() => cardify());
}).observe(app, { childList: true, subtree: true });

/* ---------- التوجيه ---------- */
const routes = {
  home, new: newInvoice, edit: editInvoice, invoice: viewInvoice, invoices: invoicesList,
  payments: paymentsPage, parties: partiesPage, statement: statementPage,
  cash: cashPage, settings: settingsPage, report: reportPage, reports: reportsPage, import: importPage, tax: taxPage
};

function render(soft) {
  soft = soft === true;
  let [name = 'home', arg = ''] = location.hash.replace(/^#\/?/, '').split('/');
  const fn = routes[name] || home;
  const shop = db.settings.shopName || 'مؤسسة طريق القمة';
  $('#shopTitle').textContent = shop;
  document.title = `${shop} — محاسبة`;
  let navArg = decodeURIComponent(arg);
  if (name === 'report' || name === 'cash') { name = 'reports'; navArg = ''; }
  if (name === 'statement' && getParty(navArg)) navArg = statementPage.state?.all ? 'all' : getParty(navArg).type;
  if (name === 'payments' && !PAY[navArg]) navArg = 'receipt';
  if (name === 'parties' && !PTYPE[navArg]) navArg = 'customer';
  if (name === 'invoices' && !KIND[navArg]) navArg = 'sale';
  if (name === 'statement' && !PTYPE[navArg]) navArg = 'all';
  const full = '#/' + [name, navArg].filter(Boolean).join('/');
  $$('#nav a').forEach(a => {
    const h = a.getAttribute('href');
    a.classList.toggle('active', h === full || (h === '#/' + name && !navArg));
  });
  if (!soft) {
    document.body.classList.remove('nav-open');
    if ($('#dlg').open) $('#dlg').close();
  }
  const y = window.scrollY;
  fn(decodeURIComponent(arg));
  decorate(name, decodeURIComponent(arg));
  setTab(name, decodeURIComponent(arg));
  window.scrollTo(0, soft ? y : 0);
}

$$('[data-ic]').forEach(el => el.insertAdjacentHTML('afterbegin', icon(el.dataset.ic)));
$$('[data-emblem]').forEach(el => { el.innerHTML = logoImg('logo-top'); });
$('#menuBtn').onclick = () => document.body.classList.toggle('nav-open');
$('#navShade').onclick = () => document.body.classList.remove('nav-open');
window.addEventListener('hashchange', () => render());
// تحديث الصفحة إذا تغيّرت البيانات من تبويب ثاني (بدون مزامنة)
window.addEventListener('storage', e => { if (e.key === DB_KEY && !cloud.on) { db = loadDb(); render(true); } });
render();
cloudInit();
