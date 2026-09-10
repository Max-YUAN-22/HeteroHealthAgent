# HeteroHealthAgent — Concept Prototype v0.1

面向**亚健康筛查**与**居家健康管理**的·异构 / 异步 / 不完整多模态**可解释**智能体概念原型。

> ⚠️ **Concept Prototype · rule-based**：本原型用规则引擎（非真实模型）驱动，基于一份匿名化真实多模态健康报告（Case 001，老年男性，Age group 75+，已去标识化）。系统输出属于亚健康筛查 / 解释性辅助，**不构成医学诊断**。

**首页第一屏即提供 GPT 式对话窗口**：可直接问 Agent「我算亚健康吗？为什么？缺什么数据？如果没有 HRV 会怎样？」，所有回答绑定结构化证据引用。

**中英文全局切换**：侧边栏「中文 / EN」一键切换整站（静态文案 + 动态洞察 + 对话 + 数据层指标名），选择保存在 localStorage。

## 模块设计（借鉴成熟产品）

| 借鉴对象 | 借鉴的模块/理念 | 落到本 demo |
| --- | --- | --- |
| Apple Health / Health Connect | 多源数据接入 | 数据接入 + 校验流水线 |
| WHOOP / Oura | Readiness 分数 + 个人基线 | Readiness 状态环 + 基线 z-score |
| Function Health | 生物标志物按身体系统分组（in/out of range） | System Profile 面板 |
| InsideTracker | 个性化建议 / action plan | 主动补测建议 |
| Levels / Ultrahuman | 新数据输入后的即时分析与趋势 | 趋势 sparkline + 接入后重算 |

## 演示内容

| 视图 | 说明 |
| --- | --- |
| 🏠 总览 | Readiness 状态环、亚健康倾向 / 证据完整度 / 判断置信度 / 基线偏离四张指标卡、洞察 feed（正/负证据并列）、System Profile（每个指标对照参考区间 + 个人基线 z-score） |
| 🔍 证据与趋势 | 异常与正常证据并列（No evidence → no claim）、模态贡献度 attribution（XAI）、各指标趋势 sparkline |
| 🕒 缺失与时效 | 结构性缺失（BMI / 既往史）、各模态 FRESH / AGING / STALE 判定、按信息价值排序的补测建议 |
| 📥 新数据分析 | 手动输入读数或模拟设备同步 → 接入 → 校验（生理合理性门槛 + 质量评分，可疑读数降权而非静默接受）→ 融合（个人基线对齐）→ 推理 → 解释 的完整流水线，前后指标对比 |
| 🔀 反事实分析 | 开关任一模态，实时对比亚健康倾向 / 完整度 / 置信度 / Readiness（例：关 HRV 置信度 57%→46%） |
| 💬 首页对话窗口 | GPT 式对话直接放在首页第一屏：为什么？缺什么？补测什么？如果没有 HRV？趋势？—— 证据不足或超范围（诊断/治疗）时 abstain，每条回答附证据引用 |
| 🤖 机器人与边界 | embodiment layer（机器人屏幕同步最新结论）+ 能力边界说明；终端形态与后端解耦 |

数据：附录 A 的 Case 001（80 岁男性匿名报告）。所有判断逻辑集中在 `assets/data.js` 的 `engine.*`，将来接入公开数据训练的模型只需替换这几个函数，前端不用改。

## 本地预览

纯静态站点，零依赖，无需构建：

```bash
cd HeteroHealthAgent-demo
python3 -m http.server 8000
# 浏览器打开 http://localhost:8000
```

（也可以直接双击 `index.html`。）

## 部署

已部署在 GitHub Pages：**https://max-yuan-22.github.io/HeteroHealthAgent/**

如需重新部署：

```bash
git add -A && git commit -m "update" && git push
```

（仓库 Settings → Pages → Deploy from a branch → main / (root)。`.nojekyll` 已包含，确保 `assets/` 正常发布。）

## 目录结构

```
HeteroHealthAgent-demo/
├── index.html          # 应用外壳：侧边栏 + 6 个视图
├── assets/
│   ├── styles.css      # 仪表盘样式
│   ├── data.js         # Case 001 数据模型 + 规则引擎（z-score / 完整度 / 置信度 /
│   │                   #   readiness / attribution / 补测建议 / 读数校验）
│   └── app.js          # 渲染 + ingest 流水线 + 反事实 + 规则型 Agent
├── .nojekyll
└── README.md
```

## 后续接入真实模型

`assets/data.js` 中的 `engine.*` 函数即当前判断逻辑。接入公开数据集训练的模型后，只需把 `subHealthRisk / readiness / confidence / measurementRequests / validateReading` 换成模型输出，前端与 Agent 交互层无需改动。
