/* לוגיקת נוכחות: ללא תלות ב-DOM, כדי שאפשר יהיה לבדוק אותה גם ב-Node */
(function (root) {
  'use strict';

  // חלקי יום. "סלוט" = יום * 4 + חלק יום.
  const PARTS = [
    { key: 'morning', name: 'בוקר', emoji: '🌅', hours: '06–12' },
    { key: 'noon', name: 'צהריים', emoji: '☀️', hours: '12–17' },
    { key: 'evening', name: 'ערב', emoji: '🌆', hours: '17–22' },
    { key: 'night', name: 'לילה', emoji: '🌙', hours: '22–06' },
  ];
  const DAY_NAMES = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
  const TYPES = {
    exit: { label: 'יציאה', emoji: '🚪' },
    late: { label: 'הגעה מאוחרת', emoji: '⏰' },
    vacation: { label: 'חופשה', emoji: '🏖️' },
    sick: { label: 'מחלה', emoji: '🤒' },
    personal: { label: 'אירוע אישי', emoji: '🎉' },
    other: { label: 'אחר', emoji: '📝' },
  };

  const MS = 864e5;
  const dayNum = (iso) => { const [y, m, d] = iso.split('-').map(Number); return Math.round(Date.UTC(y, m - 1, d) / MS); };
  const isoFromNum = (n) => new Date(n * MS).toISOString().slice(0, 10);
  const addDays = (iso, k) => isoFromNum(dayNum(iso) + k);
  const weekday = (iso) => new Date(dayNum(iso) * MS).getUTCDay(); // 0 = ראשון
  const weekStart = (iso) => addDays(iso, -weekday(iso));
  const dayName = (iso) => DAY_NAMES[weekday(iso)];
  function fmtDate(iso, withYear) {
    const [y, m, d] = iso.split('-');
    return `${+d}.${+m}${withYear ? '.' + y : ''}`;
  }
  const dayLabel = (iso, withYear) => `יום ${dayName(iso)} ${fmtDate(iso, withYear)}`;

  const partOfHour = (h) => (h < 6 ? 3 : h < 12 ? 0 : h < 17 ? 1 : h < 22 ? 2 : 3);

  // נקודת זמן: { date, part } או { date, time: 'HH:MM' }
  function slotOf(pt) {
    if (!pt || !pt.date) return null;
    const n = dayNum(pt.date);
    if (pt.time) {
      const h = parseInt(pt.time, 10);
      if (h < 6) return (n - 1) * 4 + 3; // 02:00 שייך ללילה של היום הקודם
      return n * 4 + partOfHour(h);
    }
    return n * 4 + (pt.part ?? 0);
  }
  const slotToPoint = (s) => ({ date: isoFromNum(Math.floor(s / 4)), part: ((s % 4) + 4) % 4 });

  function fmtPoint(pt) {
    if (!pt || !pt.date) return 'ללא תאריך';
    return `${dayName(pt.date)} ${fmtDate(pt.date)} · ${pt.time ? pt.time : PARTS[pt.part ?? 0].name}`;
  }

  // היעדרות מכסה סלוט אם התחלה <= סלוט < חזרה. מי שיוצא בצהריים חסר מהצהריים; מי שחוזר בערב נוכח מהערב.
  const hasDate = (pt) => !!(pt && pt.date);
  const endSlot = (a) => (hasDate(a.end) ? slotOf(a.end) : Infinity);
  function covers(a, slot) {
    const s = slotOf(a.start);
    return s != null && s <= slot && slot < endSlot(a);
  }

  const activeSoldiers = (state) => state.soldiers.filter((s) => s.active !== false);
  const absenceAt = (state, sid, slot) =>
    state.absences.find((a) => a.soldierId === sid && a.status === 'approved' && covers(a, slot)) || null;
  const pendingAt = (state, sid, slot) =>
    state.absences.filter((a) => a.soldierId === sid && a.status === 'pending' && covers(a, slot));

  // מתי החייל חוזר, כולל שרשור היעדרויות רצופות (למשל מחלה שממשיכה לחופשה)
  function returnInfo(state, sid, slot) {
    let a = absenceAt(state, sid, slot);
    if (!a) return null;
    for (let i = 0; i < 50; i++) {
      if (!hasDate(a.end)) return { open: true, absence: a };
      const next = absenceAt(state, sid, slotOf(a.end));
      if (!next) return { open: false, point: a.end, absence: a };
      a = next;
    }
    return { open: true, absence: a };
  }
  const returnText = (ri) =>
    !ri ? '' : ri.open ? 'לא חוזר / פתוח' : `${ri.absence.type === 'late' ? 'מגיע' : 'חוזר'}: ${fmtPoint(ri.point)}`;

  // ירוק = מלא, אדום = מתחת לסף, צהוב = חוסר
  function level(count, total, min) {
    if (count >= total) return 'ok';
    if (count < min) return 'bad';
    return 'warn';
  }

  function reasonText(a) {
    const t = TYPES[a.type] || TYPES.other;
    return `${t.emoji} ${t.label}${a.note ? ` (${a.note})` : ''}`;
  }

  function dayStatus(state, iso) {
    const base = dayNum(iso) * 4;
    const rows = activeSoldiers(state).map((s) => {
      const parts = [0, 1, 2, 3].map((p) => ({
        absent: absenceAt(state, s.id, base + p),
        pending: pendingAt(state, s.id, base + p),
      }));
      return {
        soldier: s,
        parts,
        absentCount: parts.filter((p) => p.absent).length,
        prevAbsent: !!absenceAt(state, s.id, base - 1),
        reasons: [...new Set(parts.filter((p) => p.absent).map((p) => p.absent))],
        pendings: [...new Set(parts.flatMap((p) => p.pending))],
      };
    });
    const total = rows.length;
    const partCounts = [0, 1, 2, 3].map((p) => rows.filter((r) => !r.parts[p].absent).length);
    const activeIds = new Set(rows.map((r) => r.soldier.id));
    return {
      date: iso,
      base,
      total,
      rows,
      partCounts,
      min: total ? Math.min(...partCounts) : 0,
      max: total ? Math.max(...partCounts) : 0,
      full: rows.filter((r) => r.absentCount === 0),
      partial: rows.filter((r) => r.absentCount > 0 && r.absentCount < 4),
      missing: rows.filter((r) => r.absentCount === 4),
      pendingDay: rows.flatMap((r) => r.pendings),
      pendingUndated: state.absences.filter(
        (a) => a.status === 'pending' && !hasDate(a.start) && activeIds.has(a.soldierId)
      ),
    };
  }

  function describePartial(row) {
    const pres = row.parts.map((p) => !p.absent);
    const fp = pres.indexOf(true);
    const fa = pres.indexOf(false);
    if (!pres[0] && (row.prevAbsent || row.reasons.some((a) => a.type === 'late')) && pres.slice(fp).every(Boolean)) return `מגיע ב${PARTS[fp].name}`;
    if (pres[0] && pres.slice(fa).every((x) => !x)) return `יוצא ב${PARTS[fa].name}`;
    return 'חסר ב' + PARTS.filter((_, i) => !pres[i]).map((p) => p.name).join(', ');
  }

  const weekStatus = (state, iso) => {
    const ws = weekStart(iso);
    return [0, 1, 2, 3, 4, 5, 6].map((k) => dayStatus(state, addDays(ws, k)));
  };

  const nameOf = (state, sid) => (state.soldiers.find((s) => s.id === sid) || { name: '?' }).name;

  // טקסט לוואטסאפ (*מודגש*)
  function buildSummary(state, iso) {
    const ds = dayStatus(state, iso);
    const L = [];
    L.push(`🪖 *${state.settings.unitName || 'הצוות'}* | סיכום יומי`);
    L.push(`📅 ${dayLabel(iso, true)}`);
    L.push('');
    L.push(`✅ *בבסיס: ${ds.min}/${ds.total}* (מינימום ביום)`);
    L.push(PARTS.map((p, i) => `${p.emoji} ${p.name} ${ds.partCounts[i]}`).join(' · '));
    if (ds.missing.length) {
      L.push('');
      L.push(`❌ *חסרים כל היום (${ds.missing.length}):*`);
      ds.missing.forEach((r) => {
        const ri = returnInfo(state, r.soldier.id, ds.base + 3);
        L.push(`• ${r.soldier.name}: ${r.reasons.map(reasonText).join(', ')} · ${returnText(ri)}`);
      });
    }
    if (ds.partial.length) {
      L.push('');
      L.push(`🔄 *נוכחות חלקית (${ds.partial.length}):*`);
      ds.partial.forEach((r) => {
        const ri = r.parts[3].absent ? returnInfo(state, r.soldier.id, ds.base + 3) : null;
        L.push(`• ${r.soldier.name}: ${describePartial(r)}, ${r.reasons.map(reasonText).join(', ')}${ri ? ' · ' + returnText(ri) : ''}`);
      });
    }
    const pend = [...new Set([...ds.pendingDay, ...ds.pendingUndated])];
    if (pend.length) {
      L.push('');
      L.push('⚠️ *בקשות ממתינות לאישור:*');
      pend.forEach((a) => L.push(`• ${nameOf(state, a.soldierId)}: ${reasonText(a)} · ${hasDate(a.start) ? fmtPoint(a.start) : 'ללא תאריך'}`));
    }
    if (!ds.missing.length && !ds.partial.length) {
      L.push('');
      L.push('💪 כל הצוות בבסיס!');
    }
    return L.join('\n');
  }

  const api = {
    PARTS, DAY_NAMES, TYPES, dayNum, isoFromNum, addDays, weekday, weekStart, dayName, fmtDate, dayLabel,
    partOfHour, slotOf, slotToPoint, fmtPoint, hasDate, endSlot, covers, activeSoldiers, absenceAt, pendingAt,
    returnInfo, returnText, level, reasonText, dayStatus, describePartial, weekStatus, nameOf, buildSummary,
  };
  root.Logic = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof self !== 'undefined' ? self : globalThis);
