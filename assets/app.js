/* HeteroHealthAgent — UI logic (v2, bilingual 中/EN)
 * 视图：总览 / 证据与趋势 / 缺失与时效 / 新数据分析(ingest pipeline) / 反事实 / 机器人与边界
 * 语言：静态文案走 assets/i18n.js 的 data-i18n 字典；动态文案用 L(zh,en)；
 *       数据层字段取 *En 后缀（见 data.js）。选择持久化在 localStorage。 */
(function () {
  const { CASE_001, SYSTEMS, engine: E } = window.HHA;
  const DICT = window.HHA_I18N;
  const data = structuredClone(CASE_001);   // 可变副本：counterfactual 开关 + 新读数接入
  const $ = (id) => document.getElementById(id);
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const RING_C = 339.29;
  let lastToggled = null;

  /* ================= 语言 ================= */
  let LANG = localStorage.getItem('hha-lang') || 'zh';
  const L = (zh, en) => (LANG === 'zh' ? zh : en);
  const T = (k) => (DICT[LANG] && DICT[LANG][k]) ?? DICT.zh[k] ?? k;
  const mName = (m) => (LANG === 'zh' ? m.name : (m.nameEn || m.name));
  const mLabel = (m) => (LANG === 'zh' ? m.label : (m.labelEn || m.label));
  const sysName = (s) => (LANG === 'zh' ? s.name : (s.nameEn || s.name));
  const lblText = (r) => (LANG === 'zh' ? r.text : r.en);

  function applyStatic() {
    document.title = T('title');
    document.documentElement.lang = LANG === 'zh' ? 'zh-CN' : 'en';
    document.querySelectorAll('[data-i18n]').forEach((el) => { el.textContent = T(el.dataset.i18n); });
    document.querySelectorAll('[data-i18n-html]').forEach((el) => { el.innerHTML = T(el.dataset.i18nHtml); });
    document.querySelectorAll('[data-i18n-ph]').forEach((el) => { el.placeholder = T(el.dataset.i18nPh); });
    document.querySelectorAll('#langSw button').forEach((b) => b.classList.toggle('active', b.dataset.lang === LANG));
  }
  function setLang(lang) {
    if (LANG === lang) return;
    LANG = lang;
    localStorage.setItem('hha-lang', lang);
    forceNext = false;
    applyStatic();
    renderAll();
    rebuildChips();
    resetChat();
    refreshIngestOptions();
  }

  const fmt = (v) => (v == null || v === '' ? '–' : (Number.isInteger(Number(v)) ? v : Number(v).toFixed(1)));
  const stName = (st) => ({ normal: L('正常', 'Normal'), attention: L('需关注', 'Attention'), mixed: L('混合', 'Mixed'), off: L('关闭', 'Off') }[st]);
  const ST_COLOR = { normal: '#35c46b', attention: '#e0a52b', mixed: '#a371f7', off: '#8a97a8' };

  function refText(m) {
    if (m.dir === 'cat') return L('阴性为正常', 'Negative is normal');
    if (m.dir === 'in') return L(`参考 ${m.lo}–${m.hi}${m.unit}`, `Ref ${m.lo}–${m.hi}${m.unit}`);
    if (m.dir === 'low') return L(`参考 ≤${m.hi}${m.unit}`, `Ref ≤${m.hi}${m.unit}`);
    return L(`参考 ≥${m.lo}${m.unit}`, `Ref ≥${m.lo}${m.unit}`);
  }
  function zTag(m) {
    const z = E.zScore(m);
    if (z == null) return '';
    const s = `${z > 0 ? '+' : ''}${z.toFixed(1)}σ`;
    return Math.abs(z) >= 1 ? `<i class="z hi">${s}</i>` : `<i class="z ok">${s}</i>`;
  }
  function citeOf(mod, m) {
    const z = E.zScore(m);
    const zs = z == null ? '' : L(`，个人基线 ${z > 0 ? '+' : ''}${z.toFixed(1)}σ`, `, personal baseline ${z > 0 ? '+' : ''}${z.toFixed(1)}σ`);
    return `${mName(mod)}·${mLabel(m)} ${fmt(m.value)}${m.unit}（${refText(m)}${zs}）`;
  }
  function snapshot(mods, missingCount) {
    return {
      risk: E.subHealthRisk(mods),
      comp: E.evidenceCompleteness(mods),
      conf: E.confidence(mods, missingCount),
      ready: E.readiness(mods),
      dev: E.personalDeviation(mods),
    };
  }
  function cur() { return snapshot(data.modalities, data.missing.length); }
  // 基线 = 全部模态开启（使用当前数值）
  function snapshotAllOn() {
    const saved = data.modalities.map((m) => m.available);
    data.modalities.forEach((m) => (m.available = true));
    const s = snapshot(data.modalities, data.missing.length);
    data.modalities.forEach((m, i) => (m.available = saved[i]));
    return s;
  }

  /* ================= 路由 ================= */
  function goto(view) {
    document.querySelectorAll('.nav a').forEach((x) => x.classList.toggle('active', x.dataset.view === view));
    document.querySelectorAll('.view').forEach((v) => v.classList.remove('active'));
    $(view).classList.add('active');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  document.querySelectorAll('.nav a').forEach((a) => {
    a.addEventListener('click', (e) => { e.preventDefault(); goto(a.dataset.view); });
  });
  // 事件委托：语言按钮 + 页内跳转（innerHTML 重建后依然有效）
  document.addEventListener('click', (e) => {
    const sw = e.target.closest('#langSw button');
    if (sw) { setLang(sw.dataset.lang); return; }
    const el = e.target.closest('[data-goto]');
    if (el) { e.preventDefault(); goto(el.dataset.goto); }
  });

  /* ================= 总览 ================= */
  function setRing(val, color) {
    const el = $('ringFill');
    el.style.strokeDashoffset = (RING_C * (1 - (val ?? 0) / 100)).toFixed(2);
    el.style.stroke = color;
  }
  function renderOverview() {
    $('ovSubject').textContent = `${LANG === 'zh' ? data.title : data.titleEn} · ${LANG === 'zh' ? data.subject : data.subjectEn}`;
    $('disclaimer').textContent =
      `⚠️ ${LANG === 'zh' ? data.disclaimer : data.disclaimerEn}${L('（PROTOTYPE：规则引擎驱动，不接真实模型；判断仅在证据充分时给出）', ' (PROTOTYPE: rule engine only, no real model; conclusions only when evidence suffices)')}`;
    const s = cur();
    const lbl = E.riskLabel(s.risk);
    setRing(s.ready, s.ready == null ? '#8a97a8' : s.ready >= 60 ? '#35c46b' : s.ready >= 40 ? '#e0a52b' : '#f2544b');
    $('ringVal').textContent = s.ready ?? '–';
    $('riskPill').textContent = lblText(lbl);
    $('riskPill').className = 'risk-pill risk-' + lbl.level;
    $('ringNote').textContent =
      L(`Readiness = (100 − 亚健康倾向) × 0.7 + 证据完整度 × 0.3。当前完整度 ${s.comp}%，结构性缺失 ${data.missing.length} 项。`,
        `Readiness = (100 − sub-health tendency) × 0.7 + evidence completeness × 0.3. Completeness ${s.comp}%, structural gaps ${data.missing.length}.`);
    $('statReady').textContent = s.ready ?? '–';
    $('statRisk').textContent = s.risk ?? '–';
    $('statRiskLbl').textContent = lblText(lbl);
    $('statComp').textContent = (s.comp ?? '–') + '%';
    $('statConf').textContent = (s.conf ?? '–') + '%';
    $('statDev').textContent = s.dev ?? '–';
    renderInsights();
    renderSystems();
  }
  function renderInsights() {
    const out = [];
    const mods = data.modalities.filter((m) => m.available);
    const devs = [];
    mods.forEach((mod) => mod.metrics.forEach((mm) => {
      const z = E.zScore(mm);
      if (z != null && E.deviatesWorse(mm)) devs.push({ mod, mm, z });
    }));
    devs.sort((a, b) => Math.abs(b.z) - Math.abs(a.z));
    if (devs[0]) {
      const d = devs[0];
      const w = d.mm.dir === 'high' ? L('低于', 'below') : d.mm.dir === 'low' ? L('高于', 'above') : L('偏离', 'off');
      out.push(['📌',
        L(`${mLabel(d.mm)} 较个人基线${w} ${Math.abs(d.z).toFixed(1)}σ`, `${mLabel(d.mm)} is ${Math.abs(d.z).toFixed(1)}σ ${w} personal baseline`),
        L(`${mName(d.mod)} · 当前 ${fmt(d.mm.value)}${d.mm.unit}，基线 ${d.mm.mean}${d.mm.unit}±${d.mm.std} · 共 ${devs.length} 项指标偏离基线`,
          `${mName(d.mod)} · current ${fmt(d.mm.value)}${d.mm.unit}, baseline ${d.mm.mean}${d.mm.unit}±${d.mm.std} · ${devs.length} metrics off baseline`)]);
    }
    const stale = data.modalities.find((m) => m.available && E.isStale(m));
    if (stale) out.push(['⏳',
      L(`${mName(stale)} 数据已 ${stale.freshnessDays} 天未更新`, `${mName(stale)}: no update for ${stale.freshnessDays} days`),
      L(`该模态通常每 ${stale.typicalPeriodDays} 天采样，证据可能过期（STALE） · 建议复测后再更新结论`,
        `Usually sampled every ${stale.typicalPeriodDays} days — evidence may be stale · Retest recommended before updating conclusions`)]);
    data.missing.forEach((mi) => out.push(['🕳️',
      L(`${mi.label} 缺失`, `${mi.labelEn || mi.label} missing`),
      L(`${mi.reason} · ${mi.impact}`, `${mi.reasonEn || mi.reason} · ${mi.impactEn || mi.impact}`)]));
    const pos = [];
    mods.forEach((mod) => mod.metrics.forEach((mm) => { if (E.metricStatus(mm) === 'normal') pos.push(`${mLabel(mm)} ${fmt(mm.value)}${mm.unit}`); }));
    if (pos.length) out.push(['✅',
      L(`${pos.length} 项指标处于参考范围`, `${pos.length} metrics within reference range`),
      pos.slice(0, 4).join(' · ') + (pos.length > 4 ? ' …' : '')]);
    const attr = E.attribution(data.modalities);
    if (attr[0]) out.push(['🧭',
      L(`当前判断主要由「${attr[0].name}」驱动（贡献 ${attr[0].pct}%）`, `Current assessment is mainly driven by "${attr[0].nameEn}" (${attr[0].pct}% contribution)`),
      attr.slice(0, 3).map((a) => `${a.icon} ${LANG === 'zh' ? a.name : a.nameEn} ${a.pct}%`).join(' · ')]);

    $('insightsFeed').innerHTML = out.map(([ic, t, meta]) =>
      `<div class="insight"><div class="ic">${ic}</div><div class="bd"><b>${t}</b><div class="meta">${meta}</div></div></div>`).join('');
  }
  function renderSystems() {
    const grid = $('sysGrid');
    grid.innerHTML = '';
    SYSTEMS.forEach((s) => {
      const mods = data.modalities.filter((m) => m.system === s.id);
      if (!mods.length) return;
      const on = mods.filter((m) => m.available);
      const sts = on.map(E.modalityStatus);
      const overall = on.length === 0 ? 'off'
        : sts.every((x) => x === 'normal') ? 'normal'
        : sts.every((x) => x !== 'normal') ? 'attention' : 'mixed';
      const rows = on.flatMap((m) => m.metrics.map((mm) =>
        `<div class="m"><span>${mLabel(mm)}</span><span class="val">${fmt(mm.value)}${mm.unit}${zTag(mm)}</span></div>`));
      if (on.length < mods.length) rows.push(`<div class="m"><span style="color:var(--muted-2)">${L('模态已关闭（反事实）', 'Modality off (counterfactual)')}</span><span class="val">—</span></div>`);
      const card = document.createElement('div');
      card.className = 'sys';
      card.innerHTML = `<div class="top"><div class="nm">${s.icon} ${sysName(s)}</div><span class="dot ${overall}"></span></div>
        <div class="metrics">${rows.join('')}</div>`;
      grid.appendChild(card);
    });
  }

  /* ================= 证据与趋势 ================= */
  function renderEvidence() {
    const abn = [], nor = [];
    data.modalities.filter((m) => m.available).forEach((mod) => mod.metrics.forEach((mm) => {
      const st = E.metricStatus(mm);
      const row = `<div class="evi ${st}"><div>${mLabel(mm)}<div class="ref">${mod.icon} ${mName(mod)}</div></div>
        <div><span class="v">${fmt(mm.value)}${mm.unit}</span> <span class="ref">${refText(mm)}</span></div></div>`;
      (st === 'normal' ? nor : abn).push(row);
    }));
    $('eviAbnormal').innerHTML = abn.join('') || `<p class="hint">${L('无 —— 当前没有需关注的证据。', 'None — no attention-level evidence right now.')}</p>`;
    $('eviNormal').innerHTML = nor.join('') || `<p class="hint">${L('无正常证据。', 'No normal evidence.')}</p>`;

    $('attrBars').innerHTML = E.attribution(data.modalities).map((a) =>
      `<div class="row"><div>${a.icon} ${LANG === 'zh' ? a.name : a.nameEn}</div><div class="track"><i style="width:${a.pct}%"></i></div><div style="text-align:right">${a.pct}%</div></div>`).join('');

    const tg = $('trendGrid');
    tg.innerHTML = '';
    data.modalities.filter((m) => m.available).forEach((mod) => mod.metrics.forEach((mm) => {
      const h = mm.history || [];
      if (h.length < 2) return;
      const w = 160, hh = 46, pad = 5;
      const min = Math.min(...h), max = Math.max(...h), rng = (max - min) || 1;
      const pts = h.map((v, i) =>
        [pad + (i * (w - 2 * pad)) / (h.length - 1), hh - pad - ((v - min) / rng) * (hh - 2 * pad)])
        .map((p) => p.map((n) => n.toFixed(1)).join(',')).join(' ');
      const d = h[h.length - 1] - h[0];
      const bad = (mm.dir === 'high' && d < 0) || (mm.dir === 'low' && d > 0);
      const st = E.metricStatus(mm);
      tg.innerHTML += `<div class="spark-card"><div class="hd"><span class="nm">${mod.icon} ${mLabel(mm)}</span>
        <span class="vv">${fmt(h[0])}→${fmt(h[h.length - 1])}${mm.unit}
        <span class="delta ${bad ? 'up' : 'flat'}">${bad ? (d > 0 ? '▲' : '▼') : '–'}</span></span></div>
        <svg viewBox="0 0 ${w} ${hh}" preserveAspectRatio="none"><polyline points="${pts}" fill="none"
        stroke="${ST_COLOR[st]}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></div>`;
    }));
  }

  /* ================= 缺失与时效 ================= */
  function renderStatus() {
    const rows = data.modalities.map((m) => {
      if (!m.available) return `<tr><td>${m.icon} ${mName(m)}</td><td>—</td><td><span class="tag miss">${L('已关闭（反事实）', 'Off (counterfactual)')}</span></td></tr>`;
      const r = m.freshnessDays / Math.max(m.typicalPeriodDays, 1);
      const tag = E.isStale(m) ? '<span class="tag stale">STALE</span>'
        : r <= 1 ? '<span class="tag fresh">FRESH</span>' : '<span class="tag old">AGING</span>';
      return `<tr><td>${m.icon} ${mName(m)}</td><td>${L(`${m.freshnessDays} 天前 · 周期 ${m.typicalPeriodDays} 天`, `${m.freshnessDays}d ago · period ${m.typicalPeriodDays}d`)}</td><td>${tag}</td></tr>`;
    });
    data.missing.forEach((mi) =>
      rows.push(`<tr><td>${LANG === 'zh' ? mi.label : mi.labelEn}</td><td>${LANG === 'zh' ? mi.reason : mi.reasonEn}</td><td><span class="tag miss">MISSING</span></td></tr>`));
    $('freshBody').innerHTML = rows.join('');

    $('missingList').innerHTML = data.missing.map((mi) =>
      `<div class="insight"><div class="ic">🕳️</div><div class="bd"><b>${LANG === 'zh' ? mi.label : mi.labelEn}</b><div class="meta">${LANG === 'zh' ? `${mi.reason} · ${mi.impact}` : `${mi.reasonEn} · ${mi.impactEn}`}</div></div></div>`).join('')
      || `<p class="hint">${L('无结构性缺失。', 'No structural gaps.')}</p>`;

    const P = {
      3: ['stale', L('P3 · 高', 'P3 · High')],
      2: ['old', L('P2 · 中', 'P2 · Med')],
      1: ['fresh', L('P1 · 低', 'P1 · Low')],
    };
    $('planBody').innerHTML = E.measurementRequests(data.modalities, data.missing).map((r) =>
      `<div class="insight"><div class="ic">🩹</div><div class="bd"><b><span class="tag ${P[r.priority][0]}">${P[r.priority][1]}</span>　${LANG === 'zh' ? r.what : r.whatEn}</b><div class="meta">${LANG === 'zh' ? r.why : r.whyEn}</div></div></div>`).join('')
      || `<p class="hint">${L('证据充分，暂无补测建议。', 'Sufficient evidence — no retest suggestions.')}</p>`;
  }

  /* ================= 新数据分析（ingest pipeline） ================= */
  function rebuildIngestOptions() {
    const inMod = $('inMod'), sel = $('inMetric');
    const keepMod = inMod.value || data.modalities[0].id;
    inMod.innerHTML = '';
    data.modalities.forEach((m) => {
      const o = document.createElement('option');
      o.value = m.id; o.textContent = `${m.icon} ${mName(m)}`;
      inMod.appendChild(o);
    });
    inMod.value = keepMod;
    const mod = data.modalities.find((m) => m.id === inMod.value);
    const keepKey = sel.value || mod.metrics[0].key;
    sel.innerHTML = '';
    mod.metrics.forEach((mm) => {
      const o = document.createElement('option');
      o.value = mm.key; o.textContent = `${mLabel(mm)}（${L('当前', 'now')} ${fmt(mm.value)}${mm.unit}）`;
      sel.appendChild(o);
    });
    sel.value = keepKey;
    updateHint();
  }
  function updateHint() {
    const mod = data.modalities.find((m) => m.id === $('inMod').value);
    const mm = mod.metrics.find((x) => x.key === $('inMetric').value);
    $('inValue').placeholder = L(`当前 ${fmt(mm.value)}${mm.unit} · ${refText(mm)}`, `Now ${fmt(mm.value)}${mm.unit} · ${refText(mm)}`);
  }
  function refreshIngestOptions() { rebuildIngestOptions(); }

  async function runPipeline(outs) {
    const steps = [...document.querySelectorAll('#pipeline .step')];
    steps.forEach((s) => { s.classList.remove('active', 'done'); s.querySelector('.out').textContent = ''; });
    for (let i = 0; i < steps.length; i++) {
      steps[i].classList.add('active');
      await sleep(480);
      steps[i].classList.remove('active');
      steps[i].classList.add('done');
      steps[i].querySelector('.out').textContent = outs[i] || '✓';
    }
  }

  // 应用读数：更新数值/历史、重置时效、写入质量分；返回条目（含前后状态）
  function applyReadings(list) {
    return list.map(({ mod, metric, value, q }) => {
      const stFrom = E.metricStatus(metric);
      const from = metric.value;
      metric.value = value;
      if (metric.dir !== 'cat') { metric.history = metric.history || []; metric.history.push(value); }
      mod.freshnessDays = 0;
      mod.quality = q;
      return { mod, metric, from, to: value, stFrom, stTo: E.metricStatus(metric) };
    });
  }

  function showResult(before, entries) {
    const after = cur();
    const panel = $('ingestResult');
    panel.style.display = '';
    const rows = entries.map((e) => {
      const changed = e.stFrom !== e.stTo;
      const cell = changed
        ? `<span class="tag ${e.stTo === 'normal' ? 'fresh' : 'old'}">${stName(e.stFrom)} → ${stName(e.stTo)}</span>`
        : `<span class="tag miss">${stName(e.stTo)}${L('（不变）', ' (unchanged)')}</span>`;
      return `<tr><td>${e.mod.icon} ${mName(e.mod)} · ${mLabel(e.metric)}</td><td>${fmt(e.from)}${e.metric.unit}</td><td><b>${fmt(e.to)}${e.metric.unit}</b></td><td>${cell}</td></tr>`;
    }).join('');
    const tile = (name, b, a, goodWhenUp) => {
      const d = (a ?? 0) - (b ?? 0);
      const good = goodWhenUp ? d > 0 : d < 0;
      const cls = d === 0 ? 'flat' : good ? 'down' : 'up';   // down=绿 up=橙
      const arrow = d === 0 ? '—' : (d < 0 ? '▼' : '▲');
      return `<div class="spark-card"><div class="hd"><span class="nm">${name}</span>
        <span class="vv">${b} → <b>${a}</b> <span class="delta ${cls}">${arrow}${d === 0 ? '' : Math.abs(d)}</span></span></div></div>`;
    };
    panel.innerHTML = `<h2>${L('🧪 接入后分析', '🧪 Post-ingest analysis')}</h2>
      <p class="hint">${L('引擎已用新读数重算（该模态时效重置为 FRESH，质量按校验结果更新；洞察 / 补测建议已同步刷新）。',
        'Engine recomputed with the new reading (modality freshness reset to FRESH, quality updated; insights / retest plan refreshed).')}</p>
      <table class="mtable"><thead><tr>
        <th>${L('指标', 'Metric')}</th><th>${L('旧值', 'Old')}</th><th>${L('新值', 'New')}</th><th>${L('状态变化', 'Status')}</th>
      </tr></thead><tbody>${rows}</tbody></table>
      <div class="grid g3 mt">
        ${tile(L('亚健康倾向', 'Sub-health tendency'), before.risk, after.risk, false)}
        ${tile('Readiness', before.ready, after.ready, true)}
        ${tile(L('判断置信度', 'Confidence'), before.conf, after.conf, true)}
      </div>`;
    panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  let forceNext = false;
  $('btnIngest').addEventListener('click', async () => {
    const mod = data.modalities.find((m) => m.id === $('inMod').value);
    const metric = mod.metrics.find((x) => x.key === $('inMetric').value);
    const raw = $('inValue').value;
    if (raw === '') { $('ingestMsg').innerHTML = `<p class="hint">${L('请先输入数值。', 'Enter a value first.')}</p>`; return; }
    const res = E.validateReading(mod, metric, raw);
    const iss = LANG === 'zh' ? res.issues : res.issuesEn;
    const msgEl = $('ingestMsg');
    if (!res.ok && !forceNext) {
      // 校验未通过：不静默接受，确认后以降权模式接入
      forceNext = true;
      $('btnIngest').textContent = L('仍要接入（质量降权 q=0.5）', 'Ingest anyway (down-weight q=0.5)');
      msgEl.innerHTML = `<div class="insight"><div class="ic">⚠️</div><div class="bd"><b>${L('校验未通过：', 'Validation failed: ')}${iss.join(L('；', '; '))}</b>
        <div class="meta">${L('系统不会静默接受可疑读数。确认测量无误可再次点击按钮，读数将以质量权重 0.5 接入（在融合中降权）；否则请修改数值。',
          'The system will not silently accept a suspicious reading. If the measurement is correct, click again to ingest it with quality weight 0.5 (down-weighted in fusion); otherwise correct the value.')}</div></div></div>`;
      return;
    }
    forceNext = false;
    $('btnIngest').textContent = L('接入并分析', 'Ingest & analyze');
    msgEl.innerHTML = res.ok
      ? `<div class="insight"><div class="ic">✅</div><div class="bd"><b>${L('校验通过', 'Validation passed')}</b><div class="meta">${L('生理合理 · 质量评分 0.95', 'Physiologically plausible · quality 0.95')}</div></div></div>`
      : `<div class="insight"><div class="ic">⚠️</div><div class="bd"><b>${L('以降权模式接入（q=0.5）', 'Ingested in down-weighted mode (q=0.5)')}</b><div class="meta">${L('该读数在融合阶段权重减半，对结论的影响被压低。', 'The reading carries half weight in fusion, limiting its influence on conclusions.')}</div></div></div>`;

    const before = cur();
    await runPipeline([
      L('1 条读数', '1 reading'),
      res.ok ? 'PASS · q=0.95' : 'FLAG · q=0.5',
      L('基线 z 已更新', 'Baseline z updated'),
      L('risk / readiness / conf 重算', 'risk / readiness / conf recomputed'),
      L('洞察已刷新', 'Insights refreshed'),
    ]);
    const [entry] = applyReadings([{ mod, metric, value: res.value, q: res.ok ? res.quality : 0.5 }]);
    renderAll();
    showResult(before, [entry]);
  });

  const DEVICE_BATCH = [
    { modId: 'cardio', key: 'sbp', value: 118 },
    { modId: 'cardio', key: 'dbp', value: 76 },
    { modId: 'hrv', key: 'pnn50', value: 3.4 },
    { modId: 'hrv', key: 'sdnn', value: 36 },
    { modId: 'hrv', key: 'rmssd', value: 22 },
  ];
  $('btnSync').addEventListener('click', async () => {
    const list = DEVICE_BATCH.map((b) => {
      const mod = data.modalities.find((m) => m.id === b.modId);
      const metric = mod.metrics.find((x) => x.key === b.key);
      return { mod, metric, res: E.validateReading(mod, metric, b.value), value: b.value };
    });
    const ok = list.every((x) => x.res.ok);
    $('ingestMsg').innerHTML = ok
      ? `<div class="insight"><div class="ic">✅</div><div class="bd"><b>${L(`设备同步 ${list.length} 条读数，全部通过校验`, `Device sync: ${list.length} readings, all passed validation`)}</b><div class="meta">${L('来源：可穿戴设备（模拟） · 经数据源标准化后进入流水线', 'Source: wearable (simulated) · standardized then pipelined')}</div></div></div>`
      : `<div class="insight"><div class="ic">⚠️</div><div class="bd"><b>${L('部分读数未通过校验', 'Some readings failed validation')}</b><div class="meta">${L('异常读数将被降权或拒绝。', 'Abnormal readings will be down-weighted or rejected.')}</div></div></div>`;
    const before = cur();
    await runPipeline([
      L(`${list.length} 条读数`, `${list.length} readings`),
      ok ? 'ALL PASS · q=0.95' : L('部分 FLAG', 'some FLAG'),
      L('基线 z 已更新', 'Baseline z updated'),
      L('risk / readiness / conf 重算', 'risk / readiness / conf recomputed'),
      L('洞察已刷新', 'Insights refreshed'),
    ]);
    const entries = applyReadings(list.map((x) => ({ mod: x.mod, metric: x.metric, value: x.res.value, q: x.res.ok ? x.res.quality : 0.5 })));
    renderAll();
    showResult(before, entries);
  });

  document.querySelectorAll('.src-tab').forEach((t) => {
    t.addEventListener('click', () => {
      document.querySelectorAll('.src-tab').forEach((x) => x.classList.remove('active'));
      t.classList.add('active');
      $('srcManual').style.display = t.dataset.src === 'manual' ? '' : 'none';
      $('srcDevice').style.display = t.dataset.src === 'device' ? '' : 'none';
    });
  });

  /* ================= 反事实分析 ================= */
  function renderCF() {
    const wrap = $('cfToggles');
    wrap.innerHTML = '';
    data.modalities.forEach((m) => {
      const st = E.modalityStatus(m);
      const card = document.createElement('div');
      card.className = 'sys' + (m.available ? '' : ' off');
      card.style.cursor = 'pointer';
      card.innerHTML = `<div class="top"><div class="nm">${m.icon} ${mName(m)}</div><span class="dot ${m.available ? st : 'off'}"></span></div>
        <div class="metrics"><div class="m"><span>${L(`${m.metrics.length} 项指标 · 可靠度`, `${m.metrics.length} metrics · reliability`)} ${E.reliability(m).toFixed(2)}</span>
        <span class="val">${m.available ? L('点击关闭', 'Click to turn off') : L('已关闭 · 点击恢复', 'Off · click to restore')}</span></div></div>`;
      card.addEventListener('click', () => {
        m.available = !m.available;
        lastToggled = m.id;
        renderAll();
      });
      wrap.appendChild(card);
    });
    const base = snapshotAllOn(), curS = cur();
    const row = (name, b, a, goodWhenUp) => {
      const d = (a ?? 0) - (b ?? 0);
      const good = goodWhenUp ? d > 0 : d < 0;
      const cls = d === 0 ? 'flat' : good ? 'down' : 'up';
      return `<tr><td>${name}</td><td>${b ?? '–'}</td><td><b>${a ?? '–'}</b></td><td><span class="delta ${cls}">${d === 0 ? '—' : (d < 0 ? '▼' : '▲') + Math.abs(d)}</span></td></tr>`;
    };
    $('cfTableBody').innerHTML =
      row(L('亚健康倾向', 'Sub-health tendency'), base.risk, curS.risk, false) +
      row(L('证据完整度', 'Evidence completeness'), base.comp, curS.comp, true) +
      row(L('判断置信度', 'Confidence'), base.conf, curS.conf, true) +
      row('Readiness', base.ready, curS.ready, true);
    const t = lastToggled && data.modalities.find((m) => m.id === lastToggled);
    $('cfNote').textContent = t
      ? L(`「${t.name}」当前${t.available ? '开启' : '关闭'}。该模态可靠度 ${E.reliability(t).toFixed(2)}（时效权重 ${E.freshnessWeight(t).toFixed(2)} × 质量 ${t.quality}），含 ${t.metrics.length} 项指标 —— 开关它直接改变证据完整度与判断置信度。若某模态长期缺失，Agent 应主动要求补测，而不是降低标准下结论。`,
        `"${t.nameEn}" is currently ${t.available ? 'on' : 'off'}. Reliability ${E.reliability(t).toFixed(2)} (freshness ${E.freshnessWeight(t).toFixed(2)} × quality ${t.quality}), ${t.metrics.length} metrics — toggling it directly changes evidence completeness and confidence. If a modality stays missing, the agent should ask for a retest instead of lowering its standard.`)
      : L('提示：关闭贡献度最高的模态（见「证据与趋势」页），观察置信度下降幅度 —— 这就是该数据源的"证据价值"。',
        'Tip: turn off the highest-attribution modality (see Evidence & Trends) and watch how much confidence drops — that is the evidential value of that data source.');
  }

  /* ================= Agent 对话（rule-based，evidence-grounded，双语） ================= */
  const CHIPS = {
    zh: ['我算亚健康吗？', '为什么是这个结论？', '我缺什么数据？', '需要补测什么？', '如果没有 HRV 会怎样？', '我的趋势怎么样？'],
    en: ['Am I sub-healthy?', 'Why this conclusion?', 'What data is missing?', 'What should I retest?', 'What if there were no HRV?', 'How are my trends?'],
  };
  function rebuildChips() {
    const box = $('chips');
    box.innerHTML = '';
    CHIPS[LANG].forEach((c) => {
      const b = document.createElement('button');
      b.className = 'chip'; b.textContent = c;
      b.addEventListener('click', () => send(c));
      box.appendChild(b);
    });
  }
  function citations(pairs) { return pairs.map(([m, mm]) => citeOf(m, mm)).join(L('；', '; ')); }
  function topDeviantCites(k = 3) {
    const devs = [];
    data.modalities.filter((m) => m.available).forEach((mod) => mod.metrics.forEach((mm) => {
      const z = E.zScore(mm);
      if (z != null && E.deviatesWorse(mm)) devs.push({ mod, mm, z });
    }));
    devs.sort((a, b) => Math.abs(b.z) - Math.abs(a.z));
    return devs.slice(0, k).map((d) => [d.mod, d.mm]);
  }

  function answer(q) {
    const s = cur();
    const attr = E.attribution(data.modalities);
    const findMod = (str) => {
      const table = [
        ['hrv', /hrv|心率变异/i], ['cardio', /cardio|血压|blood pressure|\bbp\b/i], ['psych', /心理|情绪|焦虑|stress|mood|anxiety|psych/i],
        ['ans', /autonomic|自主神经/i], ['micro', /microcirc|capillar|微循环|nfc|毛细/i], ['urine', /urin|尿/i],
      ];
      for (const [id, re] of table) if (re.test(str)) return data.modalities.find((m) => m.id === id);
      return null;
    };

    if (/你好|你是谁|你能做什么|介绍|hello|hi\b|who are you|what can you|introduce/i.test(q)) {
      return {
        text: L('我是 HeteroHealthAgent（原型）。我读取了 Case 001 的多模态证据：6 个模态、17 项指标，另有 2 项结构性缺失。\n我能做：解释当前状态、说明判断依据、指出缺失数据、给补测建议、做反事实推演。\n我不能做：诊断疾病或推荐治疗 —— 那需要医生。',
          'I am HeteroHealthAgent (prototype). Case 001 loaded: 6 modalities, 17 metrics, plus 2 structural gaps.\nI can: explain current status, justify conclusions, point out missing data, suggest retests, run counterfactuals.\nI cannot: diagnose disease or recommend treatment — that requires a doctor.'),
        cite: L(`CASE_001 · modalities×6 · metrics×17 · missing×${data.missing.length}`, `CASE_001 · modalities×6 · metrics×17 · missing×${data.missing.length}`),
      };
    }
    const cm = findMod(q);
    if (cm && /如果没有|去掉|关掉|假设|没接|长期缺|what if|without|remove|turn off/i.test(q)) {
      const saved = cm.available;
      cm.available = false;
      const s2 = snapshot(data.modalities, data.missing.length);
      cm.available = saved;
      return {
        text: L(`假设「${cm.name}」不可用：判断置信度 ${s.conf}% → ${s2.conf}%（${s2.conf - s.conf}pt），亚健康倾向 ${s.risk} → ${s2.risk ?? '证据不足'}，证据完整度 ${s.comp}% → ${s2.comp}%。\n该模态可靠度 ${E.reliability(cm).toFixed(2)}、含 ${cm.metrics.length} 项指标，${s.conf - s2.conf >= 8 ? '是当前高价值证据源' : '对当前结论影响有限'}。若它长期缺失，正确做法是主动请求补测，而不是降低标准下结论。`,
          `If "${cm.nameEn}" were unavailable: confidence ${s.conf}% → ${s2.conf}% (${s2.conf - s.conf}pt), sub-health tendency ${s.risk} → ${s2.risk ?? 'insufficient evidence'}, evidence completeness ${s.comp}% → ${s2.comp}%.\nThis modality has reliability ${E.reliability(cm).toFixed(2)} with ${cm.metrics.length} metrics — ${s.conf - s2.conf >= 8 ? 'it is a high-value evidence source right now' : 'its impact on the current conclusion is limited'}. If it stayed missing, the right move is to request a retest, not to lower the bar for a conclusion.`),
        cite: citations(cm.metrics.map((mm) => [cm, mm])),
      };
    }
    if (/为什么|依据|怎么得出|如何得出|解释一下|凭什么|why|explain|because/i.test(q)) {
      const devs = topDeviantCites(3);
      const lines = devs.map(([m, mm]) => `• ${mName(m)}·${mLabel(mm)}：${fmt(mm.value)}${mm.unit}，${refText(mm)}${E.zScore(mm) != null ? L(`，偏离个人基线 ${E.zScore(mm) > 0 ? '+' : ''}${E.zScore(mm).toFixed(1)}σ`, `, ${Math.abs(E.zScore(mm)).toFixed(1)}σ off personal baseline`) : ''}`);
      return {
        text: L(`当前结论由以下证据驱动（贡献度：${attr.slice(0, 3).map((a) => a.name + ' ' + a.pct + '%').join('、')}）：\n${lines.join('\n')}\n同时也有正常证据（LF/HF、SpO₂ 等）限制结论范围；心血管数据已 ${data.modalities.find((m) => m.id === 'cardio').freshnessDays} 天未更新，尿检为 42 天前的低频结果 —— 因此置信度只有 ${s.conf}%。`,
          `The current conclusion is driven by (attribution: ${attr.slice(0, 3).map((a) => a.nameEn + ' ' + a.pct + '%').join(', ')}):\n${lines.join('\n')}\nNormal evidence (LF/HF, SpO₂, etc.) also bounds the conclusion; cardiovascular data is ${data.modalities.find((m) => m.id === 'cardio').freshnessDays} days old and the urinalysis is a 42-day-old low-frequency result — hence confidence is only ${s.conf}%.`),
        cite: citations(devs),
      };
    }
    if (/缺|没测|漏|不完整|missing|not collected|lack|incomplete/i.test(q)) {
      const stale = data.modalities.filter((m) => m.available && E.isStale(m));
      const lines = [
        ...data.missing.map((mi) => `• ${LANG === 'zh' ? mi.label : mi.labelEn}：${LANG === 'zh' ? mi.reason : mi.reasonEn}（${LANG === 'zh' ? mi.impact : mi.impactEn}）`),
        ...stale.map((m) => L(`• ${m.name}：已 ${m.freshnessDays} 天未测，超过 2 个采样周期，判为 STALE`,
          `• ${m.nameEn}: ${m.freshnessDays} days since last measurement — beyond 2 sampling cycles, marked STALE`)),
      ];
      return {
        text: L(`当前缺失 / 过期的证据：\n${lines.join('\n')}\n这些会直接降低判断置信度（当前 ${s.conf}%），在「缺失与时效」页可以看到完整清单。`,
          `Currently missing / stale evidence:\n${lines.join('\n')}\nThese directly lower confidence (now ${s.conf}%); see the Data Status page for the full list.`),
        cite: L(`CASE_001.missing×${data.missing.length}；freshness：${stale.map((m) => m.nameEn).join('、') || '无 STALE'}`,
          `CASE_001.missing×${data.missing.length}; stale: ${stale.map((m) => m.nameEn).join(', ') || 'none'}`),
      };
    }
    if (/补测|建议|怎么办|该做什么|行动|retest|advice|suggest|what should|plan/i.test(q)) {
      const reqs = E.measurementRequests(data.modalities, data.missing).slice(0, 3);
      return {
        text: L(`按信息价值排序的补测建议：\n${reqs.map((r, i) => `${i + 1}. ${r.what} —— ${r.why}`).join('\n')}\n补齐后证据完整度与置信度会明显上升；「新数据分析」页可以直接录入复测结果看变化。`,
          `Retest suggestions ranked by information value:\n${reqs.map((r, i) => `${i + 1}. ${r.whatEn} — ${r.whyEn}`).join('\n')}\nFilling these lifts completeness and confidence; you can enter retest results on the New Data Ingestion page.`),
        cite: L('measurementRequests()（缺失 > 过期 > 低质量）', 'measurementRequests() (missing > stale > low quality)'),
      };
    }
    if (/趋势|变化|最近|一周|这段时间|trend|recent|week|change/i.test(q)) {
      const cand = [];
      data.modalities.filter((m) => m.available).forEach((mod) => mod.metrics.forEach((mm) => {
        const h = mm.history || [];
        if (h.length < 2) return;
        const d = h[h.length - 1] - h[0];
        const bad = (mm.dir === 'high' && d < 0) || (mm.dir === 'low' && d > 0);
        if (bad) cand.push({ mod, mm, d });
      }));
      cand.sort((a, b) => Math.abs(b.d) - Math.abs(a.d));
      if (!cand.length) return { text: L('近几次测量没有明显变差的趋势。', 'No clearly worsening trend in recent measurements.'), cite: L('各模态 history 序列', 'modality history series') };
      const lines = cand.slice(0, 2).map((c) => `• ${mName(c.mod)}·${mLabel(c.mm)}：${fmt(c.mm.history[0])} → ${fmt(c.mm.history[c.mm.history.length - 1])}${c.mm.unit}（${L(c.d > 0 ? '上行' : '下行', c.d > 0 ? 'rising' : 'falling')}，${L('朝不利方向', 'unfavorable direction')}）`);
      return {
        text: L(`近 ${cand[0].mm.history.length} 次测量的主要趋势：\n${lines.join('\n')}\n趋势与当前状态一致，建议结合睡眠 / 压力等背景因素，并按补测建议复测确认。`,
          `Main trends over the last ${cand[0].mm.history.length} measurements:\n${lines.join('\n')}\nTrends match the current status — consider sleep / stress context and confirm with the suggested retests.`),
        cite: citations(cand.slice(0, 2).map((c) => [c.mod, c.mm])),
      };
    }
    if (/亚健康|总分|状态|总结|总体|怎么样|如何|评估|readiness|sub-?health|how am i|status|summary|overall|assess|score/i.test(q)) {
      const lbl = E.riskLabel(s.risk);
      return {
        text: L(`基于当前证据：亚健康倾向 ${s.risk}/100（${lbl.text}），Readiness ${s.ready}/100，判断置信度 ${s.conf}%。\n最需要关注：${attr.slice(0, 2).map((a) => a.name).join('、')}。\n也有稳定证据（LF/HF、SpO₂、心率等）在参考范围内。\n提醒：心血管数据待复测、尿检为低频旧数据 —— 这是筛查辅助，不构成诊断。`,
          `Based on current evidence: sub-health tendency ${s.risk}/100 (${lbl.en}), Readiness ${s.ready}/100, confidence ${s.conf}%.\nMost attention needed: ${attr.slice(0, 2).map((a) => a.nameEn).join(', ')}.\nStable evidence also exists (LF/HF, SpO₂, heart rate within range).\nNote: cardiovascular data is due for retest and the urinalysis is old low-frequency data — this is a screening aid, not a diagnosis.`),
        cite: citations(topDeviantCites(3)),
      };
    }
    if (/诊断|什么病|得.{0,3}病|患病|治疗|用药|吃药|开药|diagnos|disease|ill|treatment|medicat|drug|prescrib/i.test(q)) {
      return {
        text: L('这个问题我必须 abstain：诊断 / 治疗超出了我的证据与职责范围 —— 我只有 6 个模态的亚健康层面读数，不构成任何诊断依据。\n我能做的是：把状态解释清楚、指出缺什么数据、建议复测。请把报告带给医生做临床判断。',
          'I must abstain here: diagnosis / treatment is beyond my evidence and scope — I only hold sub-health-level readings from 6 modalities, which is no basis for a diagnosis.\nWhat I can do: explain the status clearly, point out missing data, and suggest retests. Please bring the report to a clinician.'),
        cite: L('能力边界（prototype scope）', 'capability boundary (prototype scope)'),
      };
    }
    return {
      text: L('这个问题我暂时没有对应的证据规则，宁可不确定也不编造（abstain）。\n你可以问我：当前状态怎么样？为什么？缺什么数据？需要补测什么？如果没有某个模态会怎样？趋势如何？',
        'I have no evidence rule for this question yet — better uncertain than made-up (abstain).\nYou can ask: How am I doing? Why? What is missing? What should I retest? What if a modality were unavailable? How are my trends?'),
      cite: L('无匹配证据规则 → abstain', 'no matching evidence rule → abstain'),
    };
  }

  function addMsg(role, text, cite) {
    const div = document.createElement('div');
    div.className = 'msg ' + role;
    div.textContent = text;
    if (cite) {
      const c = document.createElement('span');
      c.className = 'cite';
      c.textContent = L('依据：', 'Evidence: ') + cite;
      div.appendChild(c);
    }
    $('chatLog').appendChild(div);
    $('chatLog').scrollTop = $('chatLog').scrollHeight;
  }
  function send(text) {
    if (!text.trim()) return;
    addMsg('user', text);
    setTimeout(() => {
      const a = answer(text);
      addMsg('bot', a.text, a.cite);
      $('robotSay').innerHTML = `${a.text.split('\n')[0]}<small>${L('embodiment layer · 同步 Agent 最新结论', 'embodiment layer · syncs the agent’s latest conclusion')}</small>`;
    }, 320);
  }
  $('chatSend').addEventListener('click', () => { send($('chatInput').value); $('chatInput').value = ''; });
  $('chatInput').addEventListener('keydown', (e) => { if (e.key === 'Enter') { send($('chatInput').value); $('chatInput').value = ''; } });

  function resetChat() {
    $('chatLog').innerHTML = '';
    addMsg('bot',
      L(`你好，我是 HeteroHealthAgent（原型）。已读取 Case 001：6 个模态、17 项指标、${data.missing.length} 项结构性缺失。\n你可以问我：当前状态怎么样？为什么？缺什么数据？如果没有 HRV 会怎样？\n注意：我只做亚健康层面的筛查辅助，不构成诊断。`,
        `Hi, I am HeteroHealthAgent (prototype). Case 001 loaded: 6 modalities, 17 metrics, ${data.missing.length} structural gaps.\nAsk me: How am I doing? Why? What is missing? What if there were no HRV?\nNote: sub-health screening aid only — not a diagnosis.`),
      L(`CASE_001 · modalities×6 · missing×${data.missing.length}`, `CASE_001 · modalities×6 · missing×${data.missing.length}`));
    $('robotSay').innerHTML = L('已就绪。当前证据：6 个模态可用，其中心血管待复测、尿检为低频旧数据，另有一项结构性缺失。<small>embodiment layer · 同步 Agent 最新结论</small>',
      'Ready. Evidence: 6 modalities available — cardiovascular due for retest, urinalysis is old low-frequency data, plus structural gaps.<small>embodiment layer · syncs the agent’s latest conclusion</small>');
  }

  /* ================= init ================= */
  function renderAll() { renderOverview(); renderEvidence(); renderStatus(); renderCF(); }
  applyStatic();
  rebuildIngestOptions();
  renderAll();
  rebuildChips();
  resetChat();
})();
