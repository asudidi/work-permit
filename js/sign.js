/*
 * 손서명 (2026-11-18 추가, 11-19 개선)
 *  - 서명 칸: 인쇄 양식(layout.js)의 (인) 자리마다 한 칸
 *      · 한 번만 받는 칸(신청인·발급자·승인자·작업자·감독자·입회자·협조자)은 칸 이름 = key
 *      · 허가서마다 있는 칸(작업 완료 확인·연장확인·차단 확인·굴착 항목 확인자)은 칸 이름 = '허가서종류:key'
 *  - 칸 고르기는 '역할' 단위: 역할 줄 하나에 허가서별 칩. 여러 칸을 골라 한 번 서명하면 고른 칸 전체에 들어감
 *      (일괄로 하려면 역할의 [전체], 따로 하려면 허가서 칩 하나만) · 고른 칸은 위에 모여 보이고 ✕로 뺄 수 있음
 *  - 직원 화면(허가서 보기)의 [손서명] 칸: QR·링크 열기/닫기, 칸 현황, 고른 칸 직접 서명, 고른 서명 지우기
 *  - QR·링크로 들어온 화면(#/sign/허가서id/열쇠): 로그인 없이 → 칸 고르기 → 이름 → [확인] → 손서명 → [서명 완료]
 *    직원이 닫으면 열쇠가 지워져 QR·링크 모두 더 이상 들어올 수 없음
 */
