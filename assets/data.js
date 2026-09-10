/* =============================================================================
 * HeteroHealthAgent — Data model & rule-based engine (v2, bilingual)
 * -----------------------------------------------------------------------------
 * Prototype：Case 001 来自匿名化真实多模态健康报告；判断由规则引擎生成，
 * 不接真实模型，不构成医学诊断。
 *
 * 双语：数据字段带 *En 后缀（nameEn / labelEn / reasonEn ...），
 * 引擎文本输出同时带中英两个字段，由 app.js 按当前语言选取。
 *
 * 设计借鉴（模块层面）：
 *   Apple Health / Health Connect  → 多源数据接入 (sources)
 *   WHOOP / Oura                   → readiness 分数 + 个人基线 (baseline z-score)
 *   Function Health                → 身体系统分组 (system profile, in/out of range)
 *   InsideTracker                  → 个性化建议 / action plan
 *   Levels / Ultrahuman            → 新数据输入后的即时分析与趋势
 * ===========================================================================*/

/* -------- 每个 metric：数值 + 参考区间 + 个人基线(mean/std) + 历史 -------- */
/* dir: 'in'  → 落在 [lo,hi] 内为正常
 *      'low' → 越低越好（超过 hi 需关注）
 *      'high'→ 越高越好（低于 lo 需关注）
 *      'cat' → 分类型（尿检 + / - 之类）                                    */
