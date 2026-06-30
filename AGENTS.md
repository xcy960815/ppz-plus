# AGENTS

更新时间：2026-06-30

本文件是 `ppz-plus` 的 AI 协作入口。这里仅保留必须立即遵守的硬约束和文档索引；具体背景、架构、UI 迁移规则和进度记录放在 `.agents/` 目录下。

## 必须遵守

- `ppz-plus` 是基于标准 VS Code 插件框架长期演进的新项目，继承旧 PPZ 的产品能力，不继承旧实现。
- 旧 PPZ 仓库只作为需求来源和视觉/交互参考；页面类 UI 不允许直接复用旧 PPZ 的 Vue 组件、Webview 脚本、样式或运行时代码。
- 本机旧 PPZ 仓库路径为 `/Users/opera/Documents/my-repositories/vscode`；迁移旧界面或旧能力时优先读取该仓库源码。
- 项目强制使用 `pnpm`。安装依赖、执行脚本、编译或测试时不要使用 `npm` / `yarn`。
- 修改功能或修复 bug 后，默认不要主动跑构建；是否构建、打包、完整验证由用户后续明确要求。
- 修 bug 只修 ppz-plus 当前新架构中的真实问题，不为了旧 PPZ 的历史实现、旧返回结构或旧兼容路径增加兼容分支。
- 遇到字段名、返回结构或历史行为不一致时，通过当前新架构的明确模型、SQL alias、类型定义或数据契约修正，不写 `a ?? b ?? legacyC` 这类多形态兼容兜底。
- 新增或修改代码时，变量和方法默认补充标准 JSDoc 注释，描述文本使用中文。
- `Presentation` 只负责 VS Code UI 入口，不直接做数据库逻辑；`Domain` 不依赖 `vscode`。
- 功能迁移和能力支持进度统一维护在 `.agents/todolist.md`；完成项在对应条目后追加 `✅`。

## 文档地图

- [project-memory.md](.agents/project-memory.md)：项目定位、长期共识、阶段性决策和高风险提醒。
- [architecture.md](.agents/architecture.md)：分层边界、目录职责、依赖方向和子系统划分。
- [workflow.md](.agents/workflow.md)：包管理、验证策略、代码注释、兼容分支禁令和 todo 维护规则。
- [ui-migration.md](.agents/ui-migration.md)：旧 PPZ 页面类 UI 复刻规则和视觉迁移约束。
- [legacy-ppz-analysis.md](.agents/legacy-ppz-analysis.md)：旧 PPZ 能力审计与 ppz-plus 重写基线。
- [todolist.md](.agents/todolist.md)：迁移清单、支持清单和完成状态。
- [changelog-automation.md](.agents/changelog-automation.md)：changelog 与 release 自动化规则。

## 推荐阅读顺序

1. 先读本文件，确认硬约束。
2. 涉及实现结构时读 `.agents/architecture.md`。
3. 涉及旧 PPZ 能力或界面迁移时读 `.agents/legacy-ppz-analysis.md` 和 `.agents/ui-migration.md`。
4. 涉及任务进度或新增能力时读并维护 `.agents/todolist.md`。
5. 涉及发布或 changelog 时读 `.agents/changelog-automation.md`。
