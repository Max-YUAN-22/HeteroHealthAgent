/* =============================================================================
 * HeteroHealthAgent — Demo data & rule-based engine
 * -----------------------------------------------------------------------------
 * 本文件为原型（Prototype）演示用：Case 001 来自一份匿名化真实多模态健康报告，
 * Agent 的判断与解释由规则引擎（rule-based）生成，不接入真实模型，也不构成医学诊断。
 * ===========================================================================*/

/* 模态（modality）定义 —— 对应 proposal 附录 A 的健康维度。
 * status: normal | attention | abnormal | mixed
 * freshnessDays: 距上次测量天数   typicalPeriodDays: 该模态的自然采样周期
 * quality: 0–1 数据质量           available: 当前是否可用（counterfactual 可切换） */
const CASE_001 = {
  id: 'case-001',
  title: 'Case 001 · 匿名化真实报告',
  subject: '80 岁 · 男性',
  disclaimer: '本报告为亚健康筛查/解释性辅助原型，不构成医学诊断。',

  modalities: [
    {
      id: 'psych', name: '神经心理 / 压力', nameEn: 'Psych & Stress', icon: '🧠',
      status: 'attention', available: true, freshnessDays: 0, typicalPeriodDays: 1, quality: 0.9,
      summary: '情绪与焦虑指数偏高，提示心理/压力负荷。',
      evidence: [
        { label: '情绪指数', value: 75, unit: '', ref: '参考 ≤60', status: 'attention' },
        { label: '焦虑指数', value: 75, unit: '', ref: '参考 ≤60', status: 'attention' },
      ],
    },
    {
      id: 'ans', name: '自主神经', nameEn: 'Autonomic', icon: '🌿',
      status: 'attention', available: true, freshnessDays: 0, typicalPeriodDays: 1, quality: 0.85,
      summary: '自主神经平衡偏低，交感/副交感调节需关注。',
      evidence: [
        { label: '自主神经平衡', value: 25.9, unit: '', ref: '偏低', status: 'attention' },
        { label: 'LF/HF', value: 1.6, unit: '', ref: '参考 0.5–2.0', status: 'normal' },
      ],
    },
    {
      id: 'hrv', name: 'HRV 心率变异', nameEn: 'HRV', icon: '💓',
      status: 'attention', available: true, freshnessDays: 0, typicalPeriodDays: 1, quality: 0.8,
      summary: 'pNN50 明显偏低，属异质证据，需结合自主神经解释。',
      evidence: [
        { label: 'pNN50', value: 0.6, unit: '%', ref: '偏低', status: 'attention' },
        { label: 'SDNN / RMSSD', value: '多指标', unit: '', ref: '异质', status: 'mixed' },
      ],
    },
    {
      id: 'cardio', name: '心血管', nameEn: 'Cardiovascular', icon: '🩺',
      status: 'attention', available: true, freshnessDays: 6, typicalPeriodDays: 1, quality: 0.9,
      summary: '收缩压偏高，其余指标相对稳定；居家可重复监测。',
      evidence: [
        { label: '收缩压 SBP', value: 141, unit: 'mmHg', ref: '参考 <120', status: 'attention' },
        { label: '舒张压 DBP', value: 75, unit: 'mmHg', ref: '参考 <80', status: 'normal' },
        { label: 'SpO₂', value: 96, unit: '%', ref: '参考 ≥95', status: 'normal' },
      ],
    },
    {
      id: 'micro', name: 'NFC 微循环', nameEn: 'Microcirculation', icon: '🩸',
      status: 'mixed', available: true, freshnessDays: 3, typicalPeriodDays: 30, quality: 0.75,
      summary: '毛细血管密度局部偏低，但综合健康评分较好。',
      evidence: [
        { label: '毛细血管密度', value: 3.33, unit: '/mm', ref: '偏低', status: 'attention' },
        { label: 'NFC 健康评分', value: 79.6, unit: '', ref: '较好', status: 'normal' },
      ],
    },
    {
      id: 'urine', name: '尿检 / 代谢', nameEn: 'Urinalysis', icon: '🧪',
      status: 'attention', available: true, freshnessDays: 42, typicalPeriodDays: 90, quality: 0.7,
      summary: '蛋白与亚硝酸盐阳性，属低频模态，可能已过期，建议复测。',
      evidence: [
        { label: '尿蛋白', value: '+1', unit: '', ref: '阴性', status: 'attention' },
        { label: '亚硝酸盐', value: '+', unit: '', ref: '阴性', status: 'attention' },
        { label: '尿钙', value: 10, unit: '', ref: '需复核', status: 'attention' },
      ],
    },
  ],

  /* 结构性缺失证据（missing evidence）—— 天然体现 heterogeneous + incomplete 场景 */
  missing: [
    { label: 'BMI', reason: '未采集身高/体重', impact: '影响代谢与心血管风险背景' },
    { label: '既往史', reason: '问卷未填写', impact: '影响个体基线与风险分层' },
  ],
};

