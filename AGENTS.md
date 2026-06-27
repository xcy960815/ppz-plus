# AGENTS Memory

更新时间：2026-06-27

本文档用于记录 `ppz-plus` 的集体共识、长期约束和阶段性决策，避免后续实现时重新走回旧 PPZ 的高耦合路径。

## 项目定位

- `ppz-plus` 是基于标准 VS Code 插件框架长期演进的新项目。
- 旧项目 `PPZ` 是功能需求来源和历史产品原型，不是代码复用基座。
- 项目目标是“能力迁移式重写”，不是“原地补丁式续命”。

## 已确认共识

- 继承的是产品能力，不是旧实现。
- 旧仓库当前 `main` 不能代表可继承的完整产品实现。
- 历史能力判断以 `v0.5.1-beta` 为主要代码依据。
- 第一阶段优先可维护性、模块边界和演进空间，不优先追平旧版覆盖面。

## 功能取舍共识

### 必须保留的产品能力

- 连接管理
- Tree View 浏览数据库资源
- 表数据查看
- SQL 终端
- 导出能力

### 第一阶段不强求

- 真正的导入体系
- 行级写操作
- 全数据库同时支持
- 历史菜单/命令完全兼容

### 明确不沿用的旧实现思路

- Tree 节点直接持有数据库连接
- 连接服务直接刷新 Tree
- 大而全的数据库连接基类
- Webview/命令/数据层混写
- 手工功能测试作为唯一质量保障

## 数据库推进顺序

1. MySQL
2. PostgreSQL
3. SQLite3
4. MSSQL
5. CockroachDB / MariaDB / 其他兼容型数据库

## 第一阶段 MVP 范围

- MySQL 连接管理
- 连接测试
- Tree View
- schema/table 浏览
- 表数据只读查看
- 分页、排序、过滤
- SQL 执行
- DDL/DML 导出

## 架构边界共识

- `Presentation` 只负责 VS Code UI 入口，不直接做数据库逻辑。
- `Application` 负责编排 use case。
- `Domain` 不依赖 `vscode`。
- `Infrastructure` 封装驱动、存储、文件、任务执行。
- 导入导出必须是独立子系统，不挂在 UI 或单一连接对象上。

## 工作约束

- 修改功能或修复 bug 之后，默认不要主动跑构建。
- 是否执行构建、打包、完整验证，由后续明确需要时再单独决定。
- 新增或修改代码时，变量和方法默认补充标准 JSDoc 注释，描述文本使用中文。
- 功能迁移和能力支持的进度统一维护在 `.agents/todolist.md`。
- 任意一项完成后，要在对应条目后追加 `✅`，方便后续 AI 和协作者判断当前进度。

## 高风险提醒

- 不要为了兼容旧仓库而提前引入多数据库复杂度。
- 不要把旧连接存储结构直接定义成新领域模型。
- 不要把“数据库能连上”误判为“数据库已完成支持”。
- 不要把 PostgreSQL/MSSQL 未完成的 DDL 导出问题继续隐藏在运行时。

## 当前参考文档

- [legacy-ppz-analysis.md](/Users/opera/Documents/my-repositories/ppz-plus/ppz-plus/.agents/legacy-ppz-analysis.md)
- [todolist.md](/Users/opera/Documents/my-repositories/ppz-plus/ppz-plus/.agents/todolist.md)

## 后续文档建议

- `docs/mvp-scope.md`
- `docs/architecture-overview.md`
- `docs/database-capability-matrix.md`
- `docs/import-export-design.md`
