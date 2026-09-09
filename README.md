# HeteroHealthAgent — Demo

面向**亚健康筛查**与**居家健康管理**的·异构 / 异步 / 不完整多模态**可解释**智能体演示。

> ⚠️ **Prototype · rule-based**：本 demo 用规则引擎（非真实模型）驱动，基于一份匿名化真实多模态健康报告（Case 001）。系统输出属于亚健康筛查 / 解释性辅助，**不构成医学诊断**。

## 演示内容

对应 proposal 第 8 节的前端 MVP，包含：

| 区域 | 说明 |
| --- | --- |
| 🩺 亚健康总览 | overall wellness / 亚健康倾向评分、证据完整度、判断置信度、各系统维度状态 |
| 🔍 证据 Evidence | 异常证据与正常证据并列，避免"所有指标都异常"的误导（No evidence → no claim） |
| 🕒 缺失 / 时效性 | 显式展示缺失字段（BMI / 既往史）与各模态新鲜度（fresh / 略旧 / STALE） |
| 🔀 反事实分析 | 开关任一模态，实时对比亚健康倾向 / 完整度 / 置信度的变化 |
| 💬 Agent 对话 | evidence-grounded 规则型问答：为什么？缺什么？需要补测什么？证据不足时会 abstain |
| 🤖 机器人屏幕 | embodiment layer 展示，与 Web 端共享同一后端 |

## 本地预览

纯静态站点，无需构建。任选一种：

```bash
# 方式 1：直接双击 index.html 用浏览器打开

# 方式 2：起一个本地服务器（推荐，避免个别浏览器的本地文件限制）
cd HeteroHealthAgent-demo
python3 -m http.server 8000
# 浏览器打开 http://localhost:8000
```

## 部署到 GitHub Pages

```bash
# 1. 在 GitHub 上新建一个空仓库（例如 HeteroHealthAgent-demo，不要勾选 add README）

# 2. 关联并推送
git remote add origin https://github.com/<你的用户名>/<仓库名>.git
git branch -M main
git add -A && git commit -m "HeteroHealthAgent demo v1"
git push -u origin main

# 3. 仓库 Settings → Pages → Build and deployment
#    Source 选 "Deploy from a branch"，Branch 选 main / (root)，Save
#    稍等 1–2 分钟，访问 https://<你的用户名>.github.io/<仓库名>/
```

`.nojekyll` 文件已包含，确保 `assets/` 目录被正确发布。

## 目录结构

```
HeteroHealthAgent-demo/
├── index.html          # 页面结构
├── assets/
│   ├── styles.css      # 样式
│   ├── data.js         # Case 001 数据 + 规则引擎（完整度/置信度/亚健康评分/补测建议）
│   └── app.js          # 渲染 + 反事实交互 + 规则型 Agent
├── .nojekyll
└── README.md
```

## 后续接入真实模型

`assets/data.js` 中的 `engine.*` 函数即当前判断逻辑。将来接入公开数据集训练的模型后，只需把 `subHealthRisk / confidence / measurementRequests` 换成模型输出，前端与 Agent 交互层无需改动。
