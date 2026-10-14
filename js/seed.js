/* נתוני פתיחה: שבוע ראשון 18.10.2026 – שבת 24.10.2026
   חלקי יום: 0 בוקר, 1 צהריים, 2 ערב, 3 לילה */
(function (root) {
  'use strict';
  const NAMES = [
    'אריאל בנבניסטי', 'נדב איפרגן', 'שמואל שיטובי', 'לאון גרדשוב', 'יניב כיבש', 'עזרא גרשון', 'גארי וולדרסקי',
    'סרגיי מישצינקו', 'בניאל אליאגוב', 'ניר לארי', 'אורי זלצברג', 'נריה הראל', 'דביר יונה', 'תומר זיו',
  ];

  function create() {
    const soldiers = NAMES.map((name, i) => ({ id: 's' + (i + 1), name, role: '', notes: '', active: true }));
    const id = (prefix) => soldiers.find((s) => s.name.startsWith(prefix)).id;
    const P = (date, part) => ({ date: '2026-10-' + date, part });
    let n = 0;
    const A = (who, type, start, end, note, status) => ({
      id: 'a' + ++n, soldierId: id(who), type, status: status || 'approved', start, end, note: note || '',
    });

    const absences = [
      A('נדב', 'exit', P(21, 2), null, 'נמצא עד רביעי ואז יוצא'),
      A('נדב', 'personal', null, null, 'חינה ומסיבת רווקים', 'pending'),

      A('אריאל', 'late', P(18, 0), P(19, 0), 'מגיע בשני'),
      A('אריאל', 'exit', P(19, 1), P(20, 0), 'מגיע לכמה שעות ויוצא, חוזר בשלישי'),
      A('אריאל', 'exit', P(24, 0), null, 'יוצא בשבת'),

      A('ניר', 'late', P(18, 0), P(18, 2), 'מגיע ראשון בערב'),

      A('אורי', 'late', P(18, 0), P(18, 2), 'מגיע ראשון בערב'),
      A('אורי', 'exit', P(23, 1), null, 'יוצא בשישי'),

      A('תומר', 'exit', P(24, 2), null, 'יוצא במוצאי שבת'),

      A('לאון', 'late', P(18, 0), P(19, 1), 'מגיע שני בבוקר או בצהריים'),
      A('לאון', 'exit', P(23, 1), null, 'יוצא בשישי'),

      A('עזרא', 'late', P(18, 0), P(18, 1), 'מגיע ראשון באיחור'),
      A('עזרא', 'exit', P(19, 2), P(20, 2), 'יוצא שני בערב, חוזר שלישי בערב'),
      A('עזרא', 'exit', P(23, 1), null, 'לא חוזר לסוף השבוע'),

      A('סרגיי', 'exit', P(23, 0), P(23, 1), 'יוצא לכמה שעות וחוזר באותו יום'),

      A('יניב', 'late', P(18, 0), P(18, 2), 'מגיע לקראת ערב'),
      A('יניב', 'exit', P(24, 0), null, 'יוצא שבת בבוקר'),

      A('בניאל', 'exit', P(20, 1), P(21, 1), 'יוצא שלישי בצהריים, חוזר רביעי בצהריים'),
    ];

    return {
      version: 1,
      soldiers,
      absences,
      settings: { unitName: 'הצוות שלי', minThreshold: 10, theme: 'auto' },
    };
  }

  root.Seed = { create };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.Seed;
})(typeof self !== 'undefined' ? self : globalThis);
