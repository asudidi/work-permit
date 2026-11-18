/*
 * 손서명 (2026-11-18 추가)
 *  - 서명 칸 목록: 인쇄 양식(layout.js)의 (인) 자리마다 한 칸
 *      · 한 번만 받는 칸(신청인·발급자·승인자·작업자·감독자·입회자·협조자)은 칸 이름 = key
 *      · 허가서마다 받는 칸(작업 완료 확인·연장확인·차단 확인·굴착 항목 확인자)은 칸 이름 = '허가서종류:key'
 *  - 직원 화면(허가서 보기)의 [손서명] 칸: QR 열기·닫기, 칸별 서명 현황, 직접 서명, 서명 지우기
 *  - QR로 들어온 화면(#/sign/허가서id/열쇠): 로그인 없이 → 칸 고르기 → 이름 입력 → [확인] → 손서명 → [서명 완료]
 *    직원이 QR을 닫으면 열쇠가 지워져 더 이상 들어올 수 없음
 */
(function () {
  'use strict';
  const { TYPES, esc } = window.Kit;

  const SHARED = {
    applicant: '신청인', issuer: '발급자', approver: '승인자',
    worker: '작업자 (작업 책임자)', supervisor: '감독자', witness: '입회자', coop: '관련부서 협조자'
  };
  const SCOPED = {
    cutoff_work: '차단 확인 — 작업 부서 담당자', cutoff_ops: '차단 확인 — 운전 부서 담당자',
    power_restore: '전원 복구 요청자',
    done_worker: '작업 완료 확인 — 작업자', done_supervisor: '작업 완료 확인 — 감독자', done_ops: '작업 완료 확인 — 운영근무자',
    ext: '작업허가 연장확인 — 공사담당자'
  };
  const fsId = (tid, key) => (key in SHARED ? key : tid + ':' + key);

  /** 이 허가서(묶음)에서 서명받을 칸 목록 [{id, label, group}] */
  function slotsFor(typeIds) {
    const pages = (window.PermitFormLayout && window.PermitFormLayout.pages) || {};
    const ts = TYPES.filter(t => typeIds.includes(t.id));
    const out = [], seen = new Set();
    const add = (tid, key, label, group) => {
      const id = fsId(tid, key);
      if (seen.has(id)) return;
      seen.add(id); out.push({ id, key, tid, label, group });
    };
    if (!ts.length) return out;
    ['applicant', 'issuer', 'approver'].forEach(k => add(ts[0].id, k, SHARED[k], '신청 · 발급 · 승인'));
    ['worker', 'supervisor', 'witness', 'coop'].forEach(k => add(ts[0].id, k, SHARED[k], '작업 인원 (현장 안전조치 확인)'));
    ts.forEach(t => {
      const P = pages[t.id] || {};
      if (P.cutoff) { add(t.id, 'cutoff_work', SCOPED.cutoff_work, t.name); add(t.id, 'cutoff_ops', SCOPED.cutoff_ops, t.name); }
      if (P.confirmer && t.checks[0]) t.checks[0].items.forEach((it, i) => add(t.id, 'c' + i, `항목 확인자 ${i + 1}. ${it.split(':')[0].trim()}`, t.name));
      if (t.completion === 'power') add(t.id, 'power_restore', SCOPED.power_restore, t.name);
      else ['done_worker', 'done_supervisor', 'done_ops'].forEach(k => add(t.id, k, SCOPED[k], t.name));
      add(t.id, 'ext', SCOPED.ext, t.name);
    });
    return out;
  }
  // 직원이 직접 서명할 때 허가서에 적어 둔 이름을 기본값으로
  function guessName(r, slot) {
    const n = r.names || {};
    const m = {
      applicant: (r.applicant || {}).name, issuer: (r.issuer || {}).name, approver: (r.approver || {}).name,
      worker: r.worker, supervisor: r.supervisor, witness: r.witness, coop: n.coop,
      done_worker: n.done_worker || r.worker, done_supervisor: n.done_supervisor || r.supervisor,
      cutoff_work: n.cutoff_work || r.supervisor
    };
    return m[slot.key] || n[slot.key] || '';
  }

  function toast(msg) {
    const t = document.getElementById('toast');
    if (!t) return alert(msg);
    t.textContent = msg; t.style.display = 'block';
    clearTimeout(t._h); t._h = setTimeout(() => { t.style.display = 'none'; }, 3500);
  }
  const errMsg = e => (e && e.message) ? e.message : String(e);

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

  /** 이름 입력 → [확인] → 손서명 → [서명 완료]  (직원 직접 서명 창 · QR 서명 화면 공용) */
  function signFlow(host, opt) {
    let name = opt.name || '';
    function stepName() {
      host.innerHTML = `
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
      host.innerHTML = `
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
    if (!window.qrcode) return '<p class="muted">QR을 만들 수 없습니다 (qrcode.min.js 확인). 아래 주소를 보내 주세요.</p>';
    const q = window.qrcode(0, 'M'); q.addData(url); q.make();
    return `<img class="sg-qrimg" src="${q.createDataURL(6, 4)}" alt="서명 QR 코드">`;
  };

  /* ---------- 직원 화면: 허가서 보기 안의 [손서명] 칸 ---------- */
  function panel(host, r, token, onSigns) {
    const slots = slotsFor(r.types || []);
    let link = null, timer = null, busy = false;
    r.signs = r.signs || {};
    const sigKey = s => JSON.stringify(Object.keys(s).sort().map(k => [k, s[k].name, s[k].at]));

    function paint() {
      if (!document.body.contains(host)) return stop();
      const n = slots.filter(s => r.signs[s.id]).length;
      const groups = [...new Set(slots.map(s => s.group))];
      host.innerHTML = `
        <section class="card no-print sg-panel">
          <div class="sg-head">
            <div><h2 style="margin:0">✍ 손서명 <span class="muted">${n} / ${slots.length}칸 서명됨</span></h2>
              <div class="muted small">서명한 칸은 인쇄물에 이름과 서명이 같이 나옵니다. 서명 안 한 칸은 지금처럼 빈칸 (인) — 종이에 서명하면 됩니다.</div></div>
            <div class="actions">${link
              ? '<button class="btn bad" data-qr="close">■ QR 닫기</button>'
              : '<button class="btn" data-qr="open">📱 QR로 서명 받기</button>'}</div>
          </div>
          ${link ? `
          <div class="sg-qr">
            ${qrImg(linkUrl(r.id, link.code))}
            <div class="sg-qrtxt">
              <b>QR 서명 받는 중</b>
              <ol><li>서명할 사람이 휴대폰 카메라로 QR을 찍습니다.</li><li>서명할 칸을 고르고 → 이름 입력 → [확인] → 손가락으로 서명 → [서명 완료]</li><li>서명은 몇 초 안에 이 화면과 인쇄물에 나타납니다.</li></ol>
              <div class="muted small">연 사람: ${esc(link.openedBy)} · ${esc(link.openedAt)}<br>서명을 다 받으면 꼭 <b>[QR 닫기]</b>를 누르세요. 닫으면 이 QR로는 더 들어올 수 없습니다.</div>
              <button class="link small" data-copy>서명 주소 복사 (문자·메신저로 보낼 때)</button>
            </div>
          </div>` : ''}
          <div class="sg-list">${groups.map(gname => `
            <div class="sg-grp">${esc(gname)}</div>
            ${slots.filter(s => s.group === gname).map(s => {
              const sg = r.signs[s.id];
              return `<div class="sg-row ${sg ? 'on' : ''}">
                <span class="sg-lab">${esc(s.label)}</span>
                <span class="sg-val">${sg ? `<img src="${esc(sg.image)}" alt=""><b>${esc(sg.name)}</b><small class="muted">${esc(sg.via === 'QR' ? 'QR' : '직접')} · ${esc(sg.at)}</small>` : '<span class="muted">미서명</span>'}</span>
                <span class="sg-acts">${sg ? `<button class="link" data-del="${esc(s.id)}">지우기</button>` : `<button class="btn ghost sm" data-sign="${esc(s.id)}">직접 서명</button>`}</span>
              </div>`;
            }).join('')}`).join('')}
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
      timer = setTimeout(() => { if (!document.hidden) load(true); else schedule(); }, 5000);   // QR이 열려 있는 동안 5초마다 새 서명 확인
    }
    function stop() { clearTimeout(timer); timer = null; }

    host.addEventListener('click', async e => {
      const q = e.target.closest('[data-qr]');
      if (q) {
        q.disabled = true;
        try {
          if (q.dataset.qr === 'open') { link = await window.api('openSignLink', token, r.id); toast('QR을 열었습니다. 다 받으면 [QR 닫기]를 누르세요.'); }
          else { await window.api('closeSignLink', token, r.id); link = null; toast('QR을 닫았습니다. 이제 이 QR로는 서명할 수 없습니다.'); }
        } catch (err) { toast(errMsg(err)); }
        paint(); schedule();
        return;
      }
      if (e.target.closest('[data-copy]') && link) {
        const url = linkUrl(r.id, link.code);
        try { await navigator.clipboard.writeText(url); toast('서명 주소를 복사했습니다.'); } catch (err) { prompt('아래 주소를 복사하세요', url); }
        return;
      }
      const d = e.target.closest('[data-del]');
      if (d) {
        const s = slots.find(x => x.id === d.dataset.del);
        if (!confirm(`「${s ? s.label : ''}」 서명을 지울까요?`)) return;
        try { await window.api('deleteSign', token, r.id, d.dataset.del); delete r.signs[d.dataset.del]; if (onSigns) onSigns(); paint(); toast('서명을 지웠습니다.'); }
        catch (err) { toast(errMsg(err)); }
        return;
      }
      const sb = e.target.closest('[data-sign]');
      if (sb) {
        const s = slots.find(x => x.id === sb.dataset.sign);
        const m = modal(s.label + ' 서명', '<div id="sgFlow"></div>');
        signFlow(m.root.querySelector('#sgFlow'), {
          name: guessName(r, s), cancel: m.close,
          submit: async (name, png) => {
            await window.api('saveSign', token, r.id, s.id, name, '', png);
            m.close(); toast('서명을 저장했습니다.');
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

  /* ---------- QR로 들어온 화면 (로그인 없음) ---------- */
  function visitorPage(app, id, code) {
    app.innerHTML = `<header class="top"><h1>안전작업허가서 서명</h1></header><main class="sgv" id="sgv"><div class="card empty">불러오는 중…</div></main>`;
    const v = app.querySelector('#sgv');
    let info = null;
    const closed = msg => {
      v.innerHTML = `<div class="card sg-closed"><div class="sg-big">🔒</div><h2>서명 받기가 닫혀 있습니다</h2><p class="muted">${esc(msg)}</p></div>`;
    };
    async function loadInfo() {
      try { info = await window.api('signInfo', id, code); drawPick(); }
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
      const slots = slotsFor(info.types);
      const groups = [...new Set(slots.map(s => s.group))];
      v.innerHTML = `${summary()}
        <div class="card">
          <h2>서명할 칸을 고르세요</h2>
          <p class="hint">본인의 역할을 누르면 이름을 입력하고 서명할 수 있습니다. 이미 서명된 칸은 고를 수 없습니다.</p>
          ${groups.map(gname => `<div class="sg-grp">${esc(gname)}</div>
            <div class="sg-pick">${slots.filter(s => s.group === gname).map(s => info.signed[s.id]
              ? `<button class="sg-slot done" disabled><span>${esc(s.label)}</span><small>✓ 서명 완료</small></button>`
              : `<button class="sg-slot" data-slot="${esc(s.id)}"><span>${esc(s.label)}</span><small>서명하기 ›</small></button>`).join('')}</div>`).join('')}
        </div>`;
      v.querySelectorAll('[data-slot]').forEach(b => { b.onclick = () => drawSign(slots.find(s => s.id === b.dataset.slot)); });
    }
    function drawSign(slot) {
      v.innerHTML = `${summary()}
        <div class="card sg-step">
          <div class="sg-who-top"><button class="link" id="sgBack">‹ 칸 다시 고르기</button></div>
          <h2>${esc(slot.label)}</h2>
          <div id="sgFlow"></div>
        </div>`;
      v.querySelector('#sgBack').onclick = drawPick;
      signFlow(v.querySelector('#sgFlow'), {
        submit: async (name, png) => {
          try { await window.api('signSubmit', id, code, slot.id, name, png); }
          catch (e) { if (/닫혀/.test(errMsg(e))) return closed(errMsg(e)); throw e; }
          v.innerHTML = `<div class="card sg-closed"><div class="sg-big">✅</div><h2>서명이 저장되었습니다</h2>
            <p><b>${esc(slot.label)}</b> · ${esc(name)}</p>
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
