/* 인쇄 보조: 칸에 비해 긴 글자는 들어갈 때까지 줄이고, 인쇄 때는 용지 폭에 맞춰 배율을 다시 계산 */
(function () {
  'use strict';
  const PFS = 27;   // 기본 글자 크기 (양식 좌표계 픽셀)

  function scaleForPrint(on) {
    document.querySelectorAll('.sheet.pdf .pdf-in').forEach(el => {
      el.style.zoom = on ? String(el.parentElement.clientWidth / 1654) : '';
    });
  }
  if (window.matchMedia) {
    const mq = window.matchMedia('print');
    const onChange = e => scaleForPrint(e.matches);
    if (mq.addEventListener) mq.addEventListener('change', onChange); else if (mq.addListener) mq.addListener(onChange);
  }
  window.addEventListener('beforeprint', () => scaleForPrint(true));
  window.addEventListener('afterprint', () => scaleForPrint(false));

  function fitPdfText(root) {
    root.querySelectorAll('.sheet.pdf [data-fit]').forEach(el => {
      let fs = parseFloat(el.style.fontSize) || PFS;
      while ((el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 1) && fs > 14) {
        fs -= 1; el.style.fontSize = fs + 'px';
      }
    });
  }
  // 화면에서 A4 양식을 폭에 맞춰 축소 (휴대폰에서 양식이 잘려 보이던 문제, 2026-11-23)
  //  - transform 으로 줄이고 감싼 칸(.sheet-wrap 등)의 크기를 줄인 크기로 맞춤 → 아이폰 사파리에서도 안정적
  //  - 인쇄할 때는 style.css 의 @media print 가 이 축소를 모두 무시함
  const SHEET_W = 793.7, SHEET_H = 1122.5;   // 210mm × 297mm
  function scaleSheet(wrap, k) {
    const s = wrap.querySelector('.sheet');
    if (!s) return;
    if (Math.abs(k - 1) < 0.001) { wrap.style.width = wrap.style.height = ''; s.style.transform = ''; wrap.classList.remove('scaled'); return; }
    wrap.classList.add('scaled');
    wrap.style.width = (SHEET_W * k) + 'px'; wrap.style.height = (SHEET_H * k) + 'px';
    s.style.transformOrigin = '0 0'; s.style.transform = `scale(${k})`;
  }
  function fitSheets(root) {
    if (!root) return;
    const avail = root.clientWidth;
    if (!avail) return;
    const k = Math.min(1, avail / SHEET_W);
    root.querySelectorAll('.sheet-wrap').forEach(w => scaleSheet(w, k));
  }
  window.PrintKit = { fitPdfText, scaleForPrint, scaleSheet, fitSheets, SHEET_W };
})();
