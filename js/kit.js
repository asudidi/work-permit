/* 공통 도우미: 허가서 데이터 구조, 가스 측정시간, 표시용 함수 */
(function () {
  'use strict';
  const TYPES = window.PERMIT_TYPES;
  const typeById = id => TYPES.find(t => t.id === id);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const nl = s => esc(s).replace(/\n/g, '<br>');
  const pad = n => String(n).padStart(2, '0');
  const today = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
  const STATUSES = ['발행', '작업중', '작업완료', '취소'];
  const GAS_ROUNDS = 4;

  function setPath(obj, path, val) {
    const ks = path.split('.');
    let o = obj;
    ks.slice(0, -1).forEach(k => { if (o[k] == null || typeof o[k] !== 'object') o[k] = {}; o = o[k]; });
    o[ks[ks.length - 1]] = val;
  }
  const getPath = (obj, path) => path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);

  // ---------- 가스 측정시간 (4회, 2시간 간격 · 점심시간 건너뜀) ----------
  const toMin = t => { const m = /^(\d{1,2}):(\d{2})$/.exec(t || ''); return m ? (+m[1]) * 60 + (+m[2]) : NaN; };
  const fromMin = n => `${pad(Math.floor(n / 60))}:${pad(n % 60)}`;
  function fillGasTimes(times) {
    const c = window.CONFIG || {};
    const lf = toMin(c.LUNCH_FROM || '12:00'), lt = toMin(c.LUNCH_TO || '13:00');
    let t = toMin(times[0]);
    if (isNaN(t)) throw new Error('1차 측정시간을 먼저 고르세요.');
    const out = [times[0]];
    for (let i = 1; i < GAS_ROUNDS; i++) {
      t += 120;
      if (t >= lf && t < lt) t = lt;
      out.push(t < 24 * 60 ? fromMin(t) : '');
    }
    return out;
  }

  // ---------- 허가서 데이터 ----------
  function blankDraft() {
    let last = {};
    try { last = JSON.parse(localStorage.getItem('wp_lastPeople') || '{}'); } catch (e) { last = {}; }
    const p = k => Object.assign({ dept: '', title: '', name: '' }, last[k]);
    return {
      id: null, status: '발행', noMode: 'auto', no: '', issueDate: '', workDate: '', timeFrom: '', timeTo: '',
      applicant: p('applicant'), issuer: p('issuer'), approver: p('approver'),
      title: '', area: '', equipNo: '', equipName: '', summary: '',
      contractor: '', worker: '', supervisor: '', witness: '',
      names: {}, types: [], sheets: {}
    };
  }
  function rememberPeople(d) {
    try {
      localStorage.setItem('wp_lastPeople', JSON.stringify({ applicant: d.applicant, issuer: d.issuer, approver: d.approver }));
    } catch (e) { /* 저장 불가 환경이면 무시 */ }
  }

  function ensureSheet(d, tid) {
    const t = typeById(tid);
    if (!d.sheets[tid]) {
      const extra = {};
      (t.extraFields || []).forEach(f => { extra[f.key] = f.default || ''; });
      d.sheets[tid] = { checks: {}, attach: {}, linked: {}, special: t.special || '', extra, gasTimes: ['', '', '', ''] };
    }
    const sh = d.sheets[tid];
    sh.checks = sh.checks || {}; sh.attach = sh.attach || {}; sh.linked = sh.linked || {}; sh.extra = sh.extra || {};
    sh.gasTimes = (sh.gasTimes || []).concat(['', '', '', '']).slice(0, GAS_ROUNDS);
    return sh;
  }
  function normalize(r) {
    r.types = r.types || []; r.sheets = r.sheets || {}; r.names = r.names || {};
    ['applicant', 'issuer', 'approver'].forEach(k => { r[k] = Object.assign({ dept: '', title: '', name: '' }, r[k]); });
    r.types.forEach(t => ensureSheet(r, t));
    return r;
  }
  function copyOf(rec) {
    const d = normalize(JSON.parse(JSON.stringify(rec)));
    d.id = null; d.no = ''; d.noMode = 'auto'; d.status = '발행';
    d.issueDate = ''; d.workDate = ''; d.timeFrom = ''; d.timeTo = '';
    Object.values(d.sheets).forEach(s => { s.gasTimes = ['', '', '', '']; });
    ['createdAt', 'updatedAt', 'authorId', 'authorName', 'authorDept', 'permitNo'].forEach(k => delete d[k]);
    return d;
  }

  const recNo = r => r.no || r.permitNo || '';
  // 보충/관련 허가서 체크: 직접 바꾼 값이 있으면 그 값, 없으면 함께 발행한 허가서면 자동 체크
  const linkedOn = (r, sh, id) => (sh.linked && id in sh.linked) ? !!sh.linked[id] : r.types.includes(id);

  function fmtWorkTime(r) {
    const [y, m, d] = (r.workDate || '').split('-');
    const [h1, n1] = (r.timeFrom || ':').split(':');
    const [h2, n2] = (r.timeTo || ':').split(':');
    const v = x => x ? String(x) : '__';
    return `${y ? y + '년 ' : ''}${m ? (+m) + '월 ' : ''}${d ? (+d) + '일 ' : ''}${h1 ? h1 + ':' + n1 : '--:--'} ~ ${h2 ? h2 + ':' + n2 : '--:--'}`;
  }

  window.Kit = { TYPES, typeById, esc, nl, pad, today, STATUSES, GAS_ROUNDS, setPath, getPath, fillGasTimes,
    blankDraft, rememberPeople, ensureSheet, normalize, copyOf, recNo, linkedOn, fmtWorkTime };
})();
