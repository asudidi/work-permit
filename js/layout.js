/*
 * 회사 안전작업허가서 양식(RV6)을 PDF 치수 그대로 다시 그리는 인쇄 양식
 *  - 좌표 단위: 원본 PDF를 200dpi로 본 픽셀 (A4 = 1654 × 2338). 화면/인쇄 시 A4 크기로 축소
 *  - 선·칸·라벨을 모두 직접 그리므로 그림 없이 선명하게 인쇄됨
 *  - 칸 위치를 바꾸려면 아래 PAGES 의 숫자만 고치면 됨
 */
(function () {
  'use strict';
  const L = 160, R = 1577;                 // 바깥 테두리 좌우
  const FS = 27, FS_SM = 24, FS_GAS = 22;  // 본문 / 작은 글자 / 가스표 글자 (px)
  // 종이 가장자리 ~ 바깥 테두리 간격 (mm). 허가서 종류와 상관없이 같은 여백이 되도록 맞춤.
  //  - 위쪽은 서류철(2공 펀치) 보관용으로 넓게: 구멍이 글씨·테두리에 닿지 않도록 25mm (구멍이 크거나 위치가 들쑥날쑥하면 30mm)
  //  - 프린터 인쇄 불가 영역(약 5mm)보다는 크게
  //  - 글자가 눌려 보이지 않도록 가로·세로를 같은 비율로 줄이고, 좌우는 가운데에 놓음
  const MARGIN_TOP_MM = 25, MARGIN_SIDE_MM = 11, MARGIN_BOTTOM_MM = 11;
  const PAPER_W = 1654, PAPER_H = 2338, FRAME_TOP = 199, PX_MM = 200 / 25.4;

  // 쪽 공통 위치
  const HEAD_X = { no: 183, noVal: 330, date: 1169, year: [1300, 1404], dot1: 1421, month: [1428, 1512], dot2: 1518, day: [1524, 1574],
    ap: 182, apDept: [334, 388, 580], apTitle: [585, 638, 802], apName: [807, 858, 1053], apIn: 1058, apUl: [179, 1110] };
  const APV = { lab: 183, dept: [279, 334, 440], title: [446, 498, 606], name: [612, 664, 804], inn: 808,
    co1: [944, '관련부서 협조자'], co2: [[943, '부서'], [1069, '직책'], [1221, '성명'], [1416, '(인)']] };
  const WT_A = [[655, 674], [751, 771], [863, 882], [960, 979], [1056, 1078], [1124, 1136], [1251, 1271], [1362, 1384]];
  const WT_B = [[627, 646], [737, 757], [849, 868], [945, 965], [1042, 1065], [1110, 1122], [1237, 1257], [1348, 1370]];
  const WT_C = [[627, 646], [723, 743], [835, 854], [931, 951], [1028, 1050], [1096, 1108], [1223, 1243], [1334, 1356]];

  // 쪽별 치수 (원본 PDF에서 측정)
  const PAGES = {
    hot: {
      bottom: 2231, titleUl: 265, noY: 356, apY: 407, apUl: 421,
      wt: [430, 492, 413, WT_P1()], lochdr: [492, 536], loc: [536, 674], cols: [530, 899],
      linked: { cols: [[905, 1213], [1270, 1538]], ys: [568, 605, 641], order: [['confined', 'excavation'], ['power', 'heavy'], ['height', 'radiation']] },
      chkhdr: [674, 734], chk: [734, 1069], chkCols: [[167, 712, [755, 797, 839, 880, 922, 964, 1005, 1047]], [905, 1423, [755, 797, 839, 880, 922, 964, 1005, 1047]]],
      special: [1069, 1281, 337, 811], attach: { x: 933, box: 1507, ys: [1092, 1133, 1175, 1217, 1258] },
      gas: 1281, approve: [2035, 2156, [2062, 2131]], ext: [2156, 2231, 436, 1151]
    },
    confined: {
      bottom: 2235, titleUl: 277, noY: 368, apY: 419, apUl: 433,
      wt: [453, 516, 466, WT_B], lochdr: [516, 568], loc: [568, 729], cols: [621, 1128],
      linked: { cols: [[1150, 1498]], ys: [630, 666], order: [['hot'], ['general']] },
      chkhdr: [729, 789], chk: [789, 1108], chkCols: [[167, 712, [837, 882, 926, 971, 1015, 1060]], [905, 1423, [815, 860, 904, 948, 993, 1037, 1082]]],
      special: [1108, 1285, 337, 811], attach: { x: 936, box: 1509, ys: [1138, 1177, 1216, 1255] },
      gas: 1285, approve: [2039, 2160, [2065, 2135]], ext: [2160, 2235, 436, 1151]
    },
    general: {
      bottom: 2240, titleUl: 288, noY: 428, apY: 479, apUl: 493,
      wt: [524, 594, 466, WT_A], lochdr: [594, 670], loc: [670, 912], cols: [621, 1128],
      linked: { cols: [[1150, 1484]], ys: [700, 736, 772, 808, 845, 881], order: [['confined'], ['power'], ['height'], ['excavation'], ['heavy'], ['radiation']] },
      chkhdr: [912, 980], chk: [980, 1425], chkCols: [[167, 712, [1024, 1069, 1113, 1158, 1202, 1247, 1291, 1336, 1380]], [905, 1423, [1047, 1091, 1136, 1180, 1224, 1269, 1313]]],
      special: [1425, 1653, 337, 811], attach: { x: 933, box: 1507, ys: [1450, 1495, 1539, 1583, 1628] },
      confhdr: [1653, 1717], conf: [1717, 1973, [1784, 1845, 1906]], approve: [1973, 2165, [2034, 2104]], ext: [2165, 2240, 427, 1166]
    },
    power: {
      bottom: 2240, titleUl: 317, noY: 407, apY: 457, apUl: 472,
      wt: [532, 602, 466, WT_C], lochdr: [602, 678], loc: [678, 904], cols: [644, 1128],
      linked: { cols: [[1150, 1498]], ys: [772, 809], order: [['hot'], ['general']] },
      chkhdr: [904, 972], chk: [972, 1417], chkCols: [[180, 776, [1150, 1194, 1239, 1283, 1328], [194, 1066]], [920, 1469, [1150, 1194], [920, 1066]]],
      special: [1417, 1661, 337, 866], cutoff: true,
      confhdr: [1661, 1740], conf: [1740, 1957, [1788, 1849, 1910]], approve: [1957, 2165, [2027, 2096]], ext: [2165, 2240, 443, 1158]
    },
    heavy: {
      bottom: 2240, titleUl: 317, noY: 407, apY: 457, apUl: 472,
      wt: [532, 602, 466, WT_A], lochdr: [602, 678], loc: [678, 904], cols: [644, 1128],
      linked: { cols: [[1150, 1498]], ys: [772, 808], order: [['hot'], ['general']] },
      chkhdr: [904, 972], chk: [972, 1417], chkCols: [[180, 771, [1089, 1142, 1194, 1247, 1300]], [886, 1465, [1089, 1142, 1194, 1247]]],
      special: [1417, 1629, 337, 866], resp: [1465, 1523, 1582],
      confhdr: [1629, 1701], conf: [1701, 1957, [1768, 1829, 1890]], approve: [1957, 2165, [2027, 2096]], ext: [2165, 2240, 435, 1150]
    },
    height: {
      bottom: 2240, titleUl: 304, noY: 395, apY: 470, apUl: 485,
      wt: [532, 602, 466, WT_A], lochdr: [602, 678], loc: [678, 904], cols: [644, 1128],
      linked: { cols: [[1150, 1498]], ys: [768, 813], order: [['hot'], ['general']] },
      chkhdr: [904, 972], chk: [972, 1417], chkCols: [[180, 960, [1106, 1150, 1194, 1239, 1283]]],
      special: [1417, 1629, 337, 866], resp: [1465, 1523, 1582],
      confhdr: [1629, 1701], conf: [1701, 1957, [1768, 1829, 1890]], approve: [1957, 2165, [2027, 2096]], ext: [2165, 2240, 435, 1150]
    },
    excavation: {
      bottom: 2234, titleUl: 317, noY: 407, apY: 457, apUl: 472,
      wt: [532, 594, 466, WT_A], lochdr: [594, 654], loc: [654, 817], cols: [644, 1128],
      linked: { cols: [[1150, 1498]], ys: [717, 753], order: [['hot'], ['general']] },
      sketch: [817, 1119, '굴착도 스케치', 879, 968, { img: [1000, 826, 1566, 1114], dwg: [204, 992, 995, 1114] }],
      chkhdr: [1119, 1194], chk: [1194, 1474], chkCols: [[180, 889, [1268, 1312, 1356, 1401, 1445]]], confirmer: { head: [1025, 1228], lab: 1001, ul: [1099, 1361] },
      special: [1474, 1655, 337, 866], resp: [1506, 1564, 1624],
      confhdr: [1655, 1727], conf: [1727, 1983, [1794, 1855, 1916]], approve: [1983, 2159, [2037, 2106]], ext: [2159, 2234, 435, 1150]
    },
    radiation: {
      bottom: 2235, titleUl: 317, noY: 407, apY: 457, apUl: 472,
      wt: [532, 594, 466, WT_B], lochdr: [594, 654], loc: [654, 809], cols: [644, 1128],
      linked: { cols: [[1150, 1498]], ys: [713, 749], order: [['hot'], ['general']] },
      sketch: [809, 1111, '방사선 방사점 도면', 849, 1071, { img: [178, 866, 1566, 1050], dwg: [415, 1054, 1566, 1100], inline: true }],
      chkhdr: [1111, 1186], chk: [1186, 1444], chkCols: [[180, 889, [1248, 1293, 1337, 1382]]],
      special: [1444, 1625, 337, 866], resp: [1476, 1534, 1593],
      confhdr: [1625, 1697], conf: [1697, 1953, [1763, 1825, 1886]], approve: [1953, 2160, [2022, 2091]], ext: [2160, 2235, 435, 1150]
    }
  };
  function WT_P1() { return [[601, 620], [697, 717], [809, 828], [906, 925], [1003, 1025], [1071, 1082], [1197, 1217], [1308, 1330]]; }

  const LINK_LABEL = { hot: '화기작업 허가', general: '일반위험작업 허가', confined: '밀폐공간출입 허가', excavation: '굴착작업 허가',
    power: '정전작업 허가', heavy: '중장비작업 허가', height: '고소작업 허가', radiation: '방사선작업 허가' };
  const GAS = [['산소(O₂)', '18~23.5%'], ['황화수소(H₂S)', '10ppm미만'], ['일산화탄소(CO)', '30ppm미만'], ['가연성가스', '0%LEL']];

  function render(r, t, ctx) {
    const P = PAGES[t.id];
    if (!P) return null;
    const { esc, nl } = ctx;
    const sh = r.sheets[t.id];
    const o = [];
    // ---------- 그리기 도구 ----------
    const hl = (y, x0 = L, x1 = R, w = 2, cls = '') => o.push(`<i class="fl-h ${cls}" style="left:${x0}px;top:${y - w / 2}px;width:${x1 - x0}px;height:${w}px"></i>`);
    const vl = (x, y0, y1, w = 2, cls = '') => o.push(`<i class="fl-v ${cls}" style="left:${x - w / 2}px;top:${y0}px;width:${w}px;height:${y1 - y0}px"></i>`);
    // 글자 칸: [x0,y0,x1,y1], 정렬 c/l/r, 세로 가운데
    const tx = (x0, y0, x1, y1, html, opt = {}) => {
      if (html == null || html === '') return;
      const j = opt.a === 'l' ? 'flex-start' : opt.a === 'r' ? 'flex-end' : 'center';
      o.push(`<div class="fl-t ${opt.b ? 'b' : ''} ${opt.wrap ? 'wrap' : ''} ${opt.top ? 'top' : ''}" ${opt.fit === false ? '' : 'data-fit'} style="left:${x0}px;top:${y0}px;width:${x1 - x0}px;height:${y1 - y0}px;justify-content:${j};${opt.wrap ? `text-align:${opt.a === 'c' ? 'center' : 'left'};` : ''}font-size:${opt.fs || FS}px${opt.ls ? `;letter-spacing:${opt.ls}px` : ''}">${opt.raw ? html : `<span>${html}</span>`}</div>`);
    };
    // 한 줄 글자 (x 시작, 세로 중심 y)
    // 글자 칸이 종이 오른쪽 끝(1654)을 넘지 않게 — 넘치면 인쇄 시 브라우저가 전체를 축소함
    const at = (x, y, html, opt = {}) => tx(x, y - 22, Math.min(opt.x1 || x + 900, 1650), y + 22, html, Object.assign({ a: 'l', fit: false }, opt));
    const ctr = (x0, x1, y, html, opt = {}) => tx(x0, y - 22, x1, y + 22, html, Object.assign({ fit: false }, opt));
    const box = (cx, cy, mark) => o.push(`<i class="fl-box ${mark || ''}" style="left:${cx - 11}px;top:${cy - 11}px"></i>`);
    const circ = (cx, cy) => o.push(`<i class="fl-circ" style="left:${cx - 11}px;top:${cy - 11}px"></i>`);
    const IN = '(인)';
    const sig = () => {};
    const B = P.bottom;
    // 바깥 테두리를 위 여백(서류철용)에 맞춰 놓고, 아래·좌우는 최소 여백을 지키도록 같은 비율로 확대·축소
    const mTop = MARGIN_TOP_MM * PX_MM, mSide = MARGIN_SIDE_MM * PX_MM, mBot = MARGIN_BOTTOM_MM * PX_MM;
    const sx = Math.min((PAPER_W - 2 * mSide) / (R - L), (PAPER_H - mTop - mBot) / (B - FRAME_TOP)), sy = sx;
    const offX = (PAPER_W - (R - L) * sx) / 2 - L * sx, offY = mTop - FRAME_TOP * sy;
    // 폰으로 받은 현장 서명(업체 등) — (인) 글자 위에 겹쳐 표시. key: fieldsign.js 의 칸 이름
    // (이 사이트는 전자서명을 쓰지 않음) 사이트에서 입력한 이름(r.names)을 (인) 앞에 찍고, (인)은 비워 둠
    const fsig = () => {};
    const fname = key => esc((r.names || {})[key] || '');
    const forg = key => esc((r.names || {})[key] || '');
    // 측정값은 항상 빈칸 (현장에서 수기 기록)
    const gv = () => '';

    // ---------- 바깥 테두리 ----------
    o.push(`<i class="fl-frame" style="left:${L}px;top:199px;width:${R - L}px;height:${B - 199}px"></i>`);

    // ---------- 머리글 ----------
    o.push(`<div class="fl-title" style="top:${P.titleUl - 62}px">${esc(t.name)}</div>`);
    const no = sh.no || ctx.recNo(r);
    at(HEAD_X.no, P.noY, '발행번호 :', {});
    at(HEAD_X.noVal, P.noY, esc(no), { x1: 900 });
    at(HEAD_X.date, P.noY, '발행일자 :', {});
    const [iy, im, id] = (r.issueDate || '').split('-');
    tx(HEAD_X.year[0], P.noY - 22, HEAD_X.year[1], P.noY + 22, esc(iy || '20'), { a: 'r', fit: false });
    at(HEAD_X.dot1, P.noY, '.');
    ctr(HEAD_X.month[0], HEAD_X.month[1], P.noY, im ? String(+im) : '');
    at(HEAD_X.dot2, P.noY, '.');
    ctr(HEAD_X.day[0], HEAD_X.day[1], P.noY, id ? String(+id) : '');
    const ap = r.applicant || {};
    at(HEAD_X.ap, P.apY, '신&nbsp;&nbsp;청&nbsp;&nbsp;인&nbsp;:', {});
    at(HEAD_X.apDept[0], P.apY, '부서'); ctr(HEAD_X.apDept[1], HEAD_X.apDept[2], P.apY, esc(ap.dept));
    at(HEAD_X.apTitle[0], P.apY, '직책'); ctr(HEAD_X.apTitle[1], HEAD_X.apTitle[2], P.apY, esc(ap.title));
    at(HEAD_X.apName[0], P.apY, '성명'); ctr(HEAD_X.apName[1], HEAD_X.apName[2], P.apY, esc(ap.name));
    at(HEAD_X.apIn, P.apY, IN);
    hl(P.apUl, HEAD_X.apUl[0], HEAD_X.apUl[1], 2);
    sig(1081, P.apY, 'applicant');

    // ---------- 작업시간 ----------
    const [wy0, wy1, wl, lab] = P.wt;
    hl(wy0); hl(wy1); vl(wl, wy0, wy1);
    ctr(L, wl, (wy0 + wy1) / 2, '작업시간', { b: true });
    const wc = (wy0 + wy1) / 2;
    const [ky, km, kd] = (r.workDate || '').split('-');
    const [h1, n1] = (r.timeFrom || '').split(':');
    const [h2, n2] = (r.timeTo || '').split(':');
    ['년', '월', '일', '시', '분', '~', '시', '분'].forEach((s, i) => at(lab[i][0], wc, s, { b: true }));
    const slot = (x0, x1, v, a) => { if (v) tx(x0, wc - 22, x1, wc + 22, esc(v), { b: true, a: a || 'c', fit: false }); };
    slot(wl + 8, lab[0][0] - 8, ky, 'r'); slot(lab[0][1] + 4, lab[1][0] - 4, km && String(+km)); slot(lab[1][1] + 4, lab[2][0] - 4, kd && String(+kd));
    slot(lab[2][1] + 4, lab[3][0] - 4, h1); slot(lab[3][1] + 4, lab[4][0] - 4, n1); slot(lab[5][1] + 4, lab[6][0] - 4, h2); slot(lab[6][1] + 4, lab[7][0] - 4, n2);

    // ---------- 작업장소 · 작업개요 · 보충/관련 허가서 ----------
    const [c1, c2] = P.cols;
    hl(P.lochdr[1]); hl(P.loc[1]);
    vl(c1, P.lochdr[0], P.loc[1]); vl(c2, P.lochdr[0], P.loc[1]);
    const hc = (P.lochdr[0] + P.lochdr[1]) / 2;
    ctr(L, c1, hc, esc(t.locationLabel), { b: true });
    ctr(c1, c2, hc, esc(t.midColumn ? t.midColumn.label : '작업개요'), { b: true });
    ctr(c2, R, hc, esc(t.linked.label), { b: true });
    const locLines = [['작업지역', r.area], ['장치번호', r.equipNo], ['장치명', r.equipName]];
    if (t.id === 'heavy') locLines.push(['투입장비', sh.extra.machine]);
    tx(L + 14, P.loc[0] + 6, c1 - 8, P.loc[1] - 6, locLines.filter(([k, v]) => v || k !== '투입장비').map(([k, v]) => `${k} : ${esc(v || '')}`).join('<br>'), { a: 'l', wrap: true });
    tx(c1 + 16, P.loc[0] + 6, c2 - 10, P.loc[1] - 6, t.midColumn ? nl(sh.extra[t.midColumn.key]) : nl(r.summary), { a: 'l', wrap: true });
    const LK = P.linked;
    LK.order.forEach((row, ri) => row.forEach((id, ci) => {
      const [txX, bx] = LK.cols[ci];
      at(txX, LK.ys[ri], '· ' + LINK_LABEL[id]);
      box(bx, LK.ys[ri], ctx.linkedOn(r, sh, id) ? 'f' : '');
    }));

    // ---------- 도면 (굴착·방사선) ----------
    if (P.sketch) {
      const [sy0, sy1, label, ly, dy, S] = P.sketch;
      hl(sy1);
      at(181, ly, esc(label), { b: true });
      if (sh.extra.sketch) o.push(`<img class="fl-img" src="${sh.extra.sketch}" alt="" style="left:${S.img[0]}px;top:${S.img[1]}px;width:${S.img[2] - S.img[0]}px;height:${S.img[3] - S.img[1]}px">`);
      at(184, dy, '※ 첨부도면 NO. :', { b: true });
      const dw = sh.extra.drawingNos || '';
      if (S.inline) tx(S.dwg[0], dy - 22, S.dwg[2], dy + 22, esc(dw.split('\n').filter(Boolean).join('  /  ')), { a: 'l' });
      else tx(S.dwg[0], S.dwg[1], S.dwg[2], S.dwg[3], nl(dw), { a: 'l', wrap: true, top: true, fs: FS_SM });
    }

    // ---------- 안전조치 요구사항 ----------
    hl(P.chkhdr[1]); hl(P.chk[1]);
    at(180, (P.chkhdr[0] + P.chkhdr[1]) / 2, `${esc(t.checksLabel || '안전조치요구사항')} (필요부분에 □에 ×표시, 확인은 ○에 ∨표시)`, { b: true, x1: R - 10 });
    t.checks.forEach((col, ci) => {
      const def = P.chkCols[ci];
      if (!def) return;
      const [txX, bx, ys, grp] = def;
      if (grp && col.title) at(grp[0], grp[1], `<u>${esc(col.title)}</u>`, { b: true });
      col.items.forEach((it, ii) => {
        const y = ys[ii];
        if (y == null) return;
        const label = P.confirmer ? `${ii + 1}. ${esc(it)}` : `o ${esc(it)}`;
        at(txX, y, label, { x1: bx - 20 });
        box(bx, y, sh.checks[ci + '-' + ii] ? 'x' : '');
        circ(bx + 42, y);
        if (P.confirmer) {
          at(P.confirmer.lab, y, '성명');
          hl(y + 18, P.confirmer.ul[0], P.confirmer.ul[1], 2);
          tx(P.confirmer.ul[1] - 60, y - 22, P.confirmer.ul[1], y + 22, IN, { a: 'r', fit: false });
          ctr(P.confirmer.ul[0], P.confirmer.ul[1] - 70, y, fname('c' + ii), { fit: false });
          fsig(P.confirmer.ul[1] - 30, y, 'c' + ii);
        }
      });
    });
    if (P.confirmer) ctr(P.confirmer.head[0] - 60, P.confirmer.head[0] + 140, P.confirmer.head[1], '확인자', { b: true });

    // ---------- 기타특별요구사항 + 오른쪽 칸 ----------
    const [sp0, sp1, sx1, sx2] = P.special;
    hl(sp1);
    vl(sx1, sp0, sp1); vl(sx2, sp0, sp1);
    tx(L, sp0, sx1, sp1, '기타특별<br>요구사항', { b: true, wrap: true, a: 'c', fit: false });
    tx(sx1 + 14, sp0 + 6, sx2 - 10, sp1 - 6, nl(sh.special), { a: 'l', wrap: true });
    if (P.attach) {
      const A = P.attach;
      vl(A.x, sp0, sp1);
      tx(sx2, sp0, A.x, sp1, '첨부<br>서류', { b: true, wrap: true, a: 'c', fit: false });
      (t.attachments || []).forEach((a, i) => {
        if (A.ys[i] == null) return;
        at(A.x + 18, A.ys[i], 'o ' + esc(a), { x1: A.box - 16 });
        box(A.box, A.ys[i], sh.attach[i] ? 'f' : '');
      });
    }
    if (P.resp) {
      const [ry0, ry1, ry2] = P.resp;
      at(901, ry0, '작업 책임자', { b: true });
      at(930, ry1, '업체명 :'); at(1053, ry1, esc(r.contractor) || forg('worker'), { x1: R - 10 });
      at(929, ry2, '성&nbsp;&nbsp;&nbsp;&nbsp;명 :');
      hl(ry2 + 18, 1079, 1329, 2);
      ctr(1079, 1270, ry2, esc(r.worker) || fname('worker'));
      tx(1260, ry2 - 22, 1329, ry2 + 22, IN, { a: 'r', fit: false });
      fsig(1299, ry2, 'worker');
    }
    if (P.cutoff) {
      at(903, sp0 + 70, '차단 확인자', { b: true });
      [[sp0 + 127, '작업 부서 담당자', 'cutoff_work'], [sp0 + 190, '운전 부서 담당자', 'cutoff_ops']].forEach(([y, s, fk]) => {
        at(931, y, s); hl(y + 12, 1190, 1427, 2); tx(1360, y - 22, 1427, y + 22, IN, { a: 'r', fit: false });
        // 작업 부서 담당자 = 감독자(공무팀 담당자) 이름이 자동으로 들어감
        ctr(1190, 1350, y, fname(fk) || (fk === 'cutoff_work' ? esc(r.supervisor) : ''), { fit: false });
        fsig(1397, y, fk);
      });
    }

    // ---------- 가스측정 (화기·밀폐공간) ----------
    if (P.gas != null) {
      const g = P.gas - 1281;   // 화기 기준 위치에서 위아래 차이
      const Y = y => y + g;
      const MID = 933;
      vl(MID, Y(1281), Y(2035));
      // 왼쪽 위: 제목 + 측정기기 + 감시인
      vl(501, Y(1281), Y(1384)); hl(Y(1333), 501, MID); hl(Y(1384), L, MID);
      ctr(L, 501, Y(1332), '산소,유해가스 측정', { b: true });
      at(521, Y(1307), `측정 기기명 : <span class="nb">${esc(sh.extra.gasMeter)}</span>`, { b: true, x1: MID - 6 });
      // 감시인(왼쪽) · 측정인(오른쪽): 한 줄에 같이 들어가므로 칸에 맞춰 글자를 자동으로 줄임
      tx(521, Y(1358) - 22, 745, Y(1358) + 22, `${esc(t.watcherLabel)} : <span class="nb">${esc(sh.extra.watcher)}</span>`, { b: true, a: 'l', fs: FS_SM });
      tx(750, Y(1358) - 22, MID - 6, Y(1358) + 22, `측정인 : <span class="nb">${esc(sh.extra.measurer || '')}</span>`, { b: true, a: 'l', fs: FS_SM });
      // 왼쪽 측정표 머리
      [329, 501, 644].forEach(x => vl(x, Y(1384), Y(1455)));
      hl(Y(1419), 644, MID); vl(740, Y(1419), Y(1455)); vl(835, Y(1419), Y(1455));
      hl(Y(1455), L, MID);
      ctr(L, 329, Y(1420), '가스종류', { b: true }); ctr(329, 501, Y(1420), '측정시간', { b: true }); ctr(501, 644, Y(1420), '허용범위', { b: true });
      ctr(644, MID, Y(1402), '측 정 값', { b: true });
      ctr(644, 740, Y(1437), '상', { b: true }); ctr(740, 835, Y(1437), '중', { b: true }); ctr(835, MID, Y(1437), '하', { b: true });
      const times = sh.gasTimes || [];
      // 왼쪽 측정 블록 3개 (1·2·3차)
      [1455, 1633, 1810].forEach((top, bi) => {
        const rowH = 35.5;
        for (let i = 0; i < 4; i++) {
          const y0 = Y(top + i * rowH), y1 = Y(top + (i + 1) * rowH);
          hl(y1, L, MID, 2);
          tx(L + 2, y0, 329 - 2, y1, GAS[i][0], { fs: FS_GAS });
          tx(501 + 2, y0, 644 - 2, y1, GAS[i][1], { fs: FS_GAS });
          if (times[bi]) ctr(329, 501, (y0 + y1) / 2, i === 0 ? esc(times[bi]) : '〃', { fs: FS_SM });   // 같은 시간은 〃(따옴표시)로
          [[644, 740], [740, 835], [835, MID]].forEach(([vx0, vx1], pi) => ctr(vx0, vx1, (y0 + y1) / 2, gv(bi, i, pi), { fs: FS_SM, b: true }));
        }
        [329, 501, 644].forEach(x => vl(x, Y(top), Y(top + 4 * rowH)));
        [740, 835].forEach(x => vl(x, Y(top), Y(top + 4 * rowH), 2, 'dot'));
        if (bi < 2) hl(Y(top + 4 * rowH + 35.5), L, MID);   // 블록 사이 빈 줄 아래 선
      });
      at(167, Y(1975), '※ 작업개시 전, 작업교대 시, 휴식 후 재작업 시, 작업자의', { b: true, fs: FS_SM, x1: MID - 4 });
      at(167, Y(2011), '신체 및 환기장치 등에 이상이 있을 시 기록한다.', { b: true, fs: FS_SM, x1: MID - 4 });
      // 오른쪽 위: 4차 측정 블록
      [1082, 1201, 1335].forEach(x => vl(x, Y(1281), Y(1526)));
      hl(Y(1333), 1335, R); vl(1416, Y(1333), Y(1384)); vl(1496, Y(1333), Y(1384));
      hl(Y(1384), MID, R);
      ctr(MID, 1082, Y(1332), '가스종류', { b: true }); ctr(1082, 1201, Y(1332), '측정시간', { b: true }); ctr(1201, 1335, Y(1332), '허용범위', { b: true });
      ctr(1335, R, Y(1307), '측 정 값', { b: true });
      ctr(1335, 1416, Y(1358), '상', { b: true }); ctr(1416, 1496, Y(1358), '중', { b: true }); ctr(1496, R, Y(1358), '하', { b: true });
      for (let i = 0; i < 4; i++) {
        const y0 = Y(1384 + i * 35.5), y1 = Y(1384 + (i + 1) * 35.5);
        hl(y1, MID, R);
        tx(MID + 2, y0, 1082 - 2, y1, GAS[i][0], { fs: FS_GAS });
        tx(1201 + 2, y0, 1335 - 2, y1, GAS[i][1], { fs: FS_GAS });
        if (times[3]) ctr(1082, 1201, (y0 + y1) / 2, i === 0 ? esc(times[3]) : '〃', { fs: FS_SM });
        [[1335, 1416], [1416, 1496], [1496, R]].forEach(([vx0, vx1], pi) => ctr(vx0, vx1, (y0 + y1) / 2, gv(3, i, pi), { fs: FS_SM, b: true }));
      }
      [1416, 1496].forEach(x => vl(x, Y(1384), Y(1526), 2, 'dot'));
      // 오른쪽 아래: 현장 안전조치 확인 · 작업 완료 확인
      hl(Y(1561), MID, R); ctr(MID, R, Y(1543), '현장 안전조치 확인', { b: true });
      confirmRows(MID, [Y(1612), Y(1668), Y(1724)], 974, [1180, 1460], 1469);
      hl(Y(1775), MID, R); hl(Y(1810), MID, R); ctr(MID, R, Y(1792), '작업 완료 확인', { b: true });
      doneRows(MID, 974, 974, 1469, [Y(1836), Y(1858), Y(1892), Y(1947), Y(2003)]);
      hl(Y(2035));
    }

    // ---------- 현장 안전조치 확인 / 작업 완료 확인(전원 복구) ----------
    if (P.confhdr) {
      const [h0, h1] = P.confhdr, [cf0, cf1, ys] = P.conf;
      const MID = 866;
      hl(h1); hl(cf1); vl(MID, h0, cf1);
      ctr(L, MID, (h0 + h1) / 2, '현장 안전조치 확인', { b: true });
      ctr(MID, R, (h0 + h1) / 2, t.completion === 'power' ? '전원 복구' : '작업 완료 확인', { b: true });
      confirmRows(L, ys, 202, [410, 725], 734);
      if (t.completion === 'power') {
        at(897, cf0 + 32, '※ 모든 작업이 완료된 후 작업부서 담당자 요청에', { b: true, x1: R - 6 });
        at(928, cf0 + 72, '의해서만 전원을 복구하여야 한다.', { b: true });
        at(928, cf0 + 115, '전원 복구 요청자 :'); hl(cf0 + 138, 1196, 1432, 2); tx(1365, cf0 + 93, 1432, cf0 + 137, IN, { a: 'r', fit: false });
        ctr(1196, 1360, cf0 + 115, fname('power_restore'), { fit: false }); fsig(1402, cf0 + 115, 'power_restore');
        at(928, cf0 + 175, '전원 복구 시간&nbsp;&nbsp;&nbsp;:');
      } else {
        doneRows(MID, 951, 980, 1464, [cf0 + 31, cf0 + 62, cf0 + 98, cf0 + 159, cf0 + 220]);
      }
    }

    // ---------- 발급자 · 승인자 · 관련부서 협조자 ----------
    const [a0, a1, ays] = P.approve;
    hl(a1); vl(869, a0, a1);
    [['발급자', r.issuer, 'issuer'], ['승인자', r.approver, 'approver']].forEach(([lab2, p, role], i) => {
      const y = ays[i]; p = p || {};
      at(APV.lab, y, lab2);
      at(APV.dept[0], y, '부서'); ctr(APV.dept[1], APV.dept[2], y, esc(p.dept));
      at(APV.title[0], y, '직책'); ctr(APV.title[1], APV.title[2], y, esc(p.title));
      at(APV.name[0], y, '성명'); ctr(APV.name[1], APV.name[2], y, esc(p.name));
      at(APV.inn, y, IN);
      sig(831, y, role);
    });
    at(APV.co1[0], ays[0], APV.co1[1]);
    APV.co2.forEach(([x, s]) => at(x, ays[1], s));
    // 부서·직책 칸은 원래 손글씨용으로 좁아서, 입력한 글자가 길면 칸에 맞춰 자동으로 줄임
    ctr(1003, 1066, ays[1], forg('coop_dept'), { fit: true }); ctr(1125, 1215, ays[1], fname('coop_title'), { fit: true }); ctr(1276, 1410, ays[1], fname('coop'), { fit: true });
    fsig(1439, ays[1], 'coop');

    // ---------- 작업허가 연장확인 ----------
    const [e0, e1, ex1, ex3] = P.ext;
    [ex1, 869, ex3].forEach(x => vl(x, e0, e1));
    const ec = (e0 + e1) / 2;
    ctr(L, ex1, ec, '작업허가 연장확인', { b: true });
    at(ex1 + 14, ec, '공사담당자 :', { b: true }); tx(ex1, ec - 22, 855, ec + 22, IN, { a: 'r', b: true, fit: false });
    tx(ex1 + 200, ec - 22, 790, ec + 22, fname('ext'), { a: 'c', b: true });
    fsig(825, ec, 'ext');
    ctr(869, ex3, ec, '작업허가 연장시간', { b: true });
    ctr(ex3, R, ec, '~', { b: true });

    return `
    <article class="sheet pdf form ${ctx.unapproved ? 'unapproved' : ''}">
      <div class="pdf-in fl" style="transform-origin:0 0;transform:translate(${offX.toFixed(2)}px,${offY.toFixed(2)}px) scale(${sx.toFixed(5)},${sy.toFixed(5)})">${o.join('')}</div>
    </article>`;

    // 현장 안전조치 확인 3줄 (작업자·감독자·입회자)
    function confirmRows(x0, ys, labX, valX, inX) {
      const labs = [['작', '업', '자'], ['감', '독', '자'], ['입', '회', '자']];
      const names = [r.worker, r.supervisor, r.witness];
      const keys = ['worker', 'supervisor', 'witness'];
      ys.forEach((y, i) => {
        labs[i].forEach((ch, k) => at(labX + k * 80, y, ch));
        at(labX + 197, y, ':');
        ctr(valX[0], valX[1], y, esc(names[i]) || fname(keys[i]));
        at(inX, y, IN);
        fsig(inX + 23, y, keys[i]);
      });
    }
    // 작업 완료 확인 (완료시간 + 작업자·감독자·운영근무자) — 종이에 수기
    function doneRows(x0, labT, labX, inX, ys) {
      const [yT, yDot, y1, y2, y3] = ys;
      at(labT, yT, '완&nbsp;&nbsp;료&nbsp;&nbsp;&nbsp;시&nbsp;&nbsp;간&nbsp;:');
      hl(yDot, x0 + 2, R - 2, 2, 'dot');
      [[y1, ['작', '업', '자'], 'done_worker'], [y2, ['감', '독', '자'], 'done_supervisor']].forEach(([y, chs, fk]) => {
        chs.forEach((ch, k) => at(labX + k * 76, y, ch));
        at(labX + 196, y, ':');
        ctr(labX + 230, inX - 10, y, fname(fk) || esc(fk === 'done_worker' ? r.worker : r.supervisor), { fit: false });
        at(inX, y, IN);
        fsig(inX + 23, y, fk);
      });
      at(labX, y3, '운&nbsp;영&nbsp;근&nbsp;무&nbsp;자&nbsp;:');
      ctr(labX + 280, inX - 10, y3, fname('done_ops'), { fit: false });
      at(inX, y3, IN);
      fsig(inX + 23, y3, 'done_ops');
    }
  }

  window.PermitFormLayout = { render, pages: PAGES };
})();
