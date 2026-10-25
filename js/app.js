/* ממשק האפליקציה */
(function () {
  'use strict';
  const L = window.Logic;
  const KEY = 'miluim-team-v1';
  const $ = (s, el = document) => el.querySelector(s);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const pad = (n) => String(n).padStart(2, '0');
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

  // ===== אחסון =====
  function normalize(d) {
    d.soldiers = Array.isArray(d.soldiers) ? d.soldiers : [];
    d.absences = Array.isArray(d.absences) ? d.absences : [];
    d.settings = Object.assign({ unitName: 'הצוות שלי', minThreshold: 10, theme: 'auto' }, d.settings || {});
    d.version = 1;
    return d;
  }
  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) return normalize(JSON.parse(raw));
    } catch (e) { /* נתונים פגומים: נטען נתוני פתיחה */ }
    return null;
  }
  // גרסת תנועות: אם בקוד יש תנועות חדשות יותר ממה שבטלפון, מחליפים רק את התנועות
  let migrated = false;
  let state = load();
  if (!state) { state = normalize(Seed.create()); save(); }
  else if ((state.movesVersion || 1) < Seed.MOVES_VERSION) {
    state.absences = Seed.moves(state.soldiers);
    state.movesVersion = Seed.MOVES_VERSION;
    migrated = true;
    save();
  }
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { toast('⚠️ השמירה נכשלה'); }
  }

  // ===== זמן =====
  function todayIso() { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
  function nowPoint() { const d = new Date(); return { date: todayIso(), time: `${pad(d.getHours())}:${pad(d.getMinutes())}` }; }
  const nowSlot = () => L.slotOf(nowPoint());

  const ui = { tab: 'today', date: todayIso(), part: null, weekDate: todayIso() };

  // ===== עזרי תצוגה =====
  const initials = (name) => name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join('');
  const lvl = (count, total) => 'lvl-' + L.level(count, total, state.settings.minThreshold);
  const lvlText = { ok: '✅ מלא', warn: '🟡 חוסר', bad: '🔴 מתחת לסף' };
  const soldier = (id) => state.soldiers.find((s) => s.id === id);
  const typeBadge = (a) => { const t = L.TYPES[a.type] || L.TYPES.other; return `<span class="badge">${t.emoji} ${t.label}</span>`; };
  const pendingCount = () => state.absences.filter((a) => a.status === 'pending' && soldier(a.soldierId)?.active !== false).length;
  const avatar = (s, extra = '') => `<span class="avatar ${s.active === false ? 'off' : ''}">${esc(initials(s.name))}${extra}</span>`;
  const mini = (row) => `<span class="mini" aria-hidden="true">${row.parts.map((p) => `<i class="${p.absent ? 'x' : ''}"></i>`).join('')}</span>`;

  function ring(count, total) {
    const C = 2 * Math.PI * 58;
    const ratio = total ? count / total : 0;
    return `<div class="ring ${lvl(count, total)}">
      <svg viewBox="0 0 136 136"><circle class="track" cx="68" cy="68" r="58" fill="none" stroke-width="13"/>
      <circle class="prog" cx="68" cy="68" r="58" fill="none" stroke-width="13" stroke-linecap="round"
        stroke-dasharray="${C}" stroke-dashoffset="${C}" data-target="${C * (1 - ratio)}"/></svg>
      <div class="num"><b dir="ltr">${count}<small>/${total}</small></b><span>בבסיס</span></div></div>`;
  }
  function animateRings() {
    document.querySelectorAll('.ring .prog[data-target]').forEach((c) => {
      requestAnimationFrame(() => { c.style.strokeDashoffset = c.dataset.target; });
    });
  }

  // ===== מסך היום =====
  function viewToday() {
    const ds = L.dayStatus(state, ui.date);
    const isToday = ui.date === todayIso();
    const sel = ui.part;
    const count = sel == null ? ds.min : ds.partCounts[sel];
    const lv = L.level(count, ds.total, state.settings.minThreshold);
    const nowPart = isToday ? L.slotToPoint(nowSlot()) : null;

    let h = `<div class="daynav">
      <button class="navbtn" data-act="day" data-d="-1" aria-label="היום הקודם">→</button>
      <div class="mid"><b>${L.dayLabel(ui.date)}</b>
        ${isToday ? '<span class="today-pill">היום</span>' : '<button class="today-pill go" data-act="day-today">↩ חזרה להיום</button>'}</div>
      <button class="navbtn" data-act="day" data-d="1" aria-label="היום הבא">←</button></div>`;

    h += `<section class="card"><div class="hero">${ring(count, ds.total)}
      <div class="hero-info"><div class="big">${count} מתוך ${ds.total}</div>
        <div class="muted">${sel == null ? 'מינימום לאורך היום' : `ב${L.PARTS[sel].name} (${L.PARTS[sel].hours})`}</div>
        <div style="margin-top:8px"><span class="badge lvl-${lv}">${lvlText[lv]}</span></div>
        ${ds.total === 0 ? '<div class="muted" style="margin-top:6px">אין חיילים פעילים</div>' : ''}</div></div>
      <div class="parts" role="tablist">
        <button class="part ${sel == null ? 'sel' : ''}" data-act="part" data-p=""><span class="e">📆</span><b>${ds.min}</b><span class="n">כל היום</span></button>
        ${L.PARTS.map((p, i) => `<button class="part ${lvl(ds.partCounts[i], ds.total)} ${sel === i ? 'sel' : ''}" data-act="part" data-p="${i}">
          <span class="e">${p.emoji}</span><b>${ds.partCounts[i]}</b><span class="n">${p.name}${nowPart && nowPart.date === ui.date && nowPart.part === i ? ' •' : ''}</span></button>`).join('')}
      </div></section>`;

    const pend = [...new Set([...ds.pendingDay, ...ds.pendingUndated])];
    if (pend.length) {
      h += `<div class="alert"><span>⚠️</span><div><b>בקשות יציאה ממתינות לאישור</b> <small class="muted">(לא מורידות מהספירה)</small>
        <ul>${pend.map((a) => `<li>${esc(L.nameOf(state, a.soldierId))}: ${esc(L.reasonText(a))} · ${L.hasDate(a.start) ? esc(L.fmtPoint(a.start)) : 'ללא תאריך'}</li>`).join('')}</ul>
        <button class="btn sm" style="margin-top:8px" data-act="tab" data-tab="moves">לאישור / דחייה</button></div></div>`;
    }

    const missingRow = (r, slot, desc) => {
      const ri = L.returnInfo(state, r.soldier.id, slot);
      return `<button class="row ${r.reasons.some((a) => a.tentative) ? 'tent' : ''}" data-act="soldier" data-id="${r.soldier.id}">${avatar(r.soldier)}
        <span class="body"><span class="name">${esc(r.soldier.name)}</span>
          <span class="sub">${desc ? esc(desc) + ' · ' : ''}${esc(r.reasons.map(L.reasonText).join(', '))}</span>
          ${ri ? `<span class="ret">🏠 ${esc(L.returnText(ri))}</span>` : ''}</span>${mini(r)}</button>`;
    };
    const presentChips = (rows) => rows.length
      ? `<div class="pchips">${rows.map((r, i) => `<button class="pchip" style="animation-delay:${i * 20}ms" data-act="quick" data-id="${r.soldier.id}">
          ${esc(r.soldier.name)}${r.pendings.length ? '<span class="warn-i" title="בקשה ממתינה">⚠️</span>' : ''}</button>`).join('')}</div>
         <p class="muted" style="font-size:13px;margin:10px 0 0">💡 לחיצה על שם = הוספת יציאה מהירה</p>`
      : '<div class="empty"><span class="big">🫥</span>אין</div>';

    if (sel == null) {
      h += `<section class="card"><h2>❌ חסרים כל היום <span class="count">${ds.missing.length}</span></h2>
        ${ds.missing.length ? ds.missing.map((r) => missingRow(r, ds.base + 3)).join('') : '<div class="empty"><span class="big">💪</span>אין חסרים</div>'}</section>`;
      if (ds.partial.length) {
        h += `<section class="card"><h2>🔄 נוכחות חלקית <span class="count">${ds.partial.length}</span></h2>
          ${ds.partial.map((r) => missingRow(r, r.parts[3].absent ? ds.base + 3 : ds.base + r.parts.findIndex((p) => p.absent), L.describePartial(r))).join('')}</section>`;
      }
      h += `<section class="card"><h2>✅ נוכחים כל היום <span class="count">${ds.full.length}</span></h2>${presentChips(ds.full)}</section>`;
    } else {
      const abs = ds.rows.filter((r) => r.parts[sel].absent);
      const pres = ds.rows.filter((r) => !r.parts[sel].absent);
      h += `<section class="card"><h2>❌ חסרים ב${L.PARTS[sel].name} <span class="count">${abs.length}</span></h2>
        ${abs.length ? abs.map((r) => missingRow(r, ds.base + sel)).join('') : '<div class="empty"><span class="big">💪</span>אין חסרים</div>'}</section>
        <section class="card"><h2>✅ נוכחים ב${L.PARTS[sel].name} <span class="count">${pres.length}</span></h2>${presentChips(pres)}</section>`;
    }
    return h;
  }

  // ===== מסך שבועי =====
  function viewWeek() {
    const days = L.weekStatus(state, ui.weekDate);
    const ws = days[0].date;
    const today = todayIso();
    const min = state.settings.minThreshold;
    const worst = days.reduce((a, b) => (b.min < a.min ? b : a));
    const avg = days.reduce((s, d) => s + d.min, 0) / 7;
    let h = `<div class="daynav">
      <button class="navbtn" data-act="week" data-d="-7" aria-label="השבוע הקודם">→</button>
      <div class="mid"><b>שבוע ${L.fmtDate(ws)} – ${L.fmtDate(L.addDays(ws, 6))}</b>
        ${L.weekStart(today) === ws ? '<span class="today-pill">השבוע</span>' : '<button class="today-pill go" data-act="week-this">↩ לשבוע הנוכחי</button>'}</div>
      <button class="navbtn" data-act="week" data-d="7" aria-label="השבוע הבא">←</button></div>
      <div class="legend"><span class="badge lvl-ok">🟢 מלא</span><span class="badge lvl-warn">🟡 חוסר</span><span class="badge lvl-bad">🔴 מתחת ל-${min}</span>
      <span class="badge">📉 שפל: ${worst.min} (${L.dayName(worst.date)})</span><span class="badge">⌀ ${avg.toFixed(1)}</span></div>`;
    h += days.map((d, i) => `<button class="wk-row ${lvl(d.min, d.total)} ${d.date === today ? 'is-today' : ''}" style="animation-delay:${i * 40}ms" data-act="open-day" data-date="${d.date}">
        <span class="wk-day"><b>${L.dayName(d.date)}</b><small class="muted">${L.fmtDate(d.date)}</small></span>
        <span class="wk-bars">${d.partCounts.map((c, p) => `<div class="${lvl(c, d.total)}"><i style="height:${d.total ? Math.max(4, Math.round((c / d.total) * 34)) : 4}px"></i><span>${L.PARTS[p].emoji}${c}</span></div>`).join('')}</span>
        <span class="wk-count" dir="ltr"><b>${d.min}${d.rows.some((r) => r.reasons.some((a) => a.tentative)) ? '<sup title="יש תנועה לא סופית">❓</sup>' : ''}</b><small>/${d.total}</small></span></button>`).join('');
    h += `<p class="muted" style="font-size:13px;text-align:center;margin-bottom:0">❓ = יש באותו יום תנועה לא סופית</p>`;
    h += `<p class="muted" style="font-size:13px;text-align:center">המספר הגדול = מינימום הנוכחים ביום · לחיצה על יום לפירוט</p>`;
    return h;
  }

  // ===== מסך תנועות =====
  function moveItem(a) {
    const s = soldier(a.soldierId);
    if (!s) return '';
    const st = a.status === 'pending' ? '<span class="badge lvl-warn">⏳ ממתין לאישור</span>' : a.status === 'rejected' ? '<span class="badge lvl-bad">✖ נדחה</span>' : '';
    return `<div class="mv ${a.status} ${a.tentative ? 'tent' : ''}"><button class="mv-main" data-act="abs-edit" data-id="${a.id}">
      <span class="mv-top"><b>${esc(s.name)}</b>${typeBadge(a)}${a.tentative ? '<span class="badge tent-b">❓ לא סופי</span>' : ''}${st}</span>
      <span class="mv-range" style="display:block">🚪 ${esc(L.fmtPoint(a.start))}${L.hasDate(a.start) ? ` ⟵ 🏠 ${L.hasDate(a.end) ? esc(L.fmtPoint(a.end)) : a.type === 'notjoined' ? 'תאריך לא ידוע' : 'לא חוזר / פתוח'}` : ''}</span>
      ${a.note ? `<span class="mv-note" style="display:block">${esc(a.note)}</span>` : ''}</button>
      ${a.status === 'pending' ? `<div class="mv-act"><button class="btn ok sm" data-act="abs-approve" data-id="${a.id}">✔ אישור</button><button class="btn danger fill sm" data-act="abs-reject" data-id="${a.id}">✖ דחייה</button></div>` : ''}</div>`;
  }
  function viewMoves() {
    const now = nowSlot();
    const list = state.absences.filter((a) => soldier(a.soldierId));
    const bySlot = (a, b) => (L.slotOf(a.start) ?? Infinity) - (L.slotOf(b.start) ?? Infinity);
    const pending = list.filter((a) => a.status === 'pending').sort(bySlot);
    const approved = list.filter((a) => a.status === 'approved').sort(bySlot);
    const active = approved.filter((a) => L.endSlot(a) > now);
    const past = approved.filter((a) => L.endSlot(a) <= now).reverse();
    const rejected = list.filter((a) => a.status === 'rejected');
    let h = `<button class="btn primary block" data-act="abs-new" style="margin-bottom:14px">➕ היעדרות / בקשה חדשה</button>`;
    h += `<section class="card"><h2>⏳ ממתינות לאישור <span class="count">${pending.length}</span></h2>
      ${pending.length ? pending.map(moveItem).join('') : '<div class="empty">אין בקשות פתוחות 👌</div>'}</section>`;
    h += `<section class="card"><h2>📌 פעילות ועתידיות <span class="count">${active.length}</span></h2>
      ${active.length ? active.map(moveItem).join('') : '<div class="empty"><span class="big">🏕️</span>אין תנועות מתוכננות</div>'}</section>`;
    if (past.length) h += `<section class="card"><details><summary>📜 היסטוריה (${past.length})</summary>${past.map(moveItem).join('')}</details></section>`;
    if (rejected.length) h += `<section class="card"><details><summary>✖ בקשות שנדחו (${rejected.length})</summary>${rejected.map(moveItem).join('')}</details></section>`;
    return h;
  }

  // ===== מסך חיילים =====
  function viewSoldiers() {
    const now = nowSlot();
    const act = state.soldiers.filter((s) => s.active !== false);
    const inact = state.soldiers.filter((s) => s.active === false);
    const row = (s) => {
      const away = L.absenceAt(state, s.id, now);
      const dot = s.active === false ? '' : `<i class="st ${away ? 'lvl-bad' : 'lvl-ok'}"></i>`;
      return `<div class="row">
        <button class="row" style="padding:0;border:0;flex:1" data-act="soldier" data-id="${s.id}">${avatar(s, dot)}
          <span class="body"><span class="name">${esc(s.name)}</span>
          <span class="sub">${[s.role, away ? 'בחוץ כרגע' : s.active === false ? 'לא פעיל' : 'בבסיס כרגע'].filter(Boolean).map(esc).join(' · ')}</span>
          ${s.notes ? `<span class="sub" style="display:block;font-size:13px">📝 ${esc(s.notes)}</span>` : ''}</span></button>
        <label class="switch" title="פעיל"><input type="checkbox" data-act="soldier-toggle" data-id="${s.id}" ${s.active !== false ? 'checked' : ''} aria-label="פעיל"><span></span></label></div>`;
    };
    return `<button class="btn primary block" data-act="soldier-new" style="margin-bottom:14px">➕ הוספת חייל</button>
      <section class="card"><h2>🎖️ פעילים <span class="count">${act.length}</span></h2>
        ${act.length ? act.map(row).join('') : '<div class="empty"><span class="big">🪖</span>עוד אין חיילים</div>'}</section>
      ${inact.length ? `<section class="card"><h2>💤 לא פעילים <span class="count">${inact.length}</span></h2>${inact.map(row).join('')}</section>` : ''}
      <p class="muted" style="font-size:13px;text-align:center">המתג מסמן חייל פעיל. חייל לא פעיל לא נספר.</p>`;
  }

  // ===== הגדרות =====
  let installEvt = null;
  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); installEvt = e; if (ui.tab === 'settings') render(false); });
  function viewSettings() {
    const st = state.settings;
    const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone;
    return `<section class="card"><h2>🏷️ שם הצוות</h2>
        <input type="text" id="set-unit" value="${esc(st.unitName)}" maxlength="40" placeholder="למשל: צוות 3, פלוגה ב׳"></section>
      <section class="card"><h2>📉 סף מינימום</h2>
        <p class="muted" style="margin:0 0 10px;font-size:14px">מתחת למספר הזה היום יסומן באדום.</p>
        <div class="stepper"><button class="navbtn" data-act="min" data-d="1">＋</button><b>${st.minThreshold}</b><button class="navbtn" data-act="min" data-d="-1">－</button>
        <span class="muted">מתוך ${L.activeSoldiers(state).length} פעילים</span></div></section>
      <section class="card"><h2>🌗 מצב תצוגה</h2>
        <div class="seg">${[['auto', '🔄 אוטומטי'], ['light', '☀️ בהיר'], ['dark', '🌙 כהה']].map(([k, t]) => `<button class="${st.theme === k ? 'on' : ''}" data-act="theme" data-v="${k}">${t}</button>`).join('')}</div></section>
      <section class="card"><h2>💾 גיבוי</h2>
        <p class="muted" style="margin:0 0 10px;font-size:14px">הנתונים נשמרים רק במכשיר הזה. כדאי לייצא גיבוי מדי פעם.</p>
        <div class="stack"><button class="btn block" data-act="export">⬇️ ייצוא נתונים (JSON)</button>
        <button class="btn block" data-act="import">⬆️ ייבוא מקובץ גיבוי</button></div></section>
      ${standalone ? '' : `<section class="card"><h2>📲 התקנה למסך הבית</h2>
        ${installEvt ? '<button class="btn primary block" data-act="install">📲 התקנת האפליקציה</button>' : ''}
        <p style="margin:10px 0 0;font-size:14px"><b>אייפון (Safari):</b> כפתור השיתוף ⬆️ ואז "הוסף למסך הבית".<br><b>אנדרואיד (Chrome):</b> תפריט ⋮ ואז "התקנת אפליקציה" או "הוספה למסך הבית".</p></section>`}
      <section class="card"><h2>🧹 איפוס</h2><div class="stack">
        <button class="btn block" data-act="reset-moves">🧽 איפוס תנועות</button>
        <p class="muted" style="font-size:13px;margin:4px 0 0">מוחק את כל התנועות, ההיעדרויות והבקשות. החיילים וההגדרות נשארים.</p>
        <button class="btn block" data-act="reset-seed">🔁 טעינת נתוני הפתיחה מחדש</button>
        <button class="btn danger block" data-act="clear-all">🗑️ מחיקת כל הנתונים</button></div></section>
      <p class="foot">הצוות שלי · עובד גם בלי אינטרנט 📶✖️</p>`;
  }

  // ===== רינדור =====
  const VIEWS = { today: viewToday, week: viewWeek, moves: viewMoves, soldiers: viewSoldiers, settings: viewSettings };
  function render(animate = true) {
    document.querySelectorAll('.tabbar button').forEach((b) => b.classList.toggle('active', b.dataset.tab === ui.tab));
    const v = $('#view');
    v.innerHTML = VIEWS[ui.tab]();
    if (animate) { v.classList.remove('enter'); void v.offsetWidth; v.classList.add('enter'); }
    $('#fab').hidden = ui.tab !== 'today';
    $('#pending-dot').hidden = !pendingCount();
    $('#unit-name').textContent = state.settings.unitName || 'הצוות שלי';
    document.title = state.settings.unitName || 'הצוות שלי';
    animateRings();
  }
  function commit(msg, undo) { save(); render(false); if (msg) toast(msg, undo); }

  function applyTheme() {
    const t = state.settings.theme;
    if (t === 'auto') delete document.documentElement.dataset.theme;
    else document.documentElement.dataset.theme = t;
    const dark = t === 'dark' || (t === 'auto' && matchMedia('(prefers-color-scheme: dark)').matches);
    $('meta[name=theme-color]').setAttribute('content', dark ? '#161911' : '#556b2f');
  }
  matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', applyTheme);

  // ===== טוסט =====
  let toastTimer;
  function toast(msg, undo) {
    const t = $('#toast');
    t.innerHTML = `<span>${esc(msg)}</span>${undo ? '<button>ביטול</button>' : ''}`;
    if (undo) t.querySelector('button').onclick = () => { undo(); t.classList.remove('show'); };
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('show'), undo ? 5000 : 2600);
  }

  // ===== גיליון תחתון =====
  function openSheet(title, html) {
    closeSheet(true);
    const bg = document.createElement('div');
    bg.className = 'sheet-bg';
    const el = document.createElement('div');
    el.className = 'sheet';
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-modal', 'true');
    el.innerHTML = `<div class="grab"></div><div class="sheet-head"><h3>${title}</h3><button class="close-x" data-s="close" aria-label="סגירה">✕</button></div><div class="sheet-body">${html}</div>`;
    bg.onclick = () => closeSheet();
    el.addEventListener('click', (e) => { if (e.target.closest('[data-s="close"]')) closeSheet(); });
    document.body.append(bg, el);
    document.body.style.overflow = 'hidden';
    return el;
  }
  function closeSheet(instant) {
    const els = document.querySelectorAll('.sheet, .sheet-bg');
    if (!els.length) return;
    document.body.style.overflow = '';
    if (instant) { els.forEach((e) => e.remove()); return; }
    els.forEach((e) => { e.classList.add('closing'); setTimeout(() => e.remove(), 200); });
  }
  const setBody = (el, html) => { el.querySelector('.sheet-body').innerHTML = html; };

  // ===== יציאה מהירה: חייל ← מתי יוצא ← מתי חוזר =====
  function openQuick(presetId) {
    const base = ui.date;
    const isToday = base === todayIso();
    const q = { soldierId: presetId || null, start: null };
    const el = openSheet('⚡ יציאה מהירה', '');
    const steps = (n) => `<div class="qsteps">${[1, 2, 3].map((i) => `<i class="${i <= n ? 'on' : ''}"></i>`).join('')}</div>`;

    function stepSoldier() {
      const ds = L.dayStatus(state, base);
      const rows = [...ds.rows].sort((a, b) => a.absentCount - b.absentCount);
      setBody(el, `${steps(1)}<p class="muted" style="margin:0 0 10px">מי יוצא?</p><div class="qgrid">
        ${rows.map((r, i) => `<button class="qbtn ${r.absentCount === 4 ? 'dim' : ''}" style="animation-delay:${i * 15}ms" data-q="sol" data-id="${r.soldier.id}">${avatar(r.soldier)}<span>${esc(r.soldier.name)}</span></button>`).join('')}
        </div>`);
    }
    function stepStart() {
      const s = soldier(q.soldierId);
      const opts = [];
      const curPart = isToday ? L.slotToPoint(nowSlot()) : null;
      if (isToday) opts.push(['⚡ עכשיו', nowPoint()]);
      L.PARTS.slice(0, 3).forEach((p, i) => {
        if (!curPart || curPart.date !== base || i > curPart.part) opts.push([`${p.emoji} ${isToday ? 'היום ב' : ''}${p.name}`, { date: base, part: i }]);
      });
      opts.push([`🌅 ${isToday ? 'מחר' : 'למחרת'} בבוקר`, { date: L.addDays(base, 1), part: 0 }]);
      q.startOpts = opts;
      setBody(el, `${steps(2)}<p style="margin:0 0 10px"><b>${esc(s.name)}</b> · מתי יוצא? <span class="muted">(${L.dayLabel(base)})</span></p><div class="qgrid">
        ${opts.map((o, i) => `<button class="qbtn" style="animation-delay:${i * 30}ms" data-q="start" data-i="${i}">${o[0]}</button>`).join('')}
        <button class="qbtn wide" data-q="full">📝 טופס מלא (סוג, שעה, הערה)</button></div>`);
    }
    function stepEnd() {
      const s = soldier(q.soldierId);
      const st = q.start;
      const sp = L.slotToPoint(L.slotOf(st));
      const opts = [['🔓 לא חוזר / פתוח', null]];
      if (sp.part < 2) opts.push(['🌆 באותו יום בערב', { date: st.date, part: 2 }]);
      opts.push(['🌅 למחרת בבוקר', { date: L.addDays(st.date, 1), part: 0 }]);
      opts.push(['📆 בעוד יומיים', { date: L.addDays(st.date, 2), part: 0 }]);
      const toSun = 7 - L.weekday(st.date);
      if (toSun > 2) opts.push(['🗓️ ראשון בבוקר', { date: L.addDays(st.date, toSun), part: 0 }]);
      q.endOpts = opts;
      setBody(el, `${steps(3)}<p style="margin:0 0 10px"><b>${esc(s.name)}</b> · יוצא ${esc(L.fmtPoint(st))}. מתי חוזר?</p><div class="qgrid">
        ${opts.map((o, i) => `<button class="qbtn" style="animation-delay:${i * 30}ms" data-q="end" data-i="${i}">${o[0]}${o[1] ? `<small class="muted" style="margin-inline-start:auto">${L.fmtDate(o[1].date)}</small>` : ''}</button>`).join('')}
        <button class="qbtn wide" data-q="back">→ חזרה</button></div>`);
    }
    el.addEventListener('click', (e) => {
      const b = e.target.closest('[data-q]');
      if (!b) return;
      const k = b.dataset.q;
      if (k === 'sol') { q.soldierId = b.dataset.id; stepStart(); }
      else if (k === 'start') { q.start = q.startOpts[+b.dataset.i][1]; stepEnd(); }
      else if (k === 'back') stepStart();
      else if (k === 'full') { closeSheet(true); openAbsenceForm({ soldierId: q.soldierId, start: { date: base, part: 0 } }); }
      else if (k === 'end') {
        const end = q.endOpts[+b.dataset.i][1];
        const a = { id: uid(), soldierId: q.soldierId, type: 'exit', status: 'approved', start: q.start, end, note: '', tentative: false };
        if (end && L.slotOf(end) <= L.slotOf(a.start)) return toast('⚠️ החזרה חייבת להיות אחרי היציאה');
        state.absences.push(a);
        closeSheet();
        commit(`✅ נוספה יציאה ל${soldier(a.soldierId).name}`, () => {
          state.absences = state.absences.filter((x) => x.id !== a.id); commit('↩ בוטל');
        });
      }
    });
    if (presetId) stepStart(); else stepSoldier();
  }

  // ===== טופס היעדרות מלא =====
  function openAbsenceForm({ id, soldierId, start, status } = {}) {
    const existing = id ? state.absences.find((a) => a.id === id) : null;
    const actives = state.soldiers.filter((s) => s.active !== false || s.id === existing?.soldierId);
    if (!actives.length) return toast('צריך להוסיף חיילים קודם');
    const clonePt = (p) => (p && p.date ? { date: p.date, part: p.part ?? 0, time: p.time || '' } : null);
    const f = existing
      ? { soldierId: existing.soldierId, type: existing.type, status: existing.status, note: existing.note || '',
          start: clonePt(existing.start) || { date: ui.date, part: 0, time: '' }, end: clonePt(existing.end) || { date: L.addDays(ui.date, 1), part: 0, time: '' },
          noDate: !L.hasDate(existing.start), open: !L.hasDate(existing.end), tentative: !!existing.tentative }
      : { soldierId: soldierId || actives[0].id, type: 'exit', status: 'approved', note: '',
          start: clonePt(start) || { date: ui.date, part: 0, time: '' }, end: { date: L.addDays((start && start.date) || ui.date, 1), part: 0, time: '' },
          noDate: false, open: false, tentative: false };
    if (status) { f.status = status; f.noDate = false; }
    f.startMode = f.start.time ? 'time' : 'part';
    f.endMode = f.end.time ? 'time' : 'part';

    const el = openSheet(existing ? '✏️ עריכת היעדרות' : '➕ היעדרות חדשה', '');
    const ptEditor = (k, title) => {
      const p = f[k];
      const mode = f[k + 'Mode'];
      return `<label class="fl">📅 תאריך</label><input type="date" data-f="${k}.date" value="${p.date}">
        <label class="fl">🕐 מתי ביום</label>
        <div class="seg" style="margin-bottom:10px"><button class="${mode === 'part' ? 'on' : ''}" data-s="mode" data-k="${k}" data-v="part">חלק יום</button><button class="${mode === 'time' ? 'on' : ''}" data-s="mode" data-k="${k}" data-v="time">שעה מדויקת</button></div>
        ${mode === 'part'
          ? `<div class="chips">${L.PARTS.map((pp, i) => `<button class="chip ${p.part === i ? 'on' : ''}" data-s="part" data-k="${k}" data-v="${i}">${pp.emoji} ${pp.name}</button>`).join('')}</div>`
          : `<input type="time" data-f="${k}.time" value="${p.time || '12:00'}">`}`;
    };
    function draw() {
      setBody(el, `
        <label class="fl">🪖 חייל</label>
        <select data-f="soldierId">${actives.map((s) => `<option value="${s.id}" ${s.id === f.soldierId ? 'selected' : ''}>${esc(s.name)}</option>`).join('')}</select>
        <label class="fl">🏷️ סוג</label>
        <div class="chips">${Object.entries(L.TYPES).map(([k, t]) => `<button class="chip ${f.type === k ? 'on' : ''}" data-s="type" data-v="${k}">${t.emoji} ${t.label}</button>`).join('')}</div>
        <label class="fl">📋 סטטוס</label>
        <div class="seg">${[['approved', '✅ מאושר'], ['pending', '⏳ ממתין'], ['rejected', '✖ נדחה']].map(([k, t]) => `<button class="${f.status === k ? 'on' : ''}" data-s="status" data-v="${k}">${t}</button>`).join('')}</div>
        ${f.status === 'pending' ? '<p class="muted" style="font-size:13px;margin:6px 0 0">בקשה ממתינה לא מורידה מהספירה, אבל מוצגת כאזהרה.</p>' : ''}
        <div class="fieldset"><label class="fl">🚪 יציאה / תחילת היעדרות</label>
          ${f.status === 'pending' ? `<label class="check"><span class="switch"><input type="checkbox" data-s="nodate" ${f.noDate ? 'checked' : ''}><span></span></span>עוד אין תאריך</label>` : ''}
          ${f.noDate && f.status === 'pending' ? '' : ptEditor('start')}</div>
        ${f.noDate && f.status === 'pending' ? '' : `<div class="fieldset"><label class="fl">🏠 חזרה / הגעה לבסיס</label>
          <label class="check"><span class="switch"><input type="checkbox" data-s="open" ${f.open ? 'checked' : ''}><span></span></span>לא חוזר / פתוח</label>
          ${f.open ? '' : ptEditor('end')}</div>`}
        <label class="check"><span class="switch"><input type="checkbox" data-s="tentative" ${f.tentative ? 'checked' : ''}><span></span></span>❓ לא סופי (עדיין לא סגור)</label>
        <label class="fl">📝 הערה</label><textarea data-f="note" placeholder="למשל: חתונה של אח">${esc(f.note)}</textarea>
        <div class="btns"><button class="btn primary" data-s="save">💾 שמירה</button>${existing ? '<button class="btn danger" data-s="delete">🗑️ מחיקה</button>' : ''}</div>`);
    }
    el.addEventListener('input', (e) => {
      const k = e.target.dataset.f;
      if (!k) return;
      const [a, b] = k.split('.');
      if (b) f[a][b] = e.target.value; else f[a] = e.target.value;
    });
    el.addEventListener('click', (e) => {
      const b = e.target.closest('[data-s]');
      if (!b) return;
      const s = b.dataset.s;
      if (s === 'type') f.type = b.dataset.v;
      else if (s === 'status') f.status = b.dataset.v;
      else if (s === 'mode') { f[b.dataset.k + 'Mode'] = b.dataset.v; if (b.dataset.v === 'time' && !f[b.dataset.k].time) f[b.dataset.k].time = '12:00'; }
      else if (s === 'part') f[b.dataset.k].part = +b.dataset.v;
      else if (s === 'nodate') f.noDate = b.checked;
      else if (s === 'open') f.open = b.checked;
      else if (s === 'tentative') f.tentative = b.checked;
      else if (s === 'save') return doSave();
      else if (s === 'delete') {
        if (!confirm('למחוק את ההיעדרות?')) return;
        const idx = state.absences.indexOf(existing);
        state.absences.splice(idx, 1);
        closeSheet();
        return commit('🗑️ נמחק', () => { state.absences.splice(idx, 0, existing); commit('↩ שוחזר'); });
      } else return;
      draw();
    });
    function pt(k) {
      const p = f[k];
      return f[k + 'Mode'] === 'time' ? { date: p.date, time: p.time || '12:00' } : { date: p.date, part: p.part ?? 0 };
    }
    function doSave() {
      const noDate = f.noDate && f.status === 'pending';
      const a = { id: existing ? existing.id : uid(), soldierId: f.soldierId, type: f.type, status: f.status, note: f.note.trim(), tentative: f.tentative, start: null, end: null };
      if (!noDate) {
        if (!f.start.date) return toast('⚠️ חסר תאריך יציאה');
        a.start = pt('start');
        if (!f.open) {
          if (!f.end.date) return toast('⚠️ חסר תאריך חזרה');
          a.end = pt('end');
          if (L.slotOf(a.end) <= L.slotOf(a.start)) return toast('⚠️ החזרה חייבת להיות אחרי היציאה');
        }
      }
      if (existing) Object.assign(existing, a); else state.absences.push(a);
      closeSheet();
      commit(existing ? '✅ עודכן' : '✅ נוסף');
    }
    draw();
  }

  // ===== כרטיס חייל =====
  function openSoldier(id) {
    const s = id ? soldier(id) : null;
    const f = s ? { ...s } : { name: '', role: '', notes: '', active: true };
    const el = openSheet(s ? `${esc(s.name)}` : '➕ חייל חדש', '');
    const mine = s ? state.absences.filter((a) => a.soldierId === s.id).sort((a, b) => (L.slotOf(b.start) ?? 1e12) - (L.slotOf(a.start) ?? 1e12)) : [];
    setBody(el, `
      <label class="fl">👤 שם מלא</label><input type="text" id="sf-name" value="${esc(f.name)}" maxlength="40" placeholder="שם ושם משפחה">
      <label class="fl">🎯 תפקיד (לא חובה)</label><input type="text" id="sf-role" value="${esc(f.role)}" maxlength="40" placeholder="למשל: נהג, חובש, מ״כ">
      <label class="fl">📝 הערות</label><textarea id="sf-notes" placeholder="כל דבר שחשוב לזכור">${esc(f.notes)}</textarea>
      <label class="check"><span class="switch"><input type="checkbox" id="sf-active" ${f.active !== false ? 'checked' : ''}><span></span></span>פעיל (נספר בנוכחות)</label>
      <div class="btns"><button class="btn primary" data-s="save">💾 שמירה</button>${s ? '<button class="btn danger" data-s="delete">🗑️ מחיקה</button>' : ''}</div>
      ${s ? `<div style="margin-top:22px"><h2>🚶 היעדרויות <span class="count">${mine.length}</span></h2>
        <button class="btn block" data-s="add-abs">➕ הוספת היעדרות ל${esc(s.name.split(' ')[0])}</button>
        ${mine.map(moveItem).join('')}</div>` : ''}`);
    el.addEventListener('click', (e) => {
      const b = e.target.closest('[data-s]');
      if (!b) return;
      if (b.dataset.s === 'save') {
        const name = $('#sf-name', el).value.trim();
        if (!name) return toast('⚠️ צריך שם');
        const data = { name, role: $('#sf-role', el).value.trim(), notes: $('#sf-notes', el).value.trim(), active: $('#sf-active', el).checked };
        if (s) Object.assign(s, data); else state.soldiers.push({ id: uid(), ...data });
        closeSheet();
        commit(s ? '✅ עודכן' : `✅ ${name} נוסף לצוות`);
      } else if (b.dataset.s === 'delete') {
        if (!confirm(`למחוק את ${s.name} ואת כל ההיעדרויות שלו?\nאפשר במקום זה לסמן "לא פעיל".`)) return;
        const backup = { soldiers: [...state.soldiers], absences: [...state.absences] };
        state.soldiers = state.soldiers.filter((x) => x.id !== s.id);
        state.absences = state.absences.filter((a) => a.soldierId !== s.id);
        closeSheet();
        commit('🗑️ נמחק', () => { Object.assign(state, backup); commit('↩ שוחזר'); });
      } else if (b.dataset.s === 'add-abs') {
        closeSheet(true);
        openAbsenceForm({ soldierId: s.id });
      }
    });
    if (!s) setTimeout(() => $('#sf-name', el)?.focus(), 300);
  }

  // ===== שיתוף =====
  async function share() {
    const text = L.buildSummary(state, ui.date);
    const el = openSheet('📤 סיכום יומי', `<div class="share-box">${esc(text)}</div>
      <div class="btns"><button class="btn primary" data-s="wa">💬 וואטסאפ</button><button class="btn" data-s="copy">📋 העתקה</button></div>
      ${navigator.share ? '<button class="btn block" style="margin-top:10px" data-s="native">📤 שיתוף אחר…</button>' : ''}`);
    el.addEventListener('click', async (e) => {
      const b = e.target.closest('[data-s]');
      if (!b) return;
      if (b.dataset.s === 'copy') {
        try { await navigator.clipboard.writeText(text); toast('📋 הועתק'); }
        catch { const r = document.createRange(); r.selectNodeContents($('.share-box', el)); getSelection().removeAllRanges(); getSelection().addRange(r); toast('סמנתי את הטקסט, אפשר להעתיק'); }
      } else if (b.dataset.s === 'wa') {
        window.open('https://wa.me/?text=' + encodeURIComponent(text), '_blank');
      } else if (b.dataset.s === 'native') {
        try { await navigator.share({ text }); } catch { /* המשתמש ביטל */ }
      }
    });
  }

  // ===== גיבוי =====
  async function exportData() {
    const json = JSON.stringify(state, null, 2);
    const name = `miluim-backup-${todayIso()}.json`;
    const file = new File([json], name, { type: 'application/json' });
    if (navigator.canShare && navigator.canShare({ files: [file] }) && /iPhone|iPad|Android/i.test(navigator.userAgent)) {
      try { await navigator.share({ files: [file], title: name }); return; } catch (e) { if (e.name === 'AbortError') return; }
    }
    const url = URL.createObjectURL(file);
    const a = Object.assign(document.createElement('a'), { href: url, download: name });
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    toast('⬇️ הקובץ נשמר');
  }
  $('#import-file').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    try {
      const d = JSON.parse(await file.text());
      if (!d || !Array.isArray(d.soldiers) || !Array.isArray(d.absences)) throw new Error('bad');
      if (!confirm(`לייבא ${d.soldiers.length} חיילים ו-${d.absences.length} היעדרויות?\nהנתונים הנוכחיים יוחלפו.`)) return;
      state = normalize(d);
      state.movesVersion = Seed.MOVES_VERSION;
      applyTheme();
      commit('✅ הנתונים יובאו');
    } catch { toast('⚠️ הקובץ לא תקין'); }
  });

  // ===== אירועים =====
  const actions = {
    tab: (b) => { ui.tab = b.dataset.tab; if (ui.tab === 'week') ui.weekDate = ui.date; window.scrollTo(0, 0); closeSheet(true); render(); },
    day: (b) => { ui.date = L.addDays(ui.date, +b.dataset.d); render(); },
    'day-today': () => { ui.date = todayIso(); render(); },
    part: (b) => { ui.part = b.dataset.p === '' ? null : +b.dataset.p; render(false); },
    week: (b) => { ui.weekDate = L.addDays(ui.weekDate, +b.dataset.d); render(); },
    'week-this': () => { ui.weekDate = todayIso(); render(); },
    'open-day': (b) => { ui.date = b.dataset.date; ui.part = null; ui.tab = 'today'; window.scrollTo(0, 0); render(); },
    soldier: (b) => openSoldier(b.dataset.id),
    'soldier-new': () => openSoldier(null),
    'soldier-toggle': (b) => { const s = soldier(b.dataset.id); s.active = b.checked; commit(s.active ? `✅ ${s.name} פעיל` : `💤 ${s.name} לא פעיל`); },
    quick: (b) => openQuick(b.dataset.id),
    'abs-new': () => openAbsenceForm({}),
    'abs-edit': (b) => openAbsenceForm({ id: b.dataset.id }),
    'abs-approve': (b) => setStatus(b.dataset.id, 'approved', '✔ הבקשה אושרה'),
    'abs-reject': (b) => setStatus(b.dataset.id, 'rejected', '✖ הבקשה נדחתה'),
    share: () => share(),
    min: (b) => { state.settings.minThreshold = Math.max(0, state.settings.minThreshold + +b.dataset.d); commit(); },
    theme: (b) => { state.settings.theme = b.dataset.v; applyTheme(); commit(); },
    export: () => exportData(),
    import: () => $('#import-file').click(),
    install: async () => { if (!installEvt) return; installEvt.prompt(); await installEvt.userChoice; installEvt = null; render(false); },
    'reset-moves': () => {
      const n = state.absences.length;
      if (!n) return toast('אין תנועות למחוק');
      if (!confirm(`למחוק את כל ${n} התנועות, ההיעדרויות והבקשות?
רשימת החיילים וההגדרות יישארו.`)) return;
      const backup = state.absences;
      state.absences = [];
      commit('🧽 התנועות אופסו', () => { state.absences = backup; commit('↩ שוחזר'); });
    },
    'reset-seed': () => { if (confirm('לטעון מחדש את נתוני הפתיחה? כל השינויים שלך יימחקו.')) { state = normalize(Seed.create()); applyTheme(); commit('🔁 נתוני הפתיחה נטענו'); } },
    'clear-all': () => { if (confirm('למחוק את כל החיילים וההיעדרויות? אי אפשר לבטל.')) { state = normalize({ settings: state.settings, movesVersion: Seed.MOVES_VERSION }); commit('🗑️ הכל נמחק'); } },
  };
  function setStatus(id, status, msg) {
    const a = state.absences.find((x) => x.id === id);
    if (!a) return;
    if (status === 'approved' && !L.hasDate(a.start)) {
      toast('📅 צריך לקבוע תאריך לפני אישור');
      return openAbsenceForm({ id, status: 'approved' });
    }
    const prev = a.status;
    a.status = status;
    commit(msg, () => { a.status = prev; commit('↩ בוטל'); });
  }

  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-act]');
    if (!b || b.type === 'checkbox') return;
    const fn = actions[b.dataset.act];
    if (fn) fn(b);
  });
  document.addEventListener('change', (e) => {
    const b = e.target.closest('input[type=checkbox][data-act]');
    if (b && actions[b.dataset.act]) actions[b.dataset.act](b);
    if (e.target.id === 'set-unit') { state.settings.unitName = e.target.value.trim() || 'הצוות שלי'; commit('✅ נשמר'); }
  });

  // החלקה בין ימים/שבועות (RTL: החלקה ימינה = הבא)
  let tx = 0, ty = 0;
  const view = $('#view');
  view.addEventListener('touchstart', (e) => { tx = e.touches[0].clientX; ty = e.touches[0].clientY; }, { passive: true });
  view.addEventListener('touchend', (e) => {
    const dx = e.changedTouches[0].clientX - tx, dy = e.changedTouches[0].clientY - ty;
    if (Math.abs(dx) < 70 || Math.abs(dy) > 50) return;
    const dir = dx > 0 ? 1 : -1;
    if (ui.tab === 'today') { ui.date = L.addDays(ui.date, dir); render(); }
    else if (ui.tab === 'week') { ui.weekDate = L.addDays(ui.weekDate, dir * 7); render(); }
  }, { passive: true });

  // רענון כשחוזרים לאפליקציה (למשל יום חדש)
  let lastToday = todayIso();
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') return;
    const t = todayIso();
    if (t !== lastToday) { if (ui.date === lastToday) ui.date = t; lastToday = t; }
    if (!document.querySelector('.sheet')) render(false);
  });

  applyTheme();
  render();
  if (migrated) setTimeout(() => toast('🔄 התנועות עודכנו לשבוע 1.11'), 400);

  if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
    // כשגרסה חדשה של האפליקציה נכנסת לתוקף, טוענים מחדש פעם אחת כדי להציג אותה
    const hadController = !!navigator.serviceWorker.controller;
    let reloaded = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (hadController && !reloaded && !document.querySelector('.sheet')) { reloaded = true; location.reload(); }
    });
    window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').then((r) => r.update()).catch(() => {}));
  }
})();