const CASE_001 = {
  id: 'case-001',
  title: 'Case 001 · 匿名化真实报告',
  titleEn: 'Case 001 · De-identified real report',
  subject: '老年男性 · Age group 75+ · De-identified',
  subjectEn: 'Older adult, male · Age group 75+ · De-identified',
  disclaimer: '亚健康筛查 / 解释性辅助原型，不构成医学诊断。',
  disclaimerEn: 'Sub-health screening / explanatory-aid prototype. Not a medical diagnosis.',

  modalities: [
    { id: 'psych', name: '神经心理 / 压力', nameEn: 'Psych & Stress', icon: '🧠',
      system: 'psych', available: true, freshnessDays: 0, typicalPeriodDays: 1, quality: 0.9,
      metrics: [
        { key: 'mood', label: '情绪指数', labelEn: 'Mood Index', value: 75, unit: '', dir: 'low', lo: 0, hi: 60, mean: 62, std: 8, history: [58, 61, 64, 60, 66, 70, 73, 75] },
        { key: 'anxiety', label: '焦虑指数', labelEn: 'Anxiety Index', value: 75, unit: '', dir: 'low', lo: 0, hi: 60, mean: 60, std: 7, history: [55, 58, 62, 59, 64, 68, 72, 75] },
      ] },
    { id: 'ans', name: '自主神经', nameEn: 'Autonomic', icon: '🌿',
      system: 'autonomic', available: true, freshnessDays: 0, typicalPeriodDays: 1, quality: 0.85,
      metrics: [
        { key: 'ans_bal', label: '自主神经平衡', labelEn: 'ANS Balance', value: 25.9, unit: '', dir: 'high', lo: 40, hi: 100, mean: 31, std: 6, history: [34, 33, 30, 29, 28, 27, 26, 25.9] },
        { key: 'lfhf', label: 'LF/HF', labelEn: 'LF/HF', value: 1.6, unit: '', dir: 'in', lo: 0.5, hi: 2.0, mean: 1.5, std: 0.4, history: [1.3, 1.4, 1.5, 1.6, 1.5, 1.7, 1.6, 1.6] },
      ] },
    { id: 'hrv', name: 'HRV 心率变异', nameEn: 'HRV', icon: '💓',
      system: 'recovery', available: true, freshnessDays: 0, typicalPeriodDays: 1, quality: 0.8,
      metrics: [
        { key: 'pnn50', label: 'pNN50', labelEn: 'pNN50', value: 0.6, unit: '%', dir: 'high', lo: 3, hi: 30, mean: 3.2, std: 2, history: [4, 3.5, 3, 2.2, 1.8, 1.2, 0.9, 0.6] },
        { key: 'sdnn', label: 'SDNN', labelEn: 'SDNN', value: 28, unit: 'ms', dir: 'high', lo: 35, hi: 120, mean: 35, std: 8, history: [40, 38, 36, 34, 32, 30, 29, 28] },
        { key: 'rmssd', label: 'RMSSD', labelEn: 'RMSSD', value: 18, unit: 'ms', dir: 'high', lo: 20, hi: 90, mean: 25, std: 7, history: [30, 28, 26, 24, 22, 20, 19, 18] },
      ] },
    { id: 'cardio', name: '心血管', nameEn: 'Cardiovascular', icon: '🩺',
      system: 'cardio', available: true, freshnessDays: 6, typicalPeriodDays: 1, quality: 0.9,
      metrics: [
        { key: 'sbp', label: '收缩压 SBP', labelEn: 'SBP', value: 141, unit: 'mmHg', dir: 'low', lo: 90, hi: 120, mean: 132, std: 9, history: [128, 130, 133, 129, 135, 138, 140, 141] },
        { key: 'dbp', label: '舒张压 DBP', labelEn: 'DBP', value: 75, unit: 'mmHg', dir: 'in', lo: 60, hi: 80, mean: 77, std: 6, history: [78, 76, 79, 75, 77, 74, 76, 75] },
        { key: 'hr', label: '心率 HR', labelEn: 'Heart Rate', value: 72, unit: 'bpm', dir: 'in', lo: 60, hi: 100, mean: 71, std: 5, history: [70, 72, 69, 73, 71, 74, 72, 72] },
        { key: 'spo2', label: 'SpO₂', labelEn: 'SpO₂', value: 96, unit: '%', dir: 'high', lo: 95, hi: 100, mean: 97, std: 1, history: [97, 98, 96, 97, 97, 96, 97, 96] },
      ] },
    { id: 'micro', name: 'NFC 微循环', nameEn: 'Microcirculation', icon: '🩸',
      system: 'micro', available: true, freshnessDays: 3, typicalPeriodDays: 30, quality: 0.75,
      metrics: [
        { key: 'cap', label: '毛细血管密度', labelEn: 'Capillary Density', value: 3.33, unit: '/mm', dir: 'high', lo: 4, hi: 8, mean: 4.0, std: 0.5, history: [4.2, 4.1, 3.9, 3.8, 3.6, 3.5, 3.4, 3.33] },
        { key: 'nfc', label: 'NFC 健康评分', labelEn: 'NFC Health Score', value: 79.6, unit: '', dir: 'high', lo: 70, hi: 100, mean: 78, std: 5, history: [76, 77, 80, 79, 81, 78, 80, 79.6] },
      ] },
    { id: 'urine', name: '尿检 / 代谢', nameEn: 'Urinalysis', icon: '🧪',
      system: 'metabolic', available: true, freshnessDays: 42, typicalPeriodDays: 90, quality: 0.7,
      metrics: [
        { key: 'protein', label: '尿蛋白', labelEn: 'Urine Protein', value: '+1', unit: '', dir: 'cat', bad: true, history: [] },
        { key: 'nitrite', label: '亚硝酸盐', labelEn: 'Nitrite', value: '+', unit: '', dir: 'cat', bad: true, history: [] },
        { key: 'uca', label: '尿钙', labelEn: 'Urine Calcium', value: 10, unit: '', dir: 'in', lo: 1, hi: 12, mean: 7, std: 3, history: [6, 8, 7, 9, 8, 10, 9, 10] },
      ] },
  ],

  missing: [
    { label: 'BMI', labelEn: 'BMI', reason: '未采集身高/体重', reasonEn: 'Height / weight not collected',
      impact: '影响代谢与心血管风险背景', impactEn: 'Affects metabolic & cardiovascular context' },
    { label: '既往史', labelEn: 'Medical History', reason: '问卷未填写', reasonEn: 'Questionnaire not filled in',
      impact: '影响个体基线与风险分层', impactEn: 'Affects personal baseline & risk stratification' },
  ],
};

