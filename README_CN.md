<div align="center">
  <img src="./resources/ppz-plus.png" width="160" alt="PPZ Plus Logo" />
  <h1>PPZ Plus</h1>
</div>

PPZ Plus 是一个用于在 VS Code 中操作 MySQL、PostgreSQL 和 SQLite3 数据库的扩展。它不是旧 PPZ 的原地续写，而是一次“能力迁移式重写”：保留旧产品里有价值的工作流，同时用清晰的 `presentation / application / domain / infrastructure` 分层重新实现。

[项目文档](https://xcy960815.github.io/ppz-plus/) · [English README](./README.md)

## 当前范围

PPZ Plus 当前提供数据库资源树、表数据页、SQL 终端、导入和导出工作流。

当前完整支持：

- MySQL 连接管理、schema/table 浏览、表数据编辑、SQL 终端、SQL/CSV/JSON 导入、DDL/DML 导出。
- PostgreSQL 连接管理、database/schema/table 浏览、表数据读取、SQL 终端、DDL/DML 导出。
- SQLite3 文件连接管理、table/view 浏览、表数据读取和编辑、SQL 终端、DDL/DML 导出。

分批接入状态：

- MSSQL、CockroachDB、MariaDB 的连接配置已经可以创建和保存。
- MSSQL 连接测试链路已接入 `mssql` 驱动，用于真实 SQL Server 手动验证。
- MSSQL、CockroachDB、MariaDB 尚未作为完整支持引擎开放浏览、表数据、SQL 终端、导入或导出能力。

MSSQL 在真实 SQL Server 验证前，能力矩阵仍保持 `planned`。CockroachDB 和 MariaDB 仍按后续批次推进。

## 功能能力

### 连接管理

- 新增、编辑、删除、测试 MySQL、PostgreSQL 和 SQLite3 连接。
- 支持参数字段、连接 URL 和 SQLite3 数据库文件选择。
- 使用 VS Code 扩展状态保存连接配置。
- 连接测试带进度提示和用户级错误提示。
- MSSQL、CockroachDB、MariaDB 的连接配置保存处于分批接入状态，只能把已实现的能力切片视为可用。
- 通过 VS Code 账号同步显式上传和拉取连接配置。连接密码会先用用户输入的同步密钥加密，再写入 Settings Sync 载荷；同步密钥不会上传。

### Database Explorer

- 在 Activity Bar 中提供 `PPZ Plus` 视图容器。
- 展示已保存的 MySQL、PostgreSQL 和 SQLite3 连接。
- 按数据库类型展示不同层级：MySQL schema/table、PostgreSQL database/schema/table、SQLite3 table/view。
- 通过右键菜单打开表数据、SQL 终端、支持范围内的导入文件和导出 SQL。

### 表数据

- 从数据库资源树打开表数据页。
- 支持分页查看。
- 支持排序和过滤。
- 支持字段显隐控制。
- 支持查看当前表格视图生成的 SQL。
- 支持从表上下文打开 SQL 终端。
- 支持带限制保护的新增、编辑、删除和撤销流程。

### SQL 终端

- 执行 MySQL、PostgreSQL 和 SQLite3 查询 SQL 与非查询 SQL。
- 展示 SQL 执行耗时。
- 适配多种数据库执行结果形态。
- VS Code 重新加载 Webview 后可恢复终端状态。

### 导入

- 将 SQL 文件导入指定 MySQL 连接。
- 将 CSV / JSON 文件导入指定 MySQL 表。
- 支持导入预览。
- 支持字段映射配置。
- 支持生成导入错误报告。
- 长导入任务支持进度提示和取消。

### 导出

- 导出 MySQL 表级 DDL、DML、DDL + DML。
- 导出 MySQL schema 级 DDL、DML、DDL + DML。
- 导出 PostgreSQL database/schema/table 级 DDL、DML、DDL + DML。
- 导出 SQLite3 表级 DDL、DML、DDL + DML。
- 支持从 schema 节点批量导出多张表。
- 支持将 SQL 文档保存到本地文件。
- 支持记录 SQL 导出任务日志。
- 支持导出进度提示和失败摘要。
- SQL 导出格式元数据独立于命令 UI。

## 基本使用

1. 打开 Activity Bar 中的 `PPZ Plus` 视图。
2. 执行 `PPZ Plus: Add MySQL Connection` 或 `PPZ Plus: Add SQLite3 Connection`。
3. 使用参数字段、连接 URL 或 SQLite3 数据库文件填写连接信息。
4. 展开连接，浏览 database、schema、table 或 view。
5. 在右键菜单中打开数据、SQL 终端、支持范围内的导入文件或导出 SQL。
6. 使用对应数据库的 SQL 终端命令执行自定义 SQL。
7. 需要同步连接配置时，执行 `PPZ Plus: 上传连接配置到 VS Code 账号` 和 `PPZ Plus: 从 VS Code 账号拉取连接配置`，并在两台设备输入同一同步密钥。

## 开发

### 环境要求

- VS Code `^1.125.0`。
- 与当前工具链兼容的 Node.js。
- `pnpm` `11.7.0`。
- 用于手动调试的可访问 MySQL/PostgreSQL 服务或 SQLite3 数据库文件。
- 如需验证 MSSQL 连接测试，需要额外准备真实 SQL Server 实例。

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
- `infrastructure`：数据库驱动、文件写入、存储适配器等外部细节。

关键边界：

- Presentation 不直接写数据库逻辑。
- Domain 不依赖 `vscode`。
- 导入导出是独立子系统。
- 不复用旧 PPZ 的高耦合架构。
- 不同数据库的基础设施实现隔离在 application 接口之后。

## 路线图

迁移进度记录在 [`.agents/todolist.md`](./.agents/todolist.md)。

近期目标仍然是稳定现有 MySQL、PostgreSQL 和 SQLite3 工作流，并按能力逐项接入更多数据库。MSSQL 连接测试是第一个分批能力切片；MSSQL、CockroachDB、MariaDB 的浏览、表数据、SQL 执行、导入和导出仍在后续计划中。

## 支持作者

PPZ Plus 是一个免费开源项目。如果它节省了你的时间，可以自愿支持作者。

<p>
  <img src="./resources/sponsor/wechat-pay.jpg" alt="微信支付收款码" width="220" />
  <img src="./resources/sponsor/alipay.jpg" alt="支付宝收款码" width="220" />
</p>

## 已知限制

- 扩展仍处于 `0.0.1` 早期开发阶段。
- MySQL 导入能力当前比 PostgreSQL 和 SQLite3 更完整。
- MSSQL 连接测试仍需通过真实 SQL Server 验证后，才能在能力矩阵中标记为支持。
- 连接账号同步依赖 VS Code Settings Sync。密码会以密文进入同步载荷，拉取时必须输入上传时使用的同步密钥才能解密。
- 打包发布和 Marketplace 流程需要在干净环境中验证后再执行。

## License

MIT License。详见 [LICENSE](./LICENSE)。
