# ppz-plus Todo List

更新时间：2026-07-04

说明：

- 本文档用于统一记录 `ppz-plus` 的迁移清单和支持清单。
- 功能做完后，在条目后面追加 `✅`。
- 未明确完成前，不要提前打勾。
- 这里记录的是“产品能力”和“工程能力”，不是临时想法。

## 0. 已完成的基础事项

- 仓库初始化并推送到 GitHub `✅`
- 远程仓库 `origin` 配置完成 `✅`
- 旧 PPZ 能力审计文档沉淀完成 `✅`
- 根目录 `AGENTS.md` 集体记忆建立完成 `✅`
- Todo List 移入 `.agents` `✅`

## 1. 第一阶段必须完成的工程骨架

- 建立 `presentation / application / domain / infrastructure` 分层目录 `✅`
- 建立新的扩展启动与 bootstrap 结构 `✅`
- 建立新的命令注册系统 `✅`
- 建立连接配置的数据模型 `✅`
- 建立连接存储与读取服务 `✅`
- 建立数据库能力声明模型 `✅`
- 建立 MySQL 适配器骨架 `✅`
- 建立 Explorer Tree 的节点 DTO 与 provider `✅`
- 建立 Webview 通信协议 `✅`
- 建立 SQL 执行用例 `✅`
- 建立导出用例骨架 `✅`

## 2. 需要迁移的核心产品功能

连接管理：

- 新增连接 `✅`
- 编辑连接 `✅`
- 删除连接 `✅`
- 测试连接 `✅`
- 连接信息持久化 `✅`
- 连接配置表单支持 URL 模式 `✅`

Explorer Tree：

- Activity Bar 视图容器 `✅`
- 数据库连接树 `✅`
- Tree 节点刷新 `✅`
- 节点右键菜单 `✅`
- 根据数据库类型展示不同层级 `✅`

表数据查看：

- 打开表数据页 `✅`
- 表字段列表加载 `✅`
- 表数据分页 `✅`
- 表数据排序 `✅`
- 表数据过滤 / 搜索 `✅`
- 字段显隐控制 `✅`
- 查看当前 SQL `✅`
- 从表页打开 SQL 终端 `✅`

SQL 功能：

- SQL 终端 `✅`
- 执行查询 SQL `✅`
- 执行非查询 SQL `✅`
- 展示执行耗时 `✅`
- 多数据库结果展示适配 `✅`

导出功能：

- 导出 DML `✅`
- 导出 DDL `✅`
- 导出 DDL + DML `✅`
- 从表节点导出 `✅`
- 从 schema / database 节点导出 `✅`
- 导出能力差异提示 `✅`

## 3. 需要支持但不一定第一阶段完成的产品功能

表数据写操作：

- 新增单条记录 `✅`
- 编辑记录 `✅`
- 删除记录 `✅`
- 无主键表限制写操作 `✅`
- 撤销未保存修改 `✅`

导入能力：

- SQL 文件导入 `✅`
- MySQL SQL 文件导入兼容 dump 中的 `DELIMITER` 指令 `✅`
- CSV 导入 `✅`
- JSON 导入 `✅`
- 导入预览 `✅`
- 导入映射配置 `✅`
- 导入错误报告 `✅`
- 导入任务进度 `✅`

导出增强：

- 导出到文件 `✅`
- MySQL SQL 导出文件包含可重新导入的 database/use 准备语句 `✅`
- MySQL SQL 导出文件包含导入友好的外键检查开关 `✅`
- 导出任务日志 `✅`
- 批量导出 `✅`
- 导出格式扩展点 `✅`

体验增强：

- Webview 状态恢复 `✅`
- 用户级错误提示优化 `✅`
- 长任务取消 `✅`
- 进度条反馈 `✅`
- 连接配置支持加密后上传到 VS Code 账号同步 `✅`
- 连接配置支持从 VS Code 账号同步拉取并解密 `✅`
- 连接密码改为本地安全存储 `✅`
- 拉取连接配置后支持补录缺失密码 `✅`

