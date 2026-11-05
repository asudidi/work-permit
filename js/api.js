/* Apps Script 서버 호출. Content-Type 을 text/plain 으로 보내 브라우저의 사전 요청(preflight)을 피함 */
(function () {
  'use strict';
  async function api(fn, ...args) {
    const url = (window.CONFIG || {}).API_URL || '';
    if (!url || url.indexOf('여기에_배포_ID') >= 0) throw new Error('서버 주소(API_URL)가 설정되지 않았습니다. js/config.js 를 확인하세요.');
    if (!/^https:\/\/script\.google\.com\/macros\/s\/[^/?#]+\/exec$/.test(url)) {
      throw new Error('서버 주소 형식이 올바르지 않습니다. js/config.js 의 API_URL 은 https://script.google.com/macros/s/…/exec 형태여야 합니다. (Apps Script → 배포 → 배포 관리 → 웹 앱 URL 복사)');
    }
    let res;
    try {
      res = await fetch(url, {
        method: 'POST', redirect: 'follow',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ fn, args })
      });
    } catch (e) {
      throw new Error('서버에 연결할 수 없습니다. 인터넷 연결과 서버 주소를 확인하세요.');
    }
    let j;
    try { j = await res.json(); } catch (e) { throw new Error('서버 응답을 읽을 수 없습니다. (배포 설정 확인: 액세스 권한 "모든 사용자")'); }
    if (!j.ok) throw new Error(j.error || '서버 오류');
    return j.data;
  }
  window.api = api;
})();
