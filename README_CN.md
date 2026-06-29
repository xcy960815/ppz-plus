# PPZ Plus

PPZ Plus 是一个用于在 VS Code 中操作 MySQL 数据库的扩展。它不是旧 PPZ 的原地续写，而是一次“能力迁移式重写”：保留旧产品里有价值的工作流，同时用清晰的 `presentation / application / domain / infrastructure` 分层重新实现。

[English README](./README.md)

## 当前范围

PPZ Plus 当前阶段只做 MySQL MVP。

当前已支持：

- MySQL 连接管理。
- MySQL schema / table 浏览。
- 表数据查看和基础行级写操作。
- SQL 终端执行。
- SQL / CSV / JSON 导入流程。
- DDL / DML SQL 导出流程。

当前暂不开放：

- PostgreSQL。
- SQLite。
- MSSQL。
- 其他兼容型数据库。

这些数据库会作为后续路线图推进，但当前扩展入口会刻意保持 MySQL 聚焦。

## 功能能力

### 连接管理

- 新增、编辑、删除、测试 MySQL 连接。
- 支持参数字段和连接 URL 两种输入方式。
- 使用 VS Code 扩展状态保存连接配置。
- 连接测试带进度提示和用户级错误提示。

### MySQL Explorer

- 在 Activity Bar 中提供 `PPZ Plus` 视图容器。
- 展示已保存 MySQL 连接、schema 和 table。
- 通过右键菜单打开表数据、SQL 终端、导入文件和导出 SQL。

### 表数据

- 从 MySQL Explorer 打开表数据页。
- 支持分页查看。
- 支持排序和过滤。
- 支持字段显隐控制。
- 支持查看当前表格视图生成的 SQL。
- 支持从表上下文打开 SQL 终端。
- 支持带限制保护的新增、编辑、删除和撤销流程。

### SQL 终端

- 执行查询 SQL 和非查询 SQL。
- 展示 SQL 执行耗时。
- 适配多种数据库执行结果形态。
- VS Code 重新加载 Webview 后可恢复终端状态。

### 导入

- 将 SQL 文件导入指定 MySQL 连接。
- 将 CSV / JSON 文件导入指定表。
- 支持导入预览。
- 支持字段映射配置。
- 支持生成导入错误报告。
- 长导入任务支持进度提示和取消。

### 导出

- 导出 MySQL 表级 DDL、DML、DDL + DML。
- 导出 MySQL schema 级 DDL、DML、DDL + DML。
- 支持从 schema 节点批量导出多张表。
- 支持将 SQL 文档保存到本地文件。
- 支持记录 SQL 导出任务日志。
- 支持导出进度提示和失败摘要。
- SQL 导出格式元数据独立于命令 UI。

## 基本使用

1. 打开 Activity Bar 中的 `PPZ Plus` 视图。
2. 执行 `PPZ Plus: Add MySQL Connection`。
3. 使用参数字段或 MySQL URL 填写连接信息。
4. 展开连接，浏览 schema 和 table。
5. 在表或 schema 右键菜单中打开数据、导入文件或导出 SQL。
6. 使用 `PPZ Plus: Open MySQL SQL Terminal` 执行自定义 SQL。

## 开发

### 环境要求

- VS Code `^1.125.0`。
- 与当前工具链兼容的 Node.js。
- `pnpm` `11.7.0`。
- 用于手动调试的可访问 MySQL 服务。

项目强制使用 `pnpm`。不要使用 `npm` 或 `yarn` 安装依赖、执行脚本、编译或测试。

### 安装依赖

```sh
pnpm install
```

### 编译

```sh
pnpm compile
```

### 监听编译

```sh
pnpm watch
```

### 测试

```sh
pnpm test
```

## 架构

代码按四层组织：

- `presentation`：VS Code 命令、Tree View、Webview 和用户提示。
- `application`：编排领域能力和基础设施能力的用例。
- `domain`：数据库无关的模型、任务模型和业务概念。
- `infrastructure`：MySQL 驱动、文件写入、存储适配器等外部细节。

关键边界：

- Presentation 不直接写数据库逻辑。
- Domain 不依赖 `vscode`。
- 导入导出是独立子系统。
- 不复用旧 PPZ 的高耦合架构。
- 当前 MVP 只开放 MySQL。

## 路线图

迁移进度记录在 [`.agents/todolist.md`](./.agents/todolist.md)。

近期目标仍然是稳定 MySQL 体验，并保持架构具备后续扩展数据库的空间。PostgreSQL、SQLite、MSSQL 和其他兼容数据库会延后到 MySQL 路径足够稳定之后推进。

## 已知限制

- 当前只开放 MySQL。
- 扩展仍处于 `0.0.1` 早期开发阶段。
- 打包发布和 Marketplace 流程暂未在本文档中展开。

## License

MIT License。详见 [LICENSE](./LICENSE)。
