/* נתוני פתיחה. חלקי יום: 0 בוקר, 1 צהריים, 2 ערב, 3 לילה
   MOVES_VERSION: כשמעלים את המספר, האפליקציה בטלפון מוחקת את התנועות השמורות וטוענת את moves() במקומן.
   רשימת החיילים וההגדרות לא נוגעים. */
(function (root) {
  'use strict';
  const MOVES_VERSION = 3;
  const MOVES_LABEL = 'שבוע 22.11–28.11';

  const NAMES = [
    'אריאל בנבניסטי', 'נדב איפרגן', 'שמואל שיטובי', 'לאון גרדשוב', 'יניב כיבש', 'עזרא גרשון', 'גארי וולדרסקי',
    'סרגיי מישצינקו', 'בניאל אליאגוב', 'ניר לארי', 'אורי זלצברג', 'נריה הראל', 'דביר יונה', 'תומר זיו',
  ];

  // תנועות השבוע. מותאמות לחיילים לפי שם, כדי שיעבדו גם על רשימת החיילים שכבר בטלפון.
  function moves(soldiers) {
    const id = (name) => (soldiers.find((s) => s.name.trim() === name) || soldiers.find((s) => s.name.includes(name.split(' ')[0])) || {}).id;
    const P = (day, part) => ({ date: '2026-11-' + day, part }); // ראשון 22 … שבת 28, ראשון הבא 29
    let n = 0;
    const A = (who, type, start, end, note, extra) => ({
      id: 'm3-' + ++n, soldierId: id(who), type, status: 'approved', start, end, note: note || '', tentative: false, ...extra,
    });
    const T = { tentative: true };

    return [
      A('אריאל בנבניסטי', 'exit', P(24, 1), P(25, 1), 'שלישי אחה״צ עד רביעי בוקר/צהריים', T),
      A('נדב איפרגן', 'exit', P(25, 1), P(26, 0), 'רביעי 25.11 יוצא מוקדם, לא ידוע מתי חוזר', T),
      A('נדב איפרגן', 'exit', P(27, 1), P(28, 1), 'שישי צהריים עד שבת צהריים'),
      A('יניב כיבש', 'exit', P(24, 1), null, 'חתונה 24.11'),
      A('עזרא גרשון', 'late', P(22, 0), P(22, 2), 'מאוחר בראשון', T),
      A('עזרא גרשון', 'late', P(23, 0), P(23, 2), 'מאוחר בשני. אחר כך כנראה מסיים את הקו', T),
      A('בניאל אליאגוב', 'personal', null, null, 'צריך לצאת יום אחד, עוד לא יודע מתי', { status: 'pending' }),
      A('סרגיי מישצינקו', 'exit', P(23, 0), P(24, 0), 'יוצא ליום אחד בשני'),
      A('לאון גרדשוב', 'late', P(22, 0), P(23, 0), 'בחו״ל בסופ״ש, מגיע בשני'),
      A('לאון גרדשוב', 'exit', P(27, 0), P(29, 0), 'יוצא לשישי-שבת, חוזר בראשון'),
      A('ניר לארי', 'late', P(22, 0), P(22, 1), 'מגיע ראשון מאוחר'),
      A('ניר לארי', 'exit', P(25, 1), P(26, 0), 'אולי צריך לצאת רביעי בצהריים ולחזור חמישי בבוקר', T),
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

  root.Seed = { create, moves, MOVES_VERSION, MOVES_LABEL };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.Seed;
})(typeof self !== 'undefined' ? self : globalThis);
