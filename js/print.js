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
  window.PrintKit = { fitPdfText, scaleForPrint };
})();