(function () {
  'use strict';
  const { TYPES, typeById, esc } = window.Kit;

  const SHARED = {
    applicant: '신청인', issuer: '발급자', approver: '승인자',
    worker: '작업자 (작업 책임자)', supervisor: '감독자', witness: '입회자', coop: '관련부서 협조자'
  };
  // 허가서마다 있는 칸의 역할 이름
  const SCOPED = {
    done_worker: '작업자', done_supervisor: '감독자', done_ops: '운영근무자', power_restore: '전원 복구 요청자',
    ext: '공사담당자', cutoff_work: '작업 부서 담당자', cutoff_ops: '운전 부서 담당자'
  };
  // 역할 묶음 (화면에 이 순서로)
  const SECTIONS = [
    ['신청 · 발급 · 승인', ['applicant', 'issuer', 'approver']],
    ['작업 인원 · 현장 안전조치 확인', ['worker', 'supervisor', 'witness', 'coop']],
    ['작업 완료 확인', ['done_worker', 'done_supervisor', 'done_ops', 'power_restore']],
    ['작업허가 연장확인', ['ext']],
    ['정전작업 차단 확인', ['cutoff_work', 'cutoff_ops']],
    ['굴착 항목 확인자', ['c0', 'c1', 'c2', 'c3', 'c4']]
  ];
  const fsId = (tid, key) => (key in SHARED ? key : tid + ':' + key);

  /** 이 허가서(묶음)의 서명 칸 [{id, key, tid, role, short}] */
  function slotsFor(typeIds) {
    const pages = (window.PermitFormLayout && window.PermitFormLayout.pages) || {};
    const ts = TYPES.filter(t => typeIds.includes(t.id));
    const out = [], seen = new Set();
    const add = (tid, key, role) => {
      const id = fsId(tid, key);
      if (seen.has(id)) return;
      seen.add(id); out.push({ id, key, tid, role, short: key in SHARED ? '' : typeById(tid).short });
    };
    if (!ts.length) return out;
    Object.keys(SHARED).forEach(k => add(ts[0].id, k, SHARED[k]));
    ts.forEach(t => {
      const P = pages[t.id] || {};
      if (t.completion === 'power') add(t.id, 'power_restore', SCOPED.power_restore);
      else ['done_worker', 'done_supervisor', 'done_ops'].forEach(k => add(t.id, k, SCOPED[k]));
      add(t.id, 'ext', SCOPED.ext);
      if (P.cutoff) { add(t.id, 'cutoff_work', SCOPED.cutoff_work); add(t.id, 'cutoff_ops', SCOPED.cutoff_ops); }
      if (P.confirmer && t.checks[0]) t.checks[0].items.forEach((it, i) => add(t.id, 'c' + i, `${i + 1}. ${it.split(':')[0].trim()}`));
    });
    return out;
  }
  /** 칸을 사람이 읽는 이름으로: '작업 완료 확인 · 작업자 (화기)' */
  function slotLabel(s) {
    const sec = SECTIONS.find(([, keys]) => keys.includes(s.key));
    const head = s.key in SHARED ? '' : (sec ? sec[0] + ' · ' : '');
    return head + s.role + (s.short ? ` (${s.short})` : '');
  }
  // 직원이 직접 서명할 때 허가서에 적어 둔 이름을 기본값으로
  function guessName(r, key) {
    const n = r.names || {};
    const m = {
      applicant: (r.applicant || {}).name, issuer: (r.issuer || {}).name, approver: (r.approver || {}).name,
      worker: r.worker, supervisor: r.supervisor, witness: r.witness, coop: n.coop,
      done_worker: n.done_worker || r.worker, done_supervisor: n.done_supervisor || r.supervisor,
      cutoff_work: n.cutoff_work || r.supervisor
    };
    return m[key] || n[key] || '';
  }

  function toast(msg) {
    const t = document.getElementById('toast');
    if (!t) return alert(msg);
    t.textContent = msg; t.style.display = 'block';
    clearTimeout(t._h); t._h = setTimeout(() => { t.style.display = 'none'; }, 3500);
  }
  const errMsg = e => (e && e.message) ? e.message : String(e);

  /* ---------- 칸 고르기 (역할 줄 + 허가서 칩) ----------
   * opt: { slots, signed: {id: {name,...}|이름}, mode: 'visitor'|'staff', sel: Set, onChange() }
   * - visitor: 서명된 칩은 고를 수 없음
   * - staff  : 서명된 칩도 고를 수 있음 (지우기용)
   */
  function pickerHtml(opt) {
    const { slots, signed, mode, sel } = opt;
    const isSigned = id => !!signed[id];
    const signedName = id => { const s = signed[id]; return s ? (typeof s === 'string' ? s : s.name) : ''; };
    const can = id => mode === 'staff' || !isSigned(id);
    const chip = s => {
      const on = sel.has(s.id), sg = isSigned(s.id);
      const t = s.tid && typeById(s.tid);
      const label = s.key in SHARED ? '전체 허가서 공통' : s.short;
      return `<button type="button" class="sp-chip ${on ? 'on' : ''} ${sg ? 'signed' : ''}" data-id="${esc(s.id)}" ${can(s.id) ? '' : 'disabled'}
        style="--c:${s.key in SHARED ? '#1f5fae' : (t ? t.color : '#555')}" aria-pressed="${on}">
        <span class="sp-tick">${on ? '✓' : ''}</span>${esc(label)}${sg ? `<small>${mode === 'staff' ? esc(signedName(s.id)) : '서명 완료'}</small>` : ''}</button>`;
    };
    return SECTIONS.map(([title, keys]) => {
      const rows = keys.map(k => slots.filter(s => s.key === k)).filter(a => a.length);
      if (!rows.length) return '';
      return `<div class="sp-sec"><div class="sg-grp">${esc(title)}</div>${rows.map(list => {
        const pickable = list.filter(s => can(s.id));
        const all = pickable.length && pickable.every(s => sel.has(s.id));
        const some = pickable.some(s => sel.has(s.id));
        const multi = list.length > 1;
        return `<div class="sp-role ${some ? 'on' : ''}">
          <div class="sp-rh">
            <b>${esc(list[0].role)}</b>
            ${multi && pickable.length > 1 ? `<button type="button" class="sp-all ${all ? 'on' : ''}" data-all="${esc(list[0].key)}">${all ? '전체 해제' : `전체 ${pickable.length}장 고르기`}</button>` : ''}
          </div>
          <div class="sp-chips">${list.map(chip).join('')}</div>
        </div>`;
      }).join('')}</div>`;
    }).join('');
  }
  /** 고른 칸 요약 (✕로 하나씩 빼기 · 모두 해제) */
  function selectedHtml(slots, sel) {
    const list = slots.filter(s => sel.has(s.id));
    if (!list.length) return '<div class="sp-selnone">아래에서 서명할 칸을 고르세요. 여러 칸을 고르면 한 번 서명으로 모두 들어갑니다.</div>';
    return `<div class="sp-sel"><b>고른 칸 ${list.length}개</b>
      ${list.map(s => `<span class="sp-pill">${esc(slotLabel(s))}<button type="button" data-unsel="${esc(s.id)}" aria-label="빼기">✕</button></span>`).join('')}
      <button type="button" class="link" data-clearsel>모두 해제</button></div>`;
  }
  /** 고르기 동작 (클릭 위임). 바뀌면 onChange */
  function bindPicker(root, opt) {
    root.addEventListener('click', e => {
      const c = e.target.closest('.sp-chip[data-id]');
      if (c && !c.disabled) { const id = c.dataset.id; opt.sel.has(id) ? opt.sel.delete(id) : opt.sel.add(id); return opt.onChange(); }
      const a = e.target.closest('[data-all]');
      if (a) {
        const list = opt.slots.filter(s => s.key === a.dataset.all && (opt.mode === 'staff' || !opt.signed[s.id]));
        const all = list.every(s => opt.sel.has(s.id));
        list.forEach(s => (all ? opt.sel.delete(s.id) : opt.sel.add(s.id)));
        return opt.onChange();
      }
      const u = e.target.closest('[data-unsel]');
      if (u) { opt.sel.delete(u.dataset.unsel); return opt.onChange(); }
      if (e.target.closest('[data-clearsel]')) { opt.sel.clear(); return opt.onChange(); }
    });
  }

  /* ---------- 서명 패드 ---------- */
  function makePad(canvas) {
    const g = canvas.getContext('2d');
    let last = null, empty = true, dpr = 1;
    let box = [Infinity, Infinity, -Infinity, -Infinity];
    function setup() {
      const r = canvas.getBoundingClientRect();
      dpr = Math.max(1, window.devicePixelRatio || 1);
      canvas.width = Math.max(1, Math.round(r.width * dpr)); canvas.height = Math.max(1, Math.round(r.height * dpr));
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.lineCap = 'round'; g.lineJoin = 'round'; g.strokeStyle = '#111'; g.lineWidth = 3.4;
      empty = true; box = [Infinity, Infinity, -Infinity, -Infinity];
    }
    setup();
    const pos = e => { const r = canvas.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
    const grow = p => { box = [Math.min(box[0], p[0]), Math.min(box[1], p[1]), Math.max(box[2], p[0]), Math.max(box[3], p[1])]; };
    canvas.addEventListener('pointerdown', e => {
      e.preventDefault();
      try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* 무시 */ }
      last = pos(e); grow(last); empty = false;
      g.beginPath(); g.moveTo(last[0], last[1]); g.lineTo(last[0] + 0.1, last[1] + 0.1); g.stroke();
    });
    canvas.addEventListener('pointermove', e => {
      if (!last) return;
      e.preventDefault();
      const p = pos(e);
      g.beginPath(); g.moveTo(last[0], last[1]); g.lineTo(p[0], p[1]); g.stroke();
      last = p; grow(p);
    });
    const end = () => { last = null; };
    canvas.addEventListener('pointerup', end); canvas.addEventListener('pointercancel', end); canvas.addEventListener('pointerleave', end);
    return {
      clear: setup,
      isEmpty: () => empty,
      // 서명 부분만 잘라서 인쇄 칸 비율(가로 1.7 : 세로 1)에 맞춘 투명 PNG로
      toPNG(w = 360, h = 212) {
        const padPx = 6;
        const x0 = Math.max(0, box[0] - padPx), y0 = Math.max(0, box[1] - padPx);
        const bw = Math.max(10, box[2] - box[0] + padPx * 2), bh = Math.max(10, box[3] - box[1] + padPx * 2);
        const out = document.createElement('canvas'); out.width = w; out.height = h;
        const s = Math.min((w - 8) / bw, (h - 8) / bh, 2.2);
        out.getContext('2d').drawImage(canvas, x0 * dpr, y0 * dpr, bw * dpr, bh * dpr, (w - bw * s) / 2, (h - bh * s) / 2, bw * s, bh * s);
        const url = out.toDataURL('image/png');
        return url.length > 38000 && w > 200 ? this.toPNG(Math.round(w * 0.75), Math.round(h * 0.75)) : url;
      }
    };
  }

  /** 이름 입력 → [확인] → 손서명 → [서명 완료]  (직원 직접 서명 창 · QR/링크 서명 화면 공용) */
  function signFlow(host, opt) {
    let name = opt.name || '';
    const what = opt.what ? `<div class="sg-what">${opt.what}</div>` : '';
    function stepName() {
      host.innerHTML = `${what}
        <label class="fld sg-name"><span>이름</span><input id="sgName" value="${esc(name)}" maxlength="20" autocomplete="off" placeholder="본인 이름을 입력하세요"></label>
        <div class="sg-btns">${opt.cancel ? '<button type="button" class="btn ghost" data-cancel>취소</button>' : ''}<button type="button" class="btn big" id="sgOk">확인</button></div>`;
      const inp = host.querySelector('#sgName');
      const ok = () => {
        name = inp.value.trim();
        if (!name) { toast('이름을 입력하세요.'); inp.focus(); return; }
        stepSign();
      };
      host.querySelector('#sgOk').onclick = ok;
      inp.onkeydown = e => { if (e.key === 'Enter' && !e.isComposing) ok(); };
      const c = host.querySelector('[data-cancel]'); if (c) c.onclick = opt.cancel;
      setTimeout(() => inp.focus(), 50);
    }
    function stepSign() {
      host.innerHTML = `${what}
        <div class="sg-who"><b>${esc(name)}</b> 님, 아래 칸에 손가락으로 서명해 주세요. <button type="button" class="link" data-back>이름 고치기</button></div>
        <canvas class="sigpad"></canvas>
        <div class="sg-btns"><button type="button" class="btn ghost" data-clear>지우기</button><button type="button" class="btn big ok" id="sgDone">서명 완료</button></div>`;
      const pad = makePad(host.querySelector('canvas'));
      host.querySelector('[data-clear]').onclick = () => pad.clear();
      host.querySelector('[data-back]').onclick = stepName;
      const done = host.querySelector('#sgDone');
      done.onclick = async () => {
        if (pad.isEmpty()) return toast('서명해 주세요.');
        done.disabled = true; done.textContent = '저장 중…';
        try { await opt.submit(name, pad.toPNG()); }
        catch (e) { toast(errMsg(e)); done.disabled = false; done.textContent = '서명 완료'; }
      };
    }
    stepName();
  }
  // 고른 칸 목록 (서명 창 위에 '어디에 들어가는지' 표시)
  const whatHtml = list => `<b>서명이 들어갈 칸 ${list.length}개</b><ul>${list.map(s => `<li>${esc(slotLabel(s))}</li>`).join('')}</ul>`;

  function modal(title, bodyHtml) {
    const ov = document.createElement('div');
    ov.className = 'sg-ov no-print';
    ov.innerHTML = `<div class="sg-md" role="dialog" aria-label="${esc(title)}"><div class="sg-md-h"><b>${esc(title)}</b><button type="button" class="link" data-x>✕</button></div><div class="sg-md-b">${bodyHtml}</div></div>`;
    document.body.appendChild(ov);
    const close = () => ov.remove();
    ov.querySelector('[data-x]').onclick = close;
    return { root: ov.querySelector('.sg-md-b'), close };
  }

  const linkUrl = (id, code) => location.origin + location.pathname + '#/sign/' + encodeURIComponent(id) + '/' + encodeURIComponent(code);
  const qrImg = url => {
    if (!window.qrcode) return '<p class="muted">QR을 만들 수 없습니다 (qrcode.min.js 확인). 링크 복사를 쓰세요.</p>';
    const q = window.qrcode(0, 'M'); q.addData(url); q.make();
    return `<img class="sg-qrimg" src="${q.createDataURL(6, 4)}" alt="서명 QR 코드">`;
  };
  // 메신저로 보낼 안내 문구 + 링크
  const shareText = (r, url) => `[안전작업허가서 서명 요청]\n${r.title || r.equipName || ''}${r.workDate ? ` (${r.workDate})` : ''}\n아래 링크를 눌러 본인 칸을 고르고, 이름 입력 후 서명해 주세요.\n${url}`;
  async function copyText(text) {
    try { await navigator.clipboard.writeText(text); return true; }
    catch (e) {
      const ta = document.createElement('textarea'); ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select();
      let ok = false; try { ok = document.execCommand('copy'); } catch (err) { ok = false; }
      ta.remove();
      if (!ok) prompt('아래 내용을 복사하세요', text);
      return ok;
    }
  }

  /* ---------- 직원 화면: 허가서 보기 안의 [손서명] 칸 ---------- */
  function panel(host, r, token, onSigns) {
    const slots = slotsFor(r.types || []);
    const sel = new Set();
    let link = null, timer = null, busy = false;
    r.signs = r.signs || {};
    const sigKey = s => JSON.stringify(Object.keys(s).sort().map(k => [k, s[k].name, s[k].at]));

    function paint() {
      if (!document.body.contains(host)) return stop();
      const n = slots.filter(s => r.signs[s.id]).length;
      const chosen = slots.filter(s => sel.has(s.id));
      const toSign = chosen.filter(s => !r.signs[s.id]), toDel = chosen.filter(s => r.signs[s.id]);
      const url = link ? linkUrl(r.id, link.code) : '';
      host.innerHTML = `
        <section class="card no-print sg-panel">
          <div class="sg-head">
            <div><h2 style="margin:0">✍ 손서명 <span class="muted">${n} / ${slots.length}칸 서명됨</span></h2>
              <div class="muted small">서명한 칸은 인쇄물에 이름과 서명이 같이 나옵니다. 서명 안 한 칸은 빈칸 (인) — 종이에 서명하면 됩니다.</div></div>
            <div class="actions">${link
              ? '<button class="btn bad" data-qr="close">■ QR·링크 닫기</button>'
              : '<button class="btn" data-qr="open">📱 QR·링크로 서명 받기</button>'}</div>
          </div>
          ${link ? `
          <div class="sg-qr">
            ${qrImg(url)}
            <div class="sg-qrtxt">
              <b>서명 받는 중</b> — 둘 중 편한 방법으로
              <ol><li><b>QR</b>: 서명할 사람이 휴대폰 카메라로 찍기</li>
                <li><b>링크</b>: [🔗 링크 복사] → 카카오톡·문자·메신저에 붙여넣어 보내기</li></ol>
              <div class="sg-share">
                <button class="btn ok" data-copy="msg">🔗 링크 복사 (안내 문구 포함)</button>
                <button class="btn ghost sm" data-copy="url">주소만 복사</button>
                ${navigator.share ? '<button class="btn ghost sm" data-share>📤 공유하기</button>' : ''}
              </div>
              <input class="sg-url" readonly value="${esc(url)}" aria-label="서명 링크">
              <div class="muted small">연 사람: ${esc(link.openedBy)} · ${esc(link.openedAt)}<br>
                서명을 다 받으면 꼭 <b>[QR·링크 닫기]</b>를 누르세요. 닫으면 QR과 보낸 링크 모두 더 이상 열리지 않습니다.</div>
            </div>
          </div>` : ''}
          <div class="sg-pickwrap">
            <div class="sg-pickhead"><b>칸 고르기</b> <span class="muted small">역할을 [전체]로 고르면 모든 허가서에 한 번에, 칩 하나만 고르면 그 허가서만. 서명된 칩을 고르면 지울 수 있습니다.</span></div>
            ${selectedHtml(slots, sel)}
            ${pickerHtml({ slots, signed: r.signs, mode: 'staff', sel })}
            <div class="sg-bar">
              <button class="btn" data-signsel ${toSign.length ? '' : 'disabled'}>✍ 고른 빈 칸 ${toSign.length}개 직접 서명</button>
              <button class="btn bad" data-delsel ${toDel.length ? '' : 'disabled'}>고른 서명 ${toDel.length}개 지우기</button>
            </div>
          </div>
        </section>`;
    }
    async function load(silent) {
      if (busy) return;
      busy = true;
      try {
        const res = await window.api('listSigns', token, r.id);
        const changed = sigKey(res.signs) !== sigKey(r.signs);
        const linkChanged = JSON.stringify(res.link) !== JSON.stringify(link);
        r.signs = res.signs; link = res.link;
        if (changed && onSigns) onSigns();
        if (changed || linkChanged || !silent) paint();
        if (changed && silent) toast('새 서명이 들어왔습니다.');
      } catch (e) { if (!silent) toast(errMsg(e)); }
      finally { busy = false; }
      schedule();
    }
    function schedule() {
      stop();
      if (!link || !document.body.contains(host)) return;
      timer = setTimeout(() => { if (!document.hidden) load(true); else schedule(); }, 5000);   // 열려 있는 동안 5초마다 새 서명 확인
    }
    function stop() { clearTimeout(timer); timer = null; }

    bindPicker(host, { slots, get signed() { return r.signs; }, mode: 'staff', sel, onChange: paint });
    host.addEventListener('click', async e => {
      const q = e.target.closest('[data-qr]');
      if (q) {
        q.disabled = true;
        try {
          if (q.dataset.qr === 'open') { link = await window.api('openSignLink', token, r.id); toast('열었습니다. QR을 보여 주거나 링크를 보내세요. 다 받으면 [QR·링크 닫기].'); }
          else { await window.api('closeSignLink', token, r.id); link = null; toast('닫았습니다. 이제 QR·링크로는 서명할 수 없습니다.'); }
        } catch (err) { toast(errMsg(err)); }
        paint(); schedule();
        return;
      }
      const cp = e.target.closest('[data-copy]');
      if (cp && link) {
        const url = linkUrl(r.id, link.code);
        if (await copyText(cp.dataset.copy === 'msg' ? shareText(r, url) : url)) toast('복사했습니다. 메신저에 붙여넣어 보내세요.');
        return;
      }
      if (e.target.closest('[data-share]') && link) {
        const url = linkUrl(r.id, link.code);
        try { await navigator.share({ title: '안전작업허가서 서명 요청', text: shareText(r, '').trim(), url }); } catch (err) { /* 취소 */ }
        return;
      }
      if (e.target.closest('.sg-url')) { e.target.select(); return; }
      if (e.target.closest('[data-delsel]')) {
        const list = slots.filter(s => sel.has(s.id) && r.signs[s.id]);
        if (!list.length) return;
        if (!confirm(`고른 서명 ${list.length}개를 지울까요?\n\n${list.map(s => '· ' + slotLabel(s) + ' — ' + r.signs[s.id].name).join('\n')}`)) return;
        try {
          await window.api('deleteSign', token, r.id, list.map(s => s.id));
          list.forEach(s => { delete r.signs[s.id]; sel.delete(s.id); });
          if (onSigns) onSigns(); paint(); toast(`서명 ${list.length}개를 지웠습니다.`);
        } catch (err) { toast(errMsg(err)); }
        return;
      }
      if (e.target.closest('[data-signsel]')) {
        const list = slots.filter(s => sel.has(s.id) && !r.signs[s.id]);
        if (!list.length) return;
        const names = [...new Set(list.map(s => guessName(r, s.key)).filter(Boolean))];
        const m = modal('직접 서명', '<div id="sgFlow"></div>');
        signFlow(m.root.querySelector('#sgFlow'), {
          name: names.length === 1 ? names[0] : '', what: whatHtml(list), cancel: m.close,
          submit: async (name, png) => {
            await window.api('saveSign', token, r.id, list.map(s => s.id), name, '', png);
            list.forEach(s => sel.delete(s.id));
            m.close(); toast(`서명을 ${list.length}칸에 저장했습니다.`);
            await load(false);
          }
        });
      }
    });
    // 다른 창을 보다가 이 화면으로 돌아오면 바로 새 서명 확인
    const onVis = () => {
      if (!document.body.contains(host)) return document.removeEventListener('visibilitychange', onVis);
      if (!document.hidden && link) load(true);
    };
    document.addEventListener('visibilitychange', onVis);
    paint();
    load(false);
  }

  /* ---------- QR·링크로 들어온 화면 (로그인 없음) ---------- */
  function visitorPage(app, id, code) {
    app.innerHTML = `<header class="top"><h1>안전작업허가서 서명</h1></header><main class="sgv" id="sgv"><div class="card empty">불러오는 중…</div></main>`;
    const v = app.querySelector('#sgv');
    let info = null, slots = [];
    const sel = new Set();
    const closed = msg => {
      v.innerHTML = `<div class="card sg-closed"><div class="sg-big">🔒</div><h2>서명 받기가 닫혀 있습니다</h2><p class="muted">${esc(msg)}</p></div>`;
    };
    async function loadInfo() {
      try { info = await window.api('signInfo', id, code); slots = slotsFor(info.types); [...sel].forEach(x => { if (info.signed[x]) sel.delete(x); }); drawPick(); }
      catch (e) { closed(errMsg(e)); }
    }
    function summary() {
      const types = TYPES.filter(t => info.types.includes(t.id)).map(t => `<span class="badge" style="--c:${t.color}">${esc(t.short)}</span>`).join('');
      const when = [info.workDate, info.timeFrom && info.timeTo ? `${info.timeFrom} ~ ${info.timeTo}` : info.timeFrom].filter(Boolean).join(' ');
      return `<div class="card sg-sum">
        <div>${types}${info.permitNo ? ` <span class="muted">발행번호 ${esc(info.permitNo)}</span>` : ''}</div>
        <h2 style="margin:6px 0 4px">${esc(info.title || info.equipName || '작업허가서')}</h2>
        <dl class="dl">
          ${info.area ? `<dt>작업지역</dt><dd>${esc(info.area)}</dd>` : ''}
          ${when ? `<dt>작업일시</dt><dd>${esc(when)}</dd>` : ''}
          ${info.contractor ? `<dt>작업업체</dt><dd>${esc(info.contractor)}</dd>` : ''}
          ${info.summary ? `<dt>작업개요</dt><dd>${esc(info.summary)}</dd>` : ''}
        </dl></div>`;
    }
    function drawPick() {
      const n = sel.size;
      v.innerHTML = `${summary()}
        <div class="card">
          <h2>서명할 칸을 고르세요</h2>
          <p class="hint">본인 역할의 칸을 누르세요. <b>여러 칸을 고르면 한 번 서명으로 모두</b> 들어갑니다. 허가서마다 있는 칸은 [전체 고르기]로 한 번에 고를 수 있습니다.</p>
          <div id="sgSel">${selectedHtml(slots, sel)}</div>
          ${pickerHtml({ slots, signed: info.signed, mode: 'visitor', sel })}
        </div>
        <div class="sg-sticky"><button class="btn big ok" id="sgGo" ${n ? '' : 'disabled'}>${n ? `고른 ${n}칸 서명하기 ›` : '칸을 고르세요'}</button></div>`;
      v.querySelector('#sgGo').onclick = drawSign;
    }
    bindPicker(v, { get slots() { return slots; }, get signed() { return info ? info.signed : {}; }, mode: 'visitor', sel, onChange: () => { const y = window.scrollY; drawPick(); window.scrollTo(0, y); } });
    function drawSign() {
      const list = slots.filter(s => sel.has(s.id));
      if (!list.length) return;
      v.innerHTML = `${summary()}
        <div class="card sg-step">
          <div class="sg-who-top"><button class="link" id="sgBack">‹ 칸 다시 고르기</button></div>
          <div id="sgFlow"></div>
        </div>`;
      v.querySelector('#sgBack').onclick = drawPick;
      signFlow(v.querySelector('#sgFlow'), {
        what: whatHtml(list),
        submit: async (name, png) => {
          let res;
          try { res = await window.api('signSubmit', id, code, list.map(s => s.id), name, png); }
          catch (e) { if (/닫혀/.test(errMsg(e))) return closed(errMsg(e)); throw e; }
          const saved = list.filter(s => res.saved.includes(s.id)), skipped = list.filter(s => res.skipped.includes(s.id));
          sel.clear();
          v.innerHTML = `<div class="card sg-closed"><div class="sg-big">✅</div><h2>서명이 저장되었습니다</h2>
            <p><b>${esc(name)}</b> · ${saved.length}칸</p>
            <ul class="sg-donelist">${saved.map(s => `<li>${esc(slotLabel(s))}</li>`).join('')}</ul>
            ${skipped.length ? `<p class="muted small">그 사이 다른 사람이 서명해서 건너뛴 칸: ${skipped.map(s => esc(slotLabel(s))).join(', ')}</p>` : ''}
            <button class="btn big" id="sgMore">다른 칸 서명하기</button></div>`;
          v.querySelector('#sgMore').onclick = () => { v.innerHTML = '<div class="card empty">불러오는 중…</div>'; loadInfo(); };
        }
      });
      window.scrollTo(0, 0);
    }
    loadInfo();
  }

  window.SignKit = { slotsFor, fsId, makePad, panel, visitorPage };
})();
