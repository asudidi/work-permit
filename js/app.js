/* 안전작업허가서 작성 시스템 — 화면 (가입/로그인, 대장, 작성, 미리보기·인쇄, 가입 관리) */
(function () {
  'use strict';
  const K = window.Kit;
  const { TYPES, typeById, esc, nl, today, STATUSES, setPath, getPath, fillGasTimes, blankDraft, rememberPeople,
    ensureSheet, normalize, copyOf, recNo, linkedOn, fmtWorkTime } = K;
  const ROLES = ['일반', '관리자'];
  const app = document.getElementById('app');
  let TOKEN = null, ME = null, LIST = [], USERS = [];

  /* ---------- 공통 ---------- */
  function toast(msg) {
    const t = document.getElementById('toast');
    t.textContent = msg; t.style.display = 'block';
    clearTimeout(t._h); t._h = setTimeout(() => { t.style.display = 'none'; }, 3500);
  }
  function saveToken(t) { try { t ? localStorage.setItem('wp_token', t) : localStorage.removeItem('wp_token'); } catch (e) { /* 무시 */ } }
  function loadToken() { try { return localStorage.getItem('wp_token'); } catch (e) { return null; } }
  function fail(e) {
    const msg = (e && e.message) ? e.message : String(e);
    if (msg.indexOf('로그인이 만료') >= 0) { saveToken(null); TOKEN = null; ME = null; toast(msg); renderAuth('login'); return; }
    toast(msg);
  }
  const busy = (btn, on) => { if (btn) btn.disabled = on; };
  const badge = s => `<span class="badge b-${esc(s)}">${esc(s)}</span>`;
  const typeBadges = ids => String(ids || '').split(',').filter(Boolean).map(id => { const t = typeById(id); return t ? `<span class="badge" style="--c:${t.color}">${esc(t.short)}</span>` : ''; }).join('');
  const go = h => { if (location.hash === h) route(); else location.hash = h; };
  const isAdmin = () => ME && ME.role === '관리자';

  /* ---------- 가입 / 로그인 ---------- */
  function renderAuth(mode) {
    const name = esc((window.CONFIG || {}).SITE_NAME || '안전작업허가서 작성 시스템');
    if (mode === 'login') {
      app.innerHTML = `
        <header class="top"><h1>${name}</h1></header>
        <div class="card auth">
          <h2 style="font-size:18px">로그인</h2>
          <p class="muted" style="margin:0">승인된 사용자만 이용할 수 있습니다.</p>
          <label class="fld">아이디<input id="lid" autocomplete="username"></label>
          <label class="fld">비밀번호<input id="lpw" type="password" autocomplete="current-password"></label>
          <button class="btn full" id="lbtn">로그인</button>
          <p class="muted" style="text-align:center;margin-top:14px">계정이 없으신가요? <button class="link" id="toReg">가입 신청</button></p>
        </div>`;
      const lid = document.getElementById('lid'), lpw = document.getElementById('lpw');
      const doLogin = () => {
        const b = document.getElementById('lbtn'); busy(b, true);
        api('login', lid.value, lpw.value)
          .then(r => { TOKEN = r.token; ME = r.user; saveToken(TOKEN); go('#/list'); })
          .catch(fail).finally(() => busy(b, false));
      };
      document.getElementById('lbtn').onclick = doLogin;
      lpw.onkeydown = e => { if (e.key === 'Enter') doLogin(); };
      document.getElementById('toReg').onclick = () => renderAuth('register');
    } else {
      app.innerHTML = `
        <header class="top"><h1>${name}</h1></header>
        <div class="card auth">
          <h2 style="font-size:18px">가입 신청</h2>
          <p class="muted" style="margin:0">관리자 승인 후 로그인할 수 있습니다.</p>
          <label class="fld">소속 (부서 또는 업체명)<input id="rdept"></label>
          <label class="fld">이름<input id="rname"></label>
          <label class="fld">아이디 (영문·숫자 4~20자)<input id="rid" autocomplete="username"></label>
          <label class="fld">비밀번호 (8자 이상)<input id="rpw" type="password" autocomplete="new-password"></label>
          <label class="fld">비밀번호 확인<input id="rpw2" type="password" autocomplete="new-password"></label>
          <button class="btn full" id="rbtn">가입 신청</button>
          <p class="muted" style="text-align:center;margin-top:14px"><button class="link" id="toLogin">로그인으로 돌아가기</button></p>
        </div>`;
      const $ = id => document.getElementById(id);
      $('rbtn').onclick = () => {
        if ($('rpw').value !== $('rpw2').value) return toast('비밀번호 확인이 일치하지 않습니다.');
        const b = $('rbtn'); busy(b, true);
        api('register', { dept: $('rdept').value, name: $('rname').value, userId: $('rid').value, password: $('rpw').value })
          .then(msg => { toast(msg); renderAuth('login'); })
          .catch(fail).finally(() => busy(b, false));
      };
      document.getElementById('toLogin').onclick = () => renderAuth('login');
    }
  }

  /* ---------- 공통 레이아웃 ---------- */
  function shell(active) {
    const tabs = [['list', '허가서 대장'], ['new', '새 허가서'], ...(isAdmin() ? [['users', '가입 관리']] : [])];
    app.innerHTML = `
      <header class="top">
        <h1>${esc((window.CONFIG || {}).SITE_NAME || '안전작업허가서 작성 시스템')}</h1>
        <span class="me">${esc(ME.dept)} ${esc(ME.name)} · ${esc(ME.role)}</span>
        <button class="btn sm ghost" id="outBtn" style="background:transparent;color:#fff;border-color:#fff">로그아웃</button>
      </header>
      <nav class="tabs">${tabs.map(([k, t]) => `<button data-tab="${k}" class="${active === k ? 'on' : ''}">${t}</button>`).join('')}</nav>
      <main id="view"></main>`;
    app.querySelectorAll('nav button').forEach(b => { b.onclick = () => go('#/' + b.dataset.tab); });
    document.getElementById('outBtn').onclick = () => {
      api('logout', TOKEN).catch(() => {}); saveToken(null); TOKEN = null; ME = null; location.hash = ''; renderAuth('login');
    };
    return document.getElementById('view');
  }

  /* ---------- 허가서 대장 ---------- */
  function viewList() {
    const v = shell('list');
    v.innerHTML = '<div class="card empty">불러오는 중…</div>';
    api('listPermits', TOKEN).then(rows => { LIST = rows; drawList(v); }).catch(e => { fail(e); v.innerHTML = ''; });
  }
  function drawList(v) {
    v.innerHTML = `
      <div class="page-head"><h1>허가서 대장</h1><div class="actions"><a class="btn" href="#/new">＋ 새 허가서</a></div></div>
      <div class="filters">
        <select id="fStatus"><option value="">전체 상태</option>${STATUSES.map(s => `<option>${s}</option>`).join('')}</select>
        <select id="fType"><option value="">전체 허가서 종류</option>${TYPES.map(t => `<option value="${t.id}">${esc(t.name)}</option>`).join('')}</select>
        <input id="fText" placeholder="번호·공사명·장소·장치·작성자 검색">
      </div>
      <div class="card" style="padding:0;overflow-x:auto"><table>
        <thead><tr><th>발행번호</th><th>상태</th><th>종류</th><th>공사명 / 장소</th><th class="hide-m">작업일</th><th class="hide-m">작성자</th></tr></thead>
        <tbody id="tb"></tbody></table></div>`;
    const fStatus = document.getElementById('fStatus'), fType = document.getElementById('fType'), fText = document.getElementById('fText');
    const draw = () => {
      const s = fStatus.value, t = fType.value, q = fText.value.trim().toLowerCase();
      const rows = LIST.filter(p => (!s || p.status === s) && (!t || String(p.types).split(',').includes(t)) &&
        (!q || [p.permitNo, p.title, p.area, p.equipName, p.authorName, p.authorDept].join(' ').toLowerCase().indexOf(q) >= 0));
      document.getElementById('tb').innerHTML = rows.length ? rows.map(p => `
        <tr class="click" data-id="${esc(p.id)}">
          <td>${esc(p.permitNo) || '<span class="muted">(수기)</span>'}</td><td>${badge(p.status)}</td><td>${typeBadges(p.types)}</td>
          <td>${esc(p.title || p.equipName)}<div class="muted small">${esc(p.area)}</div></td>
          <td class="hide-m">${esc(p.workDate)}</td><td class="hide-m">${esc(p.authorDept)} ${esc(p.authorName)}</td></tr>`).join('')
        : '<tr><td colspan="6" class="empty">해당하는 허가서가 없습니다.</td></tr>';
      document.querySelectorAll('#tb tr.click').forEach(r => { r.onclick = () => go('#/view/' + r.dataset.id); });
    };
    [fStatus, fType].forEach(el => { el.onchange = draw; });
    fText.oninput = draw;
    draw();
  }

  /* ---------- 작성 / 수정 ---------- */
  function viewForm(id) {
    const v = shell('new');
    if (!id) return renderForm(v, blankDraft(), 'new');
    v.innerHTML = '<div class="card empty">불러오는 중…</div>';
    api('getPermit', TOKEN, id).then(r => renderForm(v, normalize(r), 'edit')).catch(e => { fail(e); v.innerHTML = ''; });
  }

  function renderForm(view, d, mode) {
    const field = (label, path, opts = {}) => {
      const val = getPath(d, path) || '';
      const ctl = opts.options
        ? `<select data-bind="${path}">${opts.options.map(o => `<option ${o === val ? 'selected' : ''}>${esc(o)}</option>`).join('')}${val && !opts.options.includes(val) ? `<option selected>${esc(val)}</option>` : ''}</select>`
        : opts.textarea
        ? `<textarea data-bind="${path}" rows="${opts.rows || 3}" placeholder="${esc(opts.ph || '')}">${esc(val)}</textarea>`
        : `<input type="${opts.type || 'text'}" ${opts.step ? `step="${opts.step}"` : ''} data-bind="${path}" value="${esc(val)}" placeholder="${esc(opts.ph || '')}" ${opts.list ? `list="${opts.list}"` : ''} ${opts.ro ? 'readonly' : ''}>`;
      return `<label class="fld ${opts.cls || ''}"><span>${label}${opts.req ? ' <em>*</em>' : ''}</span>${ctl}</label>`;
    };
    const dateField = (label, path) => `
      <div class="fld"><span>${label} <button type="button" class="link" data-today="${path}">오늘</button> <button type="button" class="link" data-clear="${path}">비우기</button></span>
        <input type="date" data-bind="${path}" value="${esc(getPath(d, path) || '')}"></div>`;
    const person = (role, label) => `
      <div class="person"><strong>${label}</strong>
        <div class="grid3">${['dept', 'title', 'name'].map((f, i) => field(['부서', '직책', '성명'][i], `${role}.${f}`)).join('')}</div></div>`;

    view.innerHTML = `
      <div class="page-head">
        <div><h1>${mode === 'edit' ? '허가서 수정' : '새 안전작업허가서'}</h1>
          <div class="muted small">함께 고른 허가서는 모두 같은 발행번호로 발행됩니다. 이름만 입력하고 (인)은 출력 후 종이에 서명합니다.</div></div>
        <div class="actions">
          <a class="btn ghost" href="${mode === 'edit' ? '#/view/' + esc(d.id) : '#/list'}">취소</a>
          <button class="btn" data-save>저장</button>
        </div>
      </div>

      <section class="card">
        <h2><span class="step">1</span>허가서 종류</h2>
        <p class="hint">함께 발행할 허가서를 모두 고르세요. 각 허가서의 「보충/관련 작업 허가서」 칸에 서로 자동 체크됩니다.</p>
        <div class="chips">${TYPES.map(t => `
          <label class="chip" style="--c:${t.color}"><input type="checkbox" data-type="${t.id}" ${d.types.includes(t.id) ? 'checked' : ''}><span>${esc(t.name)}</span></label>`).join('')}
        </div>
      </section>

      <section class="card">
        <h2><span class="step">2</span>작업 정보</h2>
        <div class="grid2">${field('공사명 (대장 표시용)', 'title', { ph: '예) 제어동 항온항습기 교체 공사', cls: 'span2' })}</div>
        <div class="grid4">
          <div class="fld"><span>발행번호</span>
            <select data-nomode>
              <option value="auto" ${d.noMode === 'auto' ? 'selected' : ''}>자동 부여</option>
              <option value="manual" ${d.noMode === 'manual' ? 'selected' : ''}>직접 입력</option>
              <option value="blank" ${d.noMode === 'blank' ? 'selected' : ''}>빈칸 (종이에 수기)</option>
            </select></div>
          <label class="fld"><span>&nbsp;</span><input data-bind="no" value="${esc(d.no || '')}" ${d.noMode === 'manual' ? '' : 'readonly'}
            placeholder="${d.noMode === 'auto' ? '저장 시 자동 부여' : d.noMode === 'blank' ? '인쇄물에 빈칸' : '예) 2026-015'}"></label>
          ${dateField('발행일자', 'issueDate')}
          <div></div>
          ${dateField('작업일자', 'workDate')}
          ${field('시작 시간', 'timeFrom', { type: 'time', step: 300 })}
          ${field('종료 시간', 'timeTo', { type: 'time', step: 300 })}
        </div>
        <p class="hint">비워 둔 날짜·시간·번호는 인쇄물에 빈칸으로 나와 손으로 적을 수 있습니다.</p>
        <div class="grid3">
          ${field('작업지역', 'area', { ph: '예) 제어동 공조기실', req: true })}
          ${field('장치번호', 'equipNo', { ph: '예) 354-M-HV-103A/B' })}
          ${field('장치명', 'equipName', { ph: '예) 항온항습기' })}
        </div>
        ${field('작업개요', 'summary', { textarea: true, rows: 2, ph: '예) 기존 항온항습기 철거 및 신규 항온항습기 설치', req: true })}
      </section>

      <section class="card">
        <h2><span class="step">3</span>신청인 · 발급자 · 승인자 <small class="muted">이름 입력 (인은 종이 서명)</small></h2>
        <div class="grid3">${person('applicant', '신청인')}${person('issuer', '발급자')}${person('approver', '승인자')}</div>
      </section>

      <section class="card">
        <h2><span class="step">4</span>작업 인원 · 확인자 <small class="muted">비워두면 출력 후 현장에서 수기 작성</small></h2>
        <div class="grid4">
          ${field('작업업체', 'contractor', { ph: '공사업체' })}
          ${field('작업자 (작업 책임자)', 'worker', { ph: '업체 담당자' })}
          ${field('감독자', 'supervisor', { ph: '공무팀 담당자' })}
          ${field('입회자', 'witness', { ph: '안전관리자 또는 운영팀 직원' })}
        </div>
        <div class="grid4">
          ${field('운영근무자 (작업 완료 확인)', 'names.done_ops')}
          ${field('공사담당자 (허가 연장확인)', 'names.ext')}
          ${field('관련부서 협조자 — 부서', 'names.coop_dept')}
          ${field('관련부서 협조자 — 직책', 'names.coop_title')}
          ${field('관련부서 협조자 — 성명', 'names.coop')}
        </div>
      </section>

      <div id="sheetCards"></div>
      <div class="form-foot"><button class="btn big" data-save>저장</button></div>`;

    const cards = view.querySelector('#sheetCards');
    const chk = (bind, on, label) => `<label class="check"><input type="checkbox" data-bind="${bind}" ${on ? 'checked' : ''}><span>${esc(label)}</span></label>`;

    function drawSheets() {
      if (!d.types.length) { cards.innerHTML = '<section class="card empty">위 1번에서 허가서 종류를 고르면 종류별 입력 항목이 여기에 나타납니다.</section>'; return; }
      cards.innerHTML = TYPES.filter(t => d.types.includes(t.id)).map((t, i) => {
        const sh = d.sheets[t.id], base = `sheets.${t.id}`;
        const extras = (t.extraFields || []).filter(f => ['gasMeter', 'watcher', 'measurer'].indexOf(f.key) < 0)
          .map(f => field(f.label, `${base}.extra.${f.key}`, { textarea: f.type === 'textarea', rows: 3, ph: f.placeholder })).join('');
        const linked = t.linked.items.map(it => `
          <label class="check"><input type="checkbox" data-linked="${t.id}:${it.id}" ${linkedOn(d, sh, it.id) ? 'checked' : ''}><span>${esc(it.label)}</span></label>`).join('');
        const cols = t.checks.map((col, ci) => `
          <div>${col.title ? `<div class="check-title">${esc(col.title)}</div>` : ''}
            ${col.items.map((it, ii) => chk(`${base}.checks.${ci}-${ii}`, sh.checks[ci + '-' + ii], it)).join('')}</div>`).join('');
        const attach = t.sideBox === 'attachments' ? `
          <h3>첨부서류 <small class="muted">체크 → 인쇄 시 ■</small></h3>
          <div>${t.attachments.map((a, ai) => chk(`${base}.attach.${ai}`, sh.attach[ai], a)).join('')}</div>` : '';
        const gas = t.gas ? `
          <h3>산소·유해가스 측정 <small class="muted">측정값은 항상 빈칸으로 출력됩니다 (현장 수기)</small></h3>
          <div class="grid3">
            ${field('측정 기기명', `${base}.extra.gasMeter`, { options: (t.extraFields.find(f => f.key === 'gasMeter') || {}).options })}
            ${field(t.watcherLabel, `${base}.extra.watcher`)}
            ${field('측정인', `${base}.extra.measurer`)}
          </div>
          <div class="gas-row">
            ${[0, 1, 2, 3].map(n => field(`${n + 1}차 측정시간`, `${base}.gasTimes.${n}`, { type: 'time', step: 300 })).join('')}
            <button type="button" class="btn ghost sm" data-gasfill="${t.id}">⏱ 2시간 간격 자동 채우기</button>
          </div>
          <p class="hint">측정시간을 비워 두면 인쇄물에 빈칸으로 나옵니다. 1차 시간을 고르고 [자동 채우기]를 누르면 2시간 간격으로 채워지며, 점심시간에 걸리면 재작업 시각으로 맞춥니다.</p>` : '';
        const typeNames = t.id === 'power' ? `
          <h3>정전작업 확인자 이름 <small class="muted">작업 부서 담당자는 감독자 이름이 자동으로 들어갑니다</small></h3>
          <div class="grid2">${field('운전 부서 담당자', 'names.cutoff_ops')}${field('전원 복구 요청자', 'names.power_restore')}</div>` : t.id === 'excavation' ? `
          <h3>관련설비별 확인자 이름</h3>
          <div class="grid2">${t.checks[0].items.map((it, ii) => field(esc(it.split(':')[0].trim()) + ' 확인자', `names.c${ii}`)).join('')}</div>` : '';
        return `
          <section class="card sheet-card" style="--c:${t.color}">
            <h2><span class="step">${5 + i}</span>${esc(t.name)}</h2>
            ${extras ? `<div class="grid2">${extras}</div>` : ''}
            <h3>${esc(t.linked.label)} <small class="muted">체크 → 인쇄 시 ■</small></h3>
            <div>${linked}</div>
            <h3>${esc(t.checksLabel || '안전조치 요구사항')} <small class="muted">체크 → 인쇄 시 ☒ (○ 확인란은 현장에서 ∨ 표시)</small>
              <button type="button" class="link" data-allchk="${t.id}">전체 선택/해제</button></h3>
            <div class="checks">${cols}</div>
            <h3>기타 특별 요구사항</h3>
            <textarea data-bind="${base}.special" rows="4">${esc(sh.special)}</textarea>
            ${attach}${gas}${typeNames}
          </section>`;
      }).join('');
    }
    drawSheets();

    view.addEventListener('input', e => {
      const p = e.target.dataset.bind;
      if (p && e.target.type !== 'checkbox') setPath(d, p, e.target.value);
    });
    view.addEventListener('change', e => {
      const el = e.target;
      if (el.dataset.bind && el.type === 'checkbox') setPath(d, el.dataset.bind, el.checked);
      if (el.dataset.bind && el.tagName === 'SELECT') setPath(d, el.dataset.bind, el.value);
      if (el.dataset.linked) { const [tid, lid] = el.dataset.linked.split(':'); d.sheets[tid].linked[lid] = el.checked; }
      if ('nomode' in el.dataset) {
        d.noMode = el.value;
        const inp = view.querySelector('[data-bind="no"]');
        if (d.noMode === 'blank') d.no = '';
        inp.value = d.no || ''; inp.readOnly = d.noMode !== 'manual';
        inp.placeholder = d.noMode === 'auto' ? '저장 시 자동 부여' : d.noMode === 'blank' ? '인쇄물에 빈칸' : '예) 2026-015';
        if (d.noMode === 'manual') inp.focus();
      }
      if (el.dataset.type) {
        const tid = el.dataset.type;
        if (el.checked) { if (!d.types.includes(tid)) d.types.push(tid); ensureSheet(d, tid); }
        else d.types = d.types.filter(x => x !== tid);
        d.types.sort((a, b) => TYPES.findIndex(t => t.id === a) - TYPES.findIndex(t => t.id === b));
        drawSheets();
      }
    });
    view.addEventListener('click', e => {
      const dt = e.target.closest('[data-today],[data-clear]');
      if (dt) {
        const path = dt.dataset.today || dt.dataset.clear;
        const val = dt.dataset.today ? today() : '';
        setPath(d, path, val); view.querySelector(`input[data-bind="${path}"]`).value = val;
        return;
      }
      const gf = e.target.closest('[data-gasfill]');
      if (gf) {
        const sh = d.sheets[gf.dataset.gasfill];
        try {
          if (sh.gasTimes.slice(1).some(Boolean) && !confirm('2~4차 측정시간을 새로 채울까요?')) return;
          sh.gasTimes = fillGasTimes(sh.gasTimes);
          sh.gasTimes.forEach((val, n) => {
            const inp = view.querySelector(`[data-bind="sheets.${gf.dataset.gasfill}.gasTimes.${n}"]`);
            if (inp) inp.value = val;
          });
        } catch (err) { alert(err.message); }
        return;
      }
      const all = e.target.closest('[data-allchk]');
      if (all) {
        const boxes = [...view.querySelectorAll(`[data-bind^="sheets.${all.dataset.allchk}.checks."]`)];
        const on = !boxes.every(b => b.checked);
        boxes.forEach(b => { b.checked = on; setPath(d, b.dataset.bind, on); });
        return;
      }
      const sv = e.target.closest('[data-save]');
      if (sv) save(sv);
    });

    function save() {
      const errs = [];
      if (!d.types.length) errs.push('허가서 종류를 하나 이상 고르세요.');
      if (d.noMode === 'manual' && !(d.no || '').trim()) errs.push('발행번호를 입력하세요. (비워서 인쇄하려면 「빈칸」을 고르세요)');
      if (!d.area && !d.equipName) errs.push('작업지역 또는 장치명을 입력하세요.');
      if (!d.summary && !d.title) errs.push('공사명 또는 작업개요를 입력하세요.');
      if (errs.length) { alert(errs.join('\n')); return; }
      Object.keys(d.sheets).forEach(k => { if (!d.types.includes(k)) delete d.sheets[k]; });
      const btns = view.querySelectorAll('[data-save]'); btns.forEach(b => busy(b, true));
      api('savePermit', TOKEN, d)
        .then(r => { rememberPeople(d); toast('저장했습니다.'); go('#/view/' + r.id); })
        .catch(fail).finally(() => btns.forEach(b => busy(b, false)));
    }
  }

  /* ---------- 미리보기 · 인쇄 ---------- */
  function viewPermit(id) {
    const v = shell('list');
    v.innerHTML = '<div class="card empty">불러오는 중…</div>';
    api('getPermit', TOKEN, id).then(r => drawPermit(v, normalize(r))).catch(e => { fail(e); v.innerHTML = ''; });
  }
  function drawPermit(v, r) {
    const canEdit = isAdmin() || r.authorId === ME.userId;
    const types = TYPES.filter(t => r.types.includes(t.id));
    const ctx = { esc, nl, linkedOn, recNo, unapproved: false };
    v.innerHTML = `
      <div class="no-print">
        <div class="page-head">
          <div><h1>${esc(recNo(r)) || '(번호 수기)'} ${badge(r.status)}</h1>
            <div class="muted small">${esc(r.title || r.summary)} · 작성 ${esc(r.authorDept)} ${esc(r.authorName)} · 작업 ${esc(fmtWorkTime(r))}</div></div>
          <div class="actions">
            <a class="btn ghost" href="#/list">목록</a>
            <button class="btn" id="pBtn">🖨 인쇄</button>
            ${canEdit ? `<a class="btn ghost" href="#/edit/${esc(r.id)}">수정</a>` : ''}
            <button class="btn ghost" id="cpBtn">복사해서 새로 작성</button>
            ${canEdit ? '<button class="btn bad" id="delBtn">삭제</button>' : ''}
          </div>
        </div>
        <div class="card">
          <div class="pick"><b>인쇄할 장</b>
            ${types.map(t => `<label class="check" style="margin:0"><input type="checkbox" data-pick="${t.id}" checked><span>${esc(t.name)}</span></label>`).join('')}
          </div>
          ${canEdit ? `<div class="pick" style="margin-top:10px"><b>상태</b>
            <select id="stSel" style="width:auto">${STATUSES.map(s => `<option ${s === r.status ? 'selected' : ''}>${s}</option>`).join('')}</select>
            <button class="btn ghost sm" id="stBtn">상태 변경</button></div>` : ''}
          <p class="hint" style="margin-bottom:0">인쇄 창에서 용지 A4, 배율 100%(또는 '실제 크기'), 여백 '없음', '배경 그래픽' 사용을 확인하세요.</p>
        </div>
      </div>
      <div class="sheets">${types.map(t => `<div class="sheet-wrap" data-sheet="${t.id}">${
        window.PermitFormLayout.render(r, t, ctx) || `<article class="sheet"><p>「${esc(t.name)}」 양식 위치표가 없습니다.</p></article>`}</div>`).join('')}</div>`;
    window.PrintKit.fitPdfText(v);
    const refresh = () => {
      let first = true;
      v.querySelectorAll('.sheet-wrap').forEach(w => {
        const on = v.querySelector(`[data-pick="${w.dataset.sheet}"]`).checked;
        w.classList.toggle('skip', !on); w.classList.toggle('first', on && first); if (on) first = false;
      });
    };
    v.querySelectorAll('[data-pick]').forEach(c => { c.onchange = refresh; });
    refresh();
    document.getElementById('pBtn').onclick = () => window.print();
    document.getElementById('cpBtn').onclick = () => { window.__copyDraft = copyOf(r); go('#/new'); };
    const del = document.getElementById('delBtn');
    if (del) del.onclick = () => {
      if (!confirm('이 허가서를 삭제할까요? 되돌릴 수 없습니다.')) return;
      busy(del, true);
      api('deletePermit', TOKEN, r.id).then(() => { toast('삭제했습니다.'); go('#/list'); }).catch(fail).finally(() => busy(del, false));
    };
    const st = document.getElementById('stBtn');
    if (st) st.onclick = () => {
      busy(st, true);
      api('setPermitStatus', TOKEN, r.id, document.getElementById('stSel').value)
        .then(() => { toast('상태를 변경했습니다.'); viewPermit(r.id); }).catch(fail).finally(() => busy(st, false));
    };
  }

  /* ---------- 가입 관리 (관리자) ---------- */
  function viewUsers() {
    const v = shell('users');
    v.innerHTML = '<div class="card empty">불러오는 중…</div>';
    api('listUsers', TOKEN).then(rows => { USERS = rows; drawUsers(v); }).catch(e => { fail(e); v.innerHTML = ''; });
  }
  function drawUsers(v) {
    const pending = USERS.filter(u => u.status === '대기');
    const others = USERS.filter(u => u.status !== '대기');
    const roleSel = u => `<select data-role="${esc(u.userId)}" style="width:auto;padding:5px">${ROLES.map(r => `<option ${r === u.role ? 'selected' : ''}>${r}</option>`).join('')}</select>`;
    v.innerHTML = `
      <div class="page-head"><h1>가입 관리</h1></div>
      <div class="card" style="padding:0;overflow-x:auto">
        <div style="padding:12px 12px 0"><b>가입 신청 대기 (${pending.length})</b></div>
        <table><thead><tr><th>소속</th><th>이름</th><th class="hide-m">아이디</th><th class="hide-m">신청일시</th><th>권한</th><th>처리</th></tr></thead><tbody>
        ${pending.length ? pending.map(u => `<tr>
          <td>${esc(u.dept)}</td><td>${esc(u.name)}</td><td class="hide-m">${esc(u.userId)}</td><td class="hide-m">${esc(u.createdAt)}</td>
          <td>${roleSel(u)}</td>
          <td style="white-space:nowrap"><button class="btn sm ok" data-act="승인" data-id="${esc(u.userId)}">승인</button>
            <button class="btn sm bad" data-act="반려" data-id="${esc(u.userId)}">반려</button></td></tr>`).join('')
          : '<tr><td colspan="6" class="empty">대기 중인 신청이 없습니다.</td></tr>'}
        </tbody></table></div>
      <div class="card" style="padding:0;overflow-x:auto">
        <div style="padding:12px 12px 0"><b>등록 사용자</b></div>
        <table><thead><tr><th>소속</th><th>이름</th><th>상태</th><th>권한</th><th>처리</th></tr></thead><tbody>
        ${others.map(u => `<tr>
          <td>${esc(u.dept)}</td><td>${esc(u.name)}</td><td>${badge(u.status)}</td>
          <td>${u.userId === ME.userId ? esc(u.role) + ' (본인)' : roleSel(u)}</td>
          <td style="white-space:nowrap">${u.userId === ME.userId ? '' :
            u.status === '승인' ? `<button class="btn sm ghost" data-act="저장" data-id="${esc(u.userId)}">권한 저장</button>
                                    <button class="btn sm bad" data-act="반려" data-id="${esc(u.userId)}">사용 중지</button>`
                                : `<button class="btn sm ok" data-act="승인" data-id="${esc(u.userId)}">재승인</button>`}</td></tr>`).join('')}
        </tbody></table></div>
      <p class="muted">· 일반: 허가서 작성·조회·인쇄 · 관리자: 허가서 전체 수정/삭제 + 가입 관리</p>`;
    v.querySelectorAll('button[data-act]').forEach(b => {
      b.onclick = () => {
        const uid = b.dataset.id, act = b.dataset.act;
        const sel = v.querySelector(`select[data-role="${CSS.escape(uid)}"]`);
        busy(b, true);
        api('decideUser', TOKEN, uid, act === '저장' ? '승인' : act, sel ? sel.value : '')
          .then(() => { toast('처리되었습니다.'); viewUsers(); }).catch(fail).finally(() => busy(b, false));
      };
    });
  }

  /* ---------- 라우터 ---------- */
  function route() {
    if (!TOKEN || !ME) return renderAuth('login');
    const h = (location.hash || '#/list').replace(/^#\/?/, '');
    const [page, arg] = h.split('/');
    if (page === 'new') {
      const v = shell('new');
      const draft = window.__copyDraft || blankDraft(); window.__copyDraft = null;
      return renderForm(v, draft, 'new');
    }
    if (page === 'edit' && arg) return viewForm(arg);
    if (page === 'view' && arg) return viewPermit(arg);
    if (page === 'users' && isAdmin()) return viewUsers();
    return viewList();
  }
  window.addEventListener('hashchange', route);

  /* ---------- 시작 ---------- */
  (function init() {
    const t = loadToken();
    if (!t) return renderAuth('login');
    app.innerHTML = '<div class="card auth empty">접속 중…</div>';
    api('getMe', t).then(u => { TOKEN = t; ME = u; route(); })
      .catch(e => { saveToken(null); renderAuth('login'); if (e && e.message && e.message.indexOf('서버') >= 0) toast(e.message); });
  })();
})();