文档与发布：

- 参考 `/Users/opera/Documents/my-repositories/web-message` 的 VitePress 双语文档骨架建设 `ppz-plus` 文档站 ✅
- MSSQL / CockroachDB / MariaDB 技术方案沉淀 `✅`

## 4. 数据库支持路线

第一优先级：

- MySQL 连接支持 `✅`
- MySQL 元数据读取 `✅`
- MySQL 表数据读取 `✅`
- MySQL SQL 执行 `✅`
- MySQL DDL 导出 `✅`
- MySQL DML 导出 `✅`

第二优先级：

- PostgreSQL 连接支持 `✅`
- PostgreSQL database / schema 双层结构 `✅`
- PostgreSQL 表数据读取 `✅`
- PostgreSQL SQL 执行 `✅`
- PostgreSQL DML 导出 `✅`
- PostgreSQL DDL 导出补齐 `✅`

第三优先级：

- SQLite3 连接支持 `✅`
- SQLite3 驱动分发 / 安装方案 `✅`
- SQLite3 表数据读取 `✅`
- SQLite3 SQL 执行 `✅`
- SQLite3 DDL / DML 导出 `✅`

第四优先级：

> 逐库逐批次的文件级执行清单见 `.agents/database-engine-expansion-plan.md` 的「实施细化清单」。每库按「连接测试 → Tree 浏览 → 表数据只读 → SQL 执行 → DML 导出 → DDL 导出」拆批，真库验证通过后再点亮对应能力并打勾。

- 扩展数据库连接模型支持 MSSQL / CockroachDB / MariaDB `✅`
- 新增连接表单可保存 MSSQL / CockroachDB / MariaDB 配置 `✅`
- MSSQL 连接支持
- MSSQL database / schema 结构
- MSSQL 表数据读取
- MSSQL SQL 执行
- MSSQL DML 导出
- MSSQL DDL 导出补齐

第五优先级：

- CockroachDB 支持
- MariaDB 支持
- 其他 MySQL / PostgreSQL 兼容型数据库支持

## 5. 工程质量与技术债

来源：多引擎扩展后的全库命名 / 目录 / 页面质量评审。

零风险修复（已完成）：

- 修复 `@returns {|}` 坏格式 JSDoc（补全实际返回类型）`✅`
- 表数据页 Webview `lang="en"` 更正为 `zh-CN` `✅`
- 文件对话框过滤器键 `SQLite` 统一为 `SQLite3` `✅`

Webview 复用与安全（非破坏性，待办）：

- 抽取 SQL 终端面板基类与共享样式常量，消除三个终端面板的重复
- 抽取公共 `escapeHtml` 工具，收敛 5 处重复实现
- 统一三个 SQL 终端面板的内联脚本转义强度到最严版本
- 为所有 Webview 面板补充 Content-Security-Policy 与 nonce，移除内联 `onclick`
- 动态生成的搜索条件控件补充 label / aria-label

命名与结构收敛（破坏性，需专门评估后再动）：

- 「去 MySql 化」重命名：`MySql*` 前缀但实为多引擎的命令 / 类 / 类型（需同步 package.json 贡献点、菜单 when 子句、Webview viewType 与已持久化面板恢复）
- 拆分超大文件 `DatabaseTableDataPanel.ts`（模板渲染 / 行编辑编排 / 状态序列化 / 过滤解析）
- `application/useCases` 平铺目录按引擎或用途再分层
- infrastructure 层驱动实现命名规则统一（`Mysql2*` / `Pg*` / `Sqlite3*` 三套逻辑）

## 6. 明确延后或谨慎处理的事项

- 不为兼容旧 PPZ 代码而复用旧架构
- 不把旧连接存储格式直接当成新模型
- 不在第一阶段同时接入多个数据库
- 不在功能修改后默认执行构建

## 7. 完成规则

- 只有真正完成并合入当前工作分支后，才在条目后补 `✅`
- 如果只是做了部分能力，不要打勾，必要时拆成更细条目
- 新增功能时，先补这里，再开始实现
