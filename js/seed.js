/* נתוני פתיחה. חלקי יום: 0 בוקר, 1 צהריים, 2 ערב, 3 לילה
   MOVES_VERSION: כשמעלים את המספר, האפליקציה בטלפון מוחקת את התנועות השמורות וטוענת את moves() במקומן.
   רשימת החיילים וההגדרות לא נוגעים. */
(function (root) {
  'use strict';
  const MOVES_VERSION = 2; // שבוע 1.11.2026 – 7.11.2026

  const NAMES = [
    'אריאל בנבניסטי', 'נדב איפרגן', 'שמואל שיטובי', 'לאון גרדשוב', 'יניב כיבש', 'עזרא גרשון', 'גארי וולדרסקי',
    'סרגיי מישצינקו', 'בניאל אליאגוב', 'ניר לארי', 'אורי זלצברג', 'נריה הראל', 'דביר יונה', 'תומר זיו',
  ];

  // תנועות השבוע. מותאמות לחיילים לפי שם, כדי שיעבדו גם על רשימת החיילים שכבר בטלפון.
  function moves(soldiers) {
    const id = (name) => (soldiers.find((s) => s.name.trim() === name) || soldiers.find((s) => s.name.includes(name.split(' ')[0])) || {}).id;
    const P = (day, part) => ({ date: '2026-11-0' + day, part }); // day = 1..7 (ראשון..שבת)
    let n = 0;
    const A = (who, type, start, end, note, extra) => ({
      id: 'm2-' + ++n, soldierId: id(who), type, status: 'approved', start, end, note: note || '', tentative: false, ...extra,
    });
    const T = { tentative: true };

    return [
      A('שמואל שיטובי', 'notjoined', P(1, 0), null, 'תאריך לא ידוע'),
      A('לאון גרדשוב', 'exit', P(5, 2), null, 'חמישי בערב או שישי בבוקר', T),
      A('עזרא גרשון', 'late', P(1, 0), P(1, 2), 'מגיע ראשון בצהריים או בערב', T),
      A('עזרא גרשון', 'exit', P(4, 0), P(4, 2), 'יוצא רביעי בבוקר, חוזר רביעי בערב'),
      A('בניאל אליאגוב', 'exit', P(4, 1), P(5, 1), 'יוצא רביעי בצהריים, חוזר חמישי בצהריים'),
      A('ניר לארי', 'late', P(1, 0), P(1, 1), 'אולי מגיע מאוחר ביום ראשון', T),
      A('נריה הראל', 'late', P(1, 0), P(4, 2), 'מגיע רביעי בערב'),
      A('תומר זיו', 'exit', P(7, 3), null, 'יוצא שבת בלילה'),
      A('אורי זלצברג', 'exit', P(2, 0), P(3, 1), 'חוזר שלישי בבוקר או בצהריים', T),
    ].filter((a) => a.soldierId);
  }

  function create() {
    const soldiers = NAMES.map((name, i) => ({ id: 's' + (i + 1), name, role: '', notes: '', active: true }));
    return {
      version: 1,
      movesVersion: MOVES_VERSION,
      soldiers,
      absences: moves(soldiers),
      settings: { unitName: 'הצוות שלי', minThreshold: 10, theme: 'auto' },
    };
  }

  root.Seed = { create, moves, MOVES_VERSION };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.Seed;
})(typeof self !== 'undefined' ? self : globalThis);