/* 身体系统（Function Health 式分组）—— 用于 System Profile 面板 */
const SYSTEMS = [
  { id: 'psych', name: '心理 / 压力', nameEn: 'Psych / Stress', icon: '🧠' },
  { id: 'autonomic', name: '自主神经', nameEn: 'Autonomic', icon: '🌿' },
  { id: 'recovery', name: '恢复 / HRV', nameEn: 'Recovery / HRV', icon: '💓' },
  { id: 'cardio', name: '心血管', nameEn: 'Cardiovascular', icon: '🩺' },
  { id: 'micro', name: '微循环', nameEn: 'Microcirculation', icon: '🩸' },
  { id: 'metabolic', name: '代谢 / 尿检', nameEn: 'Metabolic / Urine', icon: '🧪' },
];

/* =============================================================================
 * 引擎
 * ===========================================================================*/

// --- metric 级别：状态 & 个人基线 z-score ---
function metricStatus(m) {
  if (m.dir === 'cat') return m.bad ? 'attention' : 'normal';
  const v = Number(m.value);
  if (m.dir === 'in') return v >= m.lo && v <= m.hi ? 'normal' : 'attention';
  if (m.dir === 'low') return v <= m.hi ? 'normal' : 'attention';
  if (m.dir === 'high') return v >= m.lo ? 'normal' : 'attention';
  return 'normal';
}
function zScore(m) {
  if (m.dir === 'cat' || m.std == null) return null;
  return (Number(m.value) - m.mean) / m.std;
}
// 个人基线偏离方向（是否朝"更差"偏）
function deviatesWorse(m) {
  const z = zScore(m);
  if (z == null) return m.bad === true;
  if (m.dir === 'high') return z < -1;     // 越高越好，却低于基线 → 更差
  if (m.dir === 'low') return z > 1;       // 越低越好，却高于基线 → 更差
  return Math.abs(z) > 1.5;                // in-range 型：明显偏离
}

// --- modality 级别：由其 metrics 汇总状态 ---
function modalityStatus(mod) {
  if (!mod.available) return 'off';
  const st = mod.metrics.map(metricStatus);
  const attn = st.filter((s) => s !== 'normal').length;
  if (attn === 0) return 'normal';
  if (attn === st.length) return 'attention';
  return 'mixed';
}

// --- 时效 / 可靠度 ---
function freshnessWeight(m) {
  if (!m.available) return 0;
  const r = m.freshnessDays / Math.max(m.typicalPeriodDays, 1);
  if (r <= 1) return 1;
  if (r <= 2) return 0.6;
  return 0.3;
}
function isStale(m) { return m.available && m.freshnessDays > 2 * m.typicalPeriodDays; }
function reliability(m) { return freshnessWeight(m) * (m.quality ?? 1); }

// --- 汇总指标 ---
function evidenceCompleteness(mods) {
  const got = mods.reduce((s, m) => s + reliability(m), 0);
  return Math.round((got / mods.length) * 100);
}
function subHealthRisk(mods) {
  const active = mods.filter((m) => m.available);
  if (!active.length) return null;
  // 严重度加权：每个模态贡献 = 可靠度 × (偏离指标占比)，而非二值计数
  const w = active.reduce((s, m) => {
    const attn = m.metrics.filter((mm) => metricStatus(mm) !== 'normal').length;
    const sev = m.metrics.length ? attn / m.metrics.length : 0;
    return s + reliability(m) * sev;
  }, 0);
  const tot = active.reduce((s, m) => s + reliability(m), 0) || 1;
  return Math.round((w / tot) * 100);
}
// 个人基线偏离分（0–100）：可用数值 metric 的 |z| 均值映射
function personalDeviation(mods) {
  const zs = [];
  mods.filter((m) => m.available).forEach((m) =>
    m.metrics.forEach((mm) => { const z = zScore(mm); if (z != null) zs.push(Math.abs(z)); }));
  if (!zs.length) return null;
  const mean = zs.reduce((a, b) => a + b, 0) / zs.length;
  return Math.round(Math.min(mean / 2.5, 1) * 100);
}
// Readiness（借鉴 Oura/WHOOP，越高越好）：与亚健康倾向互补
function readiness(mods) {
  const risk = subHealthRisk(mods);
  const comp = evidenceCompleteness(mods);
  if (risk == null) return null;
  return Math.round((100 - risk) * 0.7 + comp * 0.3);
}
function confidence(mods, missingCount) {
  const comp = evidenceCompleteness(mods) / 100;
  const penalty = Math.max(0.6, 1 - 0.1 * missingCount);
  return Math.round(comp * penalty * 100);
}
function riskLabel(s) {
  if (s == null) return { text: '证据不足', en: 'Insufficient evidence', level: 'unknown' };
  if (s >= 60) return { text: '较高亚健康倾向', en: 'Elevated sub-health tendency', level: 'high' };
  if (s >= 35) return { text: '中度亚健康倾向', en: 'Moderate sub-health tendency', level: 'mid' };
  return { text: '偏低 / 相对良好', en: 'Low / relatively good', level: 'low' };
}