/* =============================================================================
 * 规则引擎（rule-based engine）
 * ===========================================================================*/

// freshness 权重：越接近该模态自然采样周期越新鲜；超过 2 个周期视为 stale。
function freshnessWeight(m) {
  if (!m.available) return 0;
  const ratio = m.freshnessDays / Math.max(m.typicalPeriodDays, 1);
  if (ratio <= 1) return 1;          // 在周期内 —— 新鲜
  if (ratio <= 2) return 0.6;        // 略过期
  return 0.3;                        // 明显过期 stale
}

function isStale(m) {
  return m.available && m.freshnessDays > 2 * m.typicalPeriodDays;
}

// 单模态可靠度：可用性 × 新鲜度 × 数据质量
function reliability(m) {
  return freshnessWeight(m) * (m.quality ?? 1);
}

// 证据完整度（0–100）：可用模态的可靠度之和 / 全部模态可靠度上限
function evidenceCompleteness(modalities) {
  const maxTotal = modalities.length; // 每个模态满分 1
  const got = modalities.reduce((s, m) => s + reliability(m), 0);
  return Math.round((got / maxTotal) * 100);
}

// 亚健康倾向评分（0–100，越高越需关注）：来自"偏离维度的加权占比"
function subHealthRisk(modalities) {
  const active = modalities.filter((m) => m.available);
  if (active.length === 0) return null;
  const deviating = active.filter((m) => m.status === 'attention' || m.status === 'abnormal');
  const weighted = deviating.reduce((s, m) => s + reliability(m), 0);
  const total = active.reduce((s, m) => s + reliability(m), 0) || 1;
  return Math.round((weighted / total) * 100);
}

// 置信度：证据完整度 × 缺失惩罚（结构缺失越多，置信越低）
function confidence(modalities, missingCount) {
  const comp = evidenceCompleteness(modalities) / 100;
  const penalty = Math.max(0.6, 1 - 0.1 * missingCount);
  return Math.round(comp * penalty * 100);
}

function riskLabel(score) {
  if (score === null) return { text: '证据不足', level: 'unknown' };
  if (score >= 60) return { text: '较高亚健康倾向', level: 'high' };
  if (score >= 35) return { text: '中度亚健康倾向', level: 'mid' };
  return { text: '偏低 / 相对良好', level: 'low' };
}

// 主动测量建议：优先补最有信息价值（缺失 > stale > 低质量）
function measurementRequests(modalities, missing) {
  const reqs = [];
  missing.forEach((mi) => reqs.push({ what: mi.label, why: `缺失：${mi.impact}`, priority: 3 }));
  modalities.forEach((m) => {
    if (!m.available) reqs.push({ what: m.name, why: '整模态缺失，无法评估该系统', priority: 3 });
    else if (isStale(m)) reqs.push({ what: m.name, why: `数据已 ${m.freshnessDays} 天，可能过期`, priority: 2 });
    else if (m.quality < 0.75) reqs.push({ what: m.name, why: '数据质量偏低，建议复测', priority: 1 });
  });
  return reqs.sort((a, b) => b.priority - a.priority);
}

/* 导出到全局，供 app.js 使用 */
window.HHA = {
  CASE_001,
  engine: {
    freshnessWeight, isStale, reliability, evidenceCompleteness,
    subHealthRisk, confidence, riskLabel, measurementRequests,
  },
};
