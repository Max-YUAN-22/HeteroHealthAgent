/* HeteroHealthAgent demo — UI logic + scripted agent */
(function () {
  const { CASE_001, engine } = window.HHA;
  const data = structuredClone(CASE_001);        // 可变副本（counterfactual 切换 available）
  const $ = (id) => document.getElementById(id);

  const STATUS_TEXT = { normal: '正常', attention: '需关注', abnormal: '异常', mixed: '异质', off: '已关闭' };

  /* ---------- 渲染：总览 ---------- */
  function renderOverview() {
    const risk = engine.subHealthRisk(data.modalities);
    const comp = engine.evidenceCompleteness(data.modalities);
    const conf = engine.confidence(data.modalities, data.missing.length);
    const label = engine.riskLabel(risk);

    $('riskScore').textContent = risk === null ? '?' : risk;
    const pill = $('riskPill');
    pill.textContent = label.text;
    pill.className = 'risk-pill risk-' + label.level;

    // gauge
    const circ = 2 * Math.PI * 54;
    const v = risk === null ? 0 : risk;
    $('gaugeFill').style.strokeDashoffset = circ * (1 - v / 100);
    $('gaugeFill').style.stroke =
      label.level === 'high' ? 'var(--abnormal)' :
      label.level === 'mid' ? 'var(--attention)' :
      label.level === 'low' ? 'var(--normal)' : 'var(--muted)';

    $('completeness').textContent = comp + '%';
    $('confidence').textContent = conf + '%';
    $('barComplete').style.width = comp + '%';
    $('barConf').style.width = conf + '%';

    // dimension chips
    $('dims').innerHTML = data.modalities.map((m) => {
      const st = m.available ? m.status : 'off';
      return `<div class="dim ${m.available ? '' : 'off'}" data-id="${m.id}" title="点击开/关此模态">
        <div class="name">${m.icon} ${m.name}</div>
        <div class="st"><span class="dot ${st}"></span>${STATUS_TEXT[st]}</div>
      </div>`;
    }).join('');
    document.querySelectorAll('.dim').forEach((el) =>
      el.addEventListener('click', () => toggleModality(el.dataset.id)));
  }

  /* ---------- 渲染：证据 ---------- */
  function renderEvidence() {
    const abn = [], nor = [];
    data.modalities.filter((m) => m.available).forEach((m) => {
      m.evidence.forEach((e) => {
        const row = `<div class="evi ${e.status}">
          <span class="k">${m.icon} ${e.label}</span>
          <span><span class="v">${e.value}${e.unit}</span> <span class="ref">${e.ref}</span></span>
        </div>`;
        (e.status === 'normal' ? nor : abn).push(row);
      });
    });
    $('eviAbnormal').innerHTML = abn.join('') || '<p class="hint">无可用异常证据</p>';
    $('eviNormal').innerHTML = nor.join('') || '<p class="hint">无可用正常证据</p>';
  }

  /* ---------- 渲染：缺失 / 时效性 ---------- */
  function renderFreshness() {
    let rows = data.modalities.map((m) => {
      if (!m.available) return tr(m.icon + ' ' + m.name, '—', 'miss', '已关闭 (counterfactual)');
      const stale = engine.isStale(m);
      const old = m.freshnessDays > m.typicalPeriodDays;
      const cls = stale ? 'stale' : old ? 'old' : 'fresh';
      const txt = stale ? 'STALE 已过期' : old ? '略旧' : '新鲜';
      const when = m.freshnessDays === 0 ? '今天' : `${m.freshnessDays} 天前`;
      return tr(m.icon + ' ' + m.name, when, cls, txt + ` · 周期≈${m.typicalPeriodDays}天`);
    });
    data.missing.forEach((mi) => rows.push(tr(mi.label, '未采集', 'miss', mi.reason)));
    $('freshBody').innerHTML = rows.join('');

    function tr(name, when, cls, note) {
      return `<tr><td>${name}<br><small style="color:var(--muted)">${note}</small></td>
        <td>${when}</td><td><span class="tag ${cls}">${{
          fresh: '新鲜', old: '略旧', stale: 'STALE', miss: '缺失',
        }[cls]}</span></td></tr>`;
    }
  }

  /* ---------- 渲染：反事实对比 ---------- */
  let baseline = null;
  function captureBaseline() {
    baseline = {
      risk: engine.subHealthRisk(data.modalities),
      comp: engine.evidenceCompleteness(data.modalities),
      conf: engine.confidence(data.modalities, data.missing.length),
    };
  }
  function renderCounterfactual() {
    const cur = {
      risk: engine.subHealthRisk(data.modalities),
      comp: engine.evidenceCompleteness(data.modalities),
      conf: engine.confidence(data.modalities, data.missing.length),
    };
    const off = data.modalities.filter((m) => !m.available).map((m) => m.name);
    const delta = (a, b) => {
      const d = (a ?? 0) - (b ?? 0);
      const s = d > 0 ? '+' : '';
      const col = d === 0 ? 'var(--muted)' : d > 0 ? 'var(--attention)' : 'var(--normal)';
      return `<span style="color:${col};font-weight:700">${s}${d}</span>`;
    };
    $('cfBody').innerHTML = `
      <table class="mtable">
        <thead><tr><th></th><th>基线(全模态)</th><th>当前</th><th>Δ</th></tr></thead>
        <tbody>
          <tr><td>亚健康倾向</td><td>${baseline.risk}</td><td>${cur.risk ?? '?'}</td><td>${delta(cur.risk, baseline.risk)}</td></tr>
          <tr><td>证据完整度</td><td>${baseline.comp}%</td><td>${cur.comp}%</td><td>${delta(cur.comp, baseline.comp)}</td></tr>
          <tr><td>判断置信度</td><td>${baseline.conf}%</td><td>${cur.conf}%</td><td>${delta(cur.conf, baseline.conf)}</td></tr>
        </tbody>
      </table>`;
    $('cfNote').textContent = off.length
      ? `已移除模态：${off.join('、')}。证据变少 → 置信度下降；这正是 Agent 判断"缺什么、有多可靠"的依据。`
      : '全部模态可用。点击总览中的维度关闭某模态，观察置信度如何随证据减少而下降。';
  }

  function toggleModality(id) {
    const m = data.modalities.find((x) => x.id === id);
    m.available = !m.available;
    renderAll();
  }

  /* ---------- Robot screen ---------- */
  function renderRobot() {
    const risk = engine.subHealthRisk(data.modalities);
    const label = engine.riskLabel(risk);
    $('robotSay').innerHTML = `“根据目前可用证据，系统提示 <b>${label.text}</b>（筛查结果，非诊断）。
      您可以问我：为什么？现在缺什么？需要补测什么？”
      <small>机器人屏幕仅作为 embodiment layer，与 Web 端共享同一后端；未来可替换为全息显示。</small>`;
  }

  /* ---------- 规则型 Agent ---------- */
  function agentReply(qRaw) {
    const q = qRaw.toLowerCase();
    const risk = engine.subHealthRisk(data.modalities);
    const conf = engine.confidence(data.modalities, data.missing.length);
    const label = engine.riskLabel(risk);
    const active = data.modalities.filter((m) => m.available);
    const deviating = active.filter((m) => m.status === 'attention' || m.status === 'abnormal');
    const cite = (arr) => `<span class="cite">证据来源：${arr.join('、') || '—'}</span>`;

    // 证据不足 → abstain
    if (active.length <= 1) {
      return { text: '当前可用模态过少，证据不足，我不宜给出健康状态判断。建议先补充测量再评估。',
        cite: cite(active.map((m) => m.name)) };
    }

    if (/亚健康|健康吗|我算|状态|怎么样/.test(q)) {
      return { text: `目前多个健康维度存在偏离，系统提示 ${label.text}（评分 ${risk}/100，置信度 ${conf}%）。`
        + `这属于筛查结果，不等同于疾病诊断。主要依据来自：${deviating.map((m) => m.name).join('、')}；部分信息仍缺失。`,
        cite: cite(deviating.map((m) => m.name)) };
    }
    if (/为什么|依据|原因|凭什么/.test(q)) {
      const detail = deviating.map((m) => `${m.name}（${m.summary}）`).join('；');
      return { text: `判断主要基于以下偏离证据：${detail}。同时也存在正常/稳定证据，因此不是"全部异常"。`,
        cite: cite(deviating.map((m) => m.name)) };
    }
    if (/缺|missing|没有的|少了什么|不完整/.test(q)) {
      const miss = data.missing.map((m) => m.label);
      const offMod = data.modalities.filter((m) => !m.available).map((m) => m.name);
      return { text: `当前缺失：${[...miss, ...offMod].join('、') || '无结构性缺失'}。`
        + `这些缺口会降低置信度，也是我不能对相关系统下结论的原因。`,
        cite: cite([...miss, ...offMod]) };
    }
    if (/补测|补充|测什么|建议测|要测/.test(q)) {
      const reqs = engine.measurementRequests(data.modalities, data.missing).slice(0, 3);
      return { text: `按信息价值排序，建议优先补测：\n` + reqs.map((r, i) => `${i + 1}. ${r.what} —— ${r.why}`).join('\n'),
        cite: cite(reqs.map((r) => r.what)) };
    }
    if (/hrv|如果没有|去掉|移除|去除/.test(q)) {
      const hrv = data.modalities.find((m) => m.id === 'hrv');
      return { text: `如果去掉 HRV：可评估的自主神经/恢复类证据减少，证据完整度和置信度都会下降，`
        + `我会更依赖血压与自主神经指标，并可能提示"需补测 HRV"。你也可以点击总览里的 HRV 维度实际试一下。`,
        cite: cite([hrv ? hrv.name : 'HRV']) };
    }
    if (/过期|时效|新鲜|多久|stale/.test(q)) {
      const stale = data.modalities.filter((m) => m.available && engine.isStale(m)).map((m) => m.name);
      return { text: stale.length
        ? `以下模态可能已过期（stale），我会降低其权重：${stale.join('、')}。例如尿检属低频模态，数周未更新时仅作背景参考。`
        : `当前可用模态都在合理时效内，未发现明显过期数据。`,
        cite: cite(stale) };
    }
    if (/诊断|生病|得了|疾病|治疗|吃药/.test(q)) {
      return { text: `我只做亚健康筛查与解释，不提供疾病诊断或用药建议。若指标持续异常，请咨询专业医生。`,
        cite: cite([]) };
    }
    // 兜底
    return { text: `我可以解释当前的健康状态、依据、缺失与建议补测项。试着问我："为什么？"、"现在缺什么？"、"需要补测什么？"`,
      cite: cite([]) };
  }

  const SUGGESTIONS = ['我算亚健康吗？', '为什么？', '现在缺什么？', '如果没有 HRV 呢？', '需要补测什么？', '有哪些数据过期了？'];

  function pushMsg(text, who, citeHtml) {
    const div = document.createElement('div');
    div.className = 'msg ' + who;
    div.innerHTML = (who === 'bot' ? text.replace(/\n/g, '<br>') : text) + (citeHtml || '');
    $('chatLog').appendChild(div);
    $('chatLog').scrollTop = $('chatLog').scrollHeight;
  }
  function ask(q) {
    if (!q.trim()) return;
    pushMsg(q, 'user');
    setTimeout(() => { const r = agentReply(q); pushMsg(r.text, 'bot', r.cite); }, 220);
  }
  function renderChips() {
    $('chips').innerHTML = SUGGESTIONS.map((s) => `<span class="chip">${s}</span>`).join('');
    document.querySelectorAll('.chip').forEach((c) =>
      c.addEventListener('click', () => ask(c.textContent)));
  }

  /* ---------- 初始化 ---------- */
  function renderAll() {
    renderOverview(); renderEvidence(); renderFreshness();
    renderCounterfactual(); renderRobot();
  }
  function init() {
    $('disclaimer').innerHTML = `📌 <b>${data.title}</b> · ${data.subject} —— ${data.disclaimer}`;
    captureBaseline();
    renderAll();
    renderChips();
    $('chatSend').addEventListener('click', () => { ask($('chatInput').value); $('chatInput').value = ''; });
    $('chatInput').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { ask($('chatInput').value); $('chatInput').value = ''; }
    });
    pushMsg('你好，我是 HeteroHealthAgent。我会基于你当前可用的证据来解释健康状态，并在证据不足时主动告诉你缺什么、建议补测什么。', 'bot');
  }
  init();
})();