// --- XAI：模态贡献度（attribution）= 可靠度 × 偏离程度 ---
function attribution(mods) {
  const active = mods.filter((m) => m.available);
  const raw = active.map((m) => {
    const devMetrics = m.metrics.filter(deviatesWorse).length;
    const sev = m.metrics.length ? devMetrics / m.metrics.length : 0;
    return { id: m.id, name: m.name, nameEn: m.nameEn, icon: m.icon, w: reliability(m) * (0.3 + sev) };
  });
  const tot = raw.reduce((s, r) => s + r.w, 0) || 1;
  return raw.map((r) => ({ ...r, pct: Math.round((r.w / tot) * 100) }))
    .sort((a, b) => b.pct - a.pct);
}

// --- 主动补测建议（信息价值排序） ---
function measurementRequests(mods, missing) {
  const reqs = [];
  missing.forEach((mi) => reqs.push({
    what: mi.label, whatEn: mi.labelEn,
    why: `缺失：${mi.impact}`, whyEn: `Missing: ${mi.impactEn}`, priority: 3,
  }));
  mods.forEach((m) => {
    if (!m.available) reqs.push({
      what: m.name, whatEn: m.nameEn,
      why: '整模态缺失，无法评估该系统', whyEn: 'Entire modality missing — system cannot be assessed', priority: 3,
    });
    else if (isStale(m)) reqs.push({
      what: m.name, whatEn: m.nameEn,
      why: `数据已 ${m.freshnessDays} 天，可能过期`, whyEn: `Data is ${m.freshnessDays} days old — possibly stale`, priority: 2,
    });
    else if (m.quality < 0.75) reqs.push({
      what: m.name, whatEn: m.nameEn,
      why: '数据质量偏低，建议复测', whyEn: 'Low data quality — retest recommended', priority: 1,
    });
  });
  return reqs.sort((a, b) => b.priority - a.priority);
}

/* --- 数据接入：校验一条新读数（ingestion & validation） --- */
function validateReading(mod, metric, rawValue) {
  const issues = [], issuesEn = [];
  const v = Number(rawValue);
  if (metric.dir !== 'cat' && Number.isNaN(v)) { issues.push('数值无法解析'); issuesEn.push('Value cannot be parsed'); }
  // 生理合理性范围（宽松边界）
  const plaus = { sbp: [60, 260], dbp: [30, 160], hr: [30, 220], spo2: [50, 100], pnn50: [0, 100] };
  if (plaus[metric.key]) {
    const [lo, hi] = plaus[metric.key];
    if (v < lo || v > hi) {
      issues.push(`超出生理合理范围 [${lo}, ${hi}]`);
      issuesEn.push(`Out of physiological range [${lo}, ${hi}]`);
    }
  }
  const quality = issues.length ? 0.5 : 0.95;
  return { ok: issues.length === 0, issues, issuesEn, quality, value: metric.dir === 'cat' ? rawValue : v };
}

window.HHA = {
  CASE_001, SYSTEMS,
  engine: {
    metricStatus, zScore, deviatesWorse, modalityStatus,
    freshnessWeight, isStale, reliability,
    evidenceCompleteness, subHealthRisk, personalDeviation, readiness,
    confidence, riskLabel, attribution, measurementRequests, validateReading,
  },
};
