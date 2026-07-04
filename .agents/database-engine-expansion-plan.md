# 数据库引擎扩展技术方案

更新时间：2026-07-04

本文档记录 `ppz-plus` 后续接入 MSSQL、CockroachDB、MariaDB 的技术方案。这里描述的是新架构下的实施路径，不复用旧 PPZ 的适配器、Webview 脚本、样式或运行时代码。

## 目标与边界

目标：

- 把 MSSQL 作为独立一等公民数据库接入。
- 把 CockroachDB 作为 PostgreSQL 兼容型数据库接入，但保留独立引擎标识和能力声明。
- 把 MariaDB 作为 MySQL 兼容型数据库接入，默认复用 `mysql2` 驱动能力，并用能力声明表达差异。
- 继续沿用 `presentation / application / domain / infrastructure` 分层，不引入大而全连接类。
- 所有能力差异通过明确模型、能力声明、SQL alias 或适配器契约处理，不写旧返回结构兼容兜底。

非目标：

- 不迁移旧 PPZ 的数据库适配器实现。
- 不把 TiDB、StoneDB 等所有兼容型数据库一次性做成独立数据库。
- 不在未完成真实能力前把 todolist 中的产品能力打勾。
- 不为了兼容旧 PPZ 历史行为增加多形态字段兼容分支。

## 当前基线

当前已完成一等公民支持：

- MySQL：连接、Tree、表数据读写、SQL 执行、导入、DDL/DML 导出。
- PostgreSQL：连接、database/schema/table Tree、表数据读取、SQL 执行、DDL/DML 导出。
- SQLite3：文件连接、表/视图 Tree、表数据读写、SQL 执行、DDL/DML 导出。

领域层已经预留引擎标识：

- `mysql`
- `postgresql`
- `sqlite3`
- `mssql`
- `cockroachdb`
- `mariadb`

但运行时连接配置、命令入口、适配器和能力目录当前只开放 MySQL、PostgreSQL、SQLite3。

## 推进顺序

1. MSSQL
2. CockroachDB
3. MariaDB

原因：

- MSSQL 是旧 PPZ 已经出现过的独立数据库能力，也是当前路线图第四优先级。
- CockroachDB 与 PostgreSQL 协议高度兼容，但 schema、DDL、事务语义和能力限制需要独立校验。
- MariaDB 与 MySQL 协议兼容度高，当前 UI 已提示 MySQL 系数据库可先使用 MySQL 驱动，因此独立化优先级低于 MSSQL 和 CockroachDB。

## 统一实施原则

### Domain

应新增或收敛：

- 在 `ConnectionConfig` 中加入明确的 `MssqlConnectionConfig`、`CockroachDbConnectionConfig`、`MariaDbConnectionConfig`。
- 每个新引擎只声明当前真实支持的输入模式，不提前把所有模式写进类型。
- capability declaration 中为每个引擎建立独立声明。
- 表、schema、database 等资源层级继续使用当前 Tree 节点 DTO，不让节点持有数据库连接。

不应做：

- 不把兼容型数据库伪装成 `mysql` 或 `postgresql` 写入连接模型。
- 不在领域层依赖 `mssql`、`pg`、`mysql2` 等驱动类型。

### Application

应新增或复用：

- 复用已有 use case 形态：连接测试、元数据读取、表数据分页、SQL 执行、导出。
- 如行为完全一致，可新增泛化接口或共享 helper，但不要为了未来数据库提前抽象整棵层级。
- 导出能力必须继续走独立 export provider 接口。

不应做：

- 不让 use case 直接判断驱动包返回结构。
- 不把数据库差异下沉到 Presentation 的命令或 Webview 判断里。

### Infrastructure

应新增：

- `src/infrastructure/mssql/`
- `src/infrastructure/cockroachdb/`
- `src/infrastructure/mariadb/`

每个目录按能力拆分文件：

- `RuntimeLoader`
- `ConnectionAdapter`
- `ConnectionTester`
- `MetadataProvider`
- `SqlExecutor`
- `TableDataProvider`
- `ExportProvider`

如果 CockroachDB 或 MariaDB 复用已有驱动，也应该有独立目录封装差异，避免把兼容型数据库的判断散落在 PostgreSQL 或 MySQL 适配器里。

### Presentation

应调整：

- 连接表单增加 MSSQL、CockroachDB、MariaDB 选项。
- 禁用态文案改为真实能力状态，不再把已实现引擎显示为“暂未支持”。
- Tree context value 增加对应引擎节点。
- 命令入口只暴露 capability 声明为 `supported` 的能力。
- SQL 终端、表数据页继续复用现有 Webview 结构，只传结构化 `engine` 和连接信息。

不应做：

- 不为三个数据库复制整套 UI。
- 不在 Webview 内硬编码具体数据库驱动行为。

## MSSQL 技术方案

### 连接模型

新增连接配置：

- `engine: "mssql"`
- `mode: "parameters" | "url"`
- 参数模式字段：`host`、`port`、`username`、`password`、`database`、`encrypt`、`trustServerCertificate`
- URL 模式字段：`url`、`hasPassword`

默认端口：

- `1433`

密码策略：

- 继续使用当前 SecretStorage 双轨方案。
- 非敏感配置可远端同步，密码只留本机。

### 驱动选择

推荐使用 Node 生态中的 `mssql` 包作为上层驱动，底层默认走 `tedious`。

原因：

- 覆盖 SQL Server 常见连接参数。
- query 结果结构比直接使用 `tedious` 更适合封装统一 SQL 执行结果。
- 后续如需连接池和超时控制，封装成本较低。

### Tree 层级

MSSQL Tree 使用旧产品中已验证过的层级：

```text
connection -> database -> schema -> table
```

元数据查询建议：

- database：`sys.databases`
- schema：目标 database 下的 `sys.schemas`
- table：目标 database + schema 下的 `sys.tables`
- column：`sys.columns`、`sys.types`、`sys.identity_columns`
- primary key：`sys.key_constraints`、`sys.index_columns`

跨 database 查询应通过明确目标 database 建立连接或渲染三段式标识符，不能在 SQL 中拼接不受控的 database 名。

### 表数据

首版能力：

- 分页读取
- 排序
- 过滤
- 主键识别
- 只读表数据

写操作建议第二步再开放：

- 新增记录
- 更新记录
- 删除记录

原因是 SQL Server 的 identity、computed column、rowversion、datetimeoffset 等类型需要单独处理，先读后写风险更低。

### SQL 执行

统一输出到现有 `SqlExecutionResult` 模型：

- 多 recordset 只展示首个结果集，后续再扩展多结果集 UI。
- 非查询 SQL 返回受影响行数。
- 错误信息只展示用户可理解部分，详细驱动错误进日志。

### 导出

首版导出范围：

- table DML
- table DDL
- schema DML
- schema DDL
- database DML
- database DDL

DDL 生成重点：

- schema 创建
- table 创建
- column 类型、nullable、default
- identity
- primary key
- foreign key
- index

明确不在首版处理：

- stored procedure
- trigger
- view
- function
- partition
- advanced security policy

### 能力声明建议

MSSQL 首个可合入阶段：

- connectionManagement: supported
- connectionTest: supported
- treeExplorer: supported
- schemaBrowse: supported
- tableRead: supported
- tablePagination: supported
- tableSort: supported
- tableFilter: supported
- sqlExecute: supported
- exportDdl: planned
- exportDml: planned

导出完成后再把 `exportDdl` 和 `exportDml` 改为 `supported`。

## CockroachDB 技术方案

### 定位

CockroachDB 作为 PostgreSQL 兼容型数据库接入，但不写成 `postgresql` 连接。原因是：

- CockroachDB 的版本、事务语义、schema 能力和部分系统表行为与 PostgreSQL 不完全一致。
- 独立引擎标识有利于 capability 差异提示。
- 后续可单独调整 DDL、分页和错误信息。

### 连接模型

新增连接配置：

- `engine: "cockroachdb"`
- `mode: "parameters" | "url"`
- 参数模式字段：`host`、`port`、`username`、`password`、`database`、`ssl`
- URL 模式字段：`url`、`hasPassword`

默认端口：

- `26257`

### 驱动选择

复用当前 PostgreSQL 方向的 `pg` 驱动，但新增独立：

- `CockroachDbRuntimeLoader`
- `CockroachDbConnectionAdapter`
- `PgCockroachDbMetadataProvider`
- `PgCockroachDbSqlExecutor`
- `PgCockroachDbTableDataProvider`
- `PgCockroachDbExportProvider`

这样既能复用协议能力，又不会把 CockroachDB 差异塞进 PostgreSQL provider。

### Tree 层级

建议层级：

```text
connection -> database -> schema -> table
```

元数据查询优先使用 PostgreSQL 兼容的信息模式：

- database：`SHOW DATABASES`
- schema：`information_schema.schemata`
- table：`information_schema.tables`
- column：`information_schema.columns`

避免首版依赖 PostgreSQL 专有系统函数，例如 `pg_get_expr`、`pg_get_constraintdef` 等，除非先在 CockroachDB 目标版本上验证。

### 表数据与 SQL 执行

首版支持：

- 只读表数据
- 分页
- 排序
- 过滤
- SQL 终端执行

首版不开放写操作，原因是 CockroachDB 的事务重试、序列、默认值和分布式执行错误需要单独错误模型。

### 导出

建议分两步：

1. 先支持 DML 导出。
2. 再支持基础 DDL 导出。

DDL 首版只覆盖：

- schema
- table
- column
- primary key
- basic index

暂不承诺：

- interleave 旧特性
- locality
- changefeed
- policy
- sequence ownership
- PostgreSQL 扩展函数等差异能力

### 能力声明建议

CockroachDB 首个可合入阶段：

- connectionManagement: supported
- connectionTest: supported
- treeExplorer: supported
- schemaBrowse: supported
- tableRead: supported
- tablePagination: supported
- tableSort: supported
- tableFilter: supported
- sqlExecute: supported
- exportDdl: planned
- exportDml: planned

如果只先做连接和 Tree，则表数据、SQL、导出保持 `planned`，不要提前开放命令。

## MariaDB 技术方案

### 定位

MariaDB 作为 MySQL 兼容型数据库接入。当前项目已经提示 MariaDB 等 MySQL 系数据库可使用 MySQL 驱动，因此 MariaDB 独立化的价值主要是：

- 连接类型更清晰。
- UI 上明确展示 MariaDB。
- 后续可以为 MariaDB 特有类型、DDL、错误信息建立差异适配。

### 连接模型

新增连接配置：

- `engine: "mariadb"`
- `mode: "parameters" | "url"`
- 参数模式字段：`host`、`port`、`username`、`password`、`database`
- URL 模式字段：`url`、`hasPassword`

默认端口：

- `3306`

### 驱动选择

首版复用 `mysql2`。

不建议首版引入独立 `mariadb` 驱动，原因是：

- 当前 MySQL 能力已经基于 `mysql2` 完成。
- MariaDB 常规连接、查询、元数据读取可以先复用 MySQL 协议。
- 先保持依赖面收敛，等差异需求明确后再评估独立驱动。

### 适配器策略

新增独立目录：

- `src/infrastructure/mariadb/`

首版可在内部复用 MySQL 的部分 helper，但对外暴露独立 provider：

- `MariaDbConnectionAdapter`
- `Mysql2MariaDbMetadataProvider`
- `Mysql2MariaDbSqlExecutor`
- `Mysql2MariaDbTableDataProvider`
- `Mysql2MariaDbExportProvider`

不要让 MySQL provider 内部写 `if engine === "mariadb"` 分支。若确实需要共享逻辑，抽到 `src/infrastructure/shared/` 或 MySQL/MariaDB 共用 helper。

### Tree 层级

MariaDB Tree 与 MySQL 一致：

```text
connection -> database/schema -> table
```

元数据查询优先沿用 MySQL 方向的信息模式：

- schema：`information_schema.schemata`
- table：`information_schema.tables`
- column：`information_schema.columns`
- primary key / index：`information_schema.statistics`

### 表数据、SQL 与导出

首版可支持：

- 表数据读取
- 分页
- 排序
- 过滤
- SQL 终端执行
- DML 导出

DDL 导出建议单独验收：

- 常规 table DDL 可以复用 MySQL 思路。
- 对 sequence、virtual/generated column、engine、charset/collation 等差异要按当前 MariaDB 返回结构明确建模。

### 能力声明建议

MariaDB 首个可合入阶段：

- connectionManagement: supported
- connectionTest: supported
- treeExplorer: supported
- schemaBrowse: supported
- tableRead: supported
- tablePagination: supported
- tableSort: supported
- tableFilter: supported
- sqlExecute: supported
- exportDdl: planned
- exportDml: supported

DDL 完成真实验证后，再把 `exportDdl` 改为 `supported`。

## 连接表单方案

连接表单数据库类型建议分组：

- 已支持：MySQL、PostgreSQL、SQLite3
- 下一阶段：MSSQL
- 兼容型：CockroachDB、MariaDB

新增字段规则：

- MSSQL 显示 `encrypt`、`trustServerCertificate`。
- CockroachDB 显示 SSL 相关选项。
- MariaDB 复用 MySQL 参数字段。
- SQLite3 继续只允许文件模式。

保存时必须生成明确的 `engine`，不要因为复用驱动而保存成 `mysql` 或 `postgresql`。

## 命令和菜单方案

命令命名建议：

- `ppz-plus.openMssqlSqlTerminal`
- `ppz-plus.openCockroachDbSqlTerminal`
- `ppz-plus.openMariaDbSqlTerminal`
- `ppz-plus.exportMssqlTableDdl`
- `ppz-plus.exportCockroachDbTableDml`
- `ppz-plus.exportMariaDbTableBoth`

如果命令数量过多，优先做统一命令并通过节点 DTO 传入 `engine` 与 target，例如：

- `ppz-plus.openSqlTerminal`
- `ppz-plus.exportTableSql`
- `ppz-plus.openTableData`

但重构统一命令前，要确保不会影响现有 MySQL、PostgreSQL、SQLite3 行为。

菜单显示必须由 `viewItem` 和 capability 双重约束决定，不要出现点击后才提示“尚未支持”的常态入口。

## 测试策略

单元测试：

- 连接配置类型解析。
- capability declaration。
- SQL 标识符转义。
- DDL/DML 渲染。
- 表数据分页参数生成。

集成测试：

- 驱动连接参数转换。
- 元数据 provider 返回统一 DTO。
- SQL executor 返回统一结果。

手工验证：

- VS Code 连接表单。
- Tree 层级。
- SQL 终端。
- 表数据页。
- 导出入口。

外部数据库验证建议用 Docker Compose 单独维护，不放在默认构建链路中，避免本地没有数据库时阻断日常开发。

## 实施拆分

### 阶段 A：模型和入口

- 扩展 `ConnectionConfig`。
- 增加 capability declaration。
- 连接表单展示新数据库类型。
- 存储和 SecretStorage 支持新 engine。
- todo 只标记模型和入口完成，不标记数据库能力完成。

### 阶段 B：连接与 Tree

- 实现 connection adapter。
- 实现 connection tester。
- 实现 metadata provider。
- Tree 展示连接、database、schema、table。
- 只开放刷新、测试连接、基础浏览。

### 阶段 C：SQL 与表数据

- 实现 SQL executor。
- 实现 table data provider。
- 接入 SQL 终端。
- 接入表数据页只读能力。
- MariaDB 可在验证后开放写操作；MSSQL 和 CockroachDB 先保持只读。

### 阶段 D：导出

- 实现 DML export。
- 实现 DDL export。
- 补齐导出日志和取消。
- capability 中把对应导出能力从 `planned` 改为 `supported`。

### 阶段 E：增强能力

- 写操作。
- 批量导出。
- 数据库特有导入。
- 高级 DDL 对象。

## 实施细化清单（逐库逐批次）

本节是「实施拆分」的文件级细化，作为可独立合入的批次执行清单，落地时以此为准。

### 文件清单

Domain：

- 已有 `src/domain/connections/ConnectionConfig.ts` 已含 6 种 engine，仅在发现字段不足时补明确字段，不改成兼容兜底。
- 修改 `src/domain/capabilities/DatabaseCapabilityDeclaration.ts`：按批次把三库声明中已完成能力逐项从 `planned` 改为 `supported`。
- `src/domain/database/DatabaseEngine.ts` 无需新增 engine，仅补测试。

Application（每库同构，按引擎建独立子目录，不泛化现有 MySQL/PostgreSQL use case）：

- `src/application/mssql/`：`MssqlMetadataProvider` / `MssqlTableDataProvider` / `MssqlSqlExecutor` / `MssqlExportProvider`，以及 `ListMssqlDatabases/Schemas/Tables/TableColumns/TableRowPage`、`ExecuteMssqlSql`、导出批次再加 `ExportMssqlTable/Schema/Database` use case。
- `src/application/cockroachdb/`：`CockroachDbMetadataProvider` / `CockroachDbTableDataProvider` / `CockroachDbSqlExecutor` / `CockroachDbExportProvider` 及对应 use case。
- `src/application/mariadb/`：`MariaDbMetadataProvider` / `MariaDbTableDataProvider` / `MariaDbSqlExecutor` / `MariaDbExportProvider` 及对应 use case。
- 可复用：`src/application/shared/TableDataTypes.ts`、`src/domain/query/SqlExecutionResult.ts`、`src/domain/export/*`。

Infrastructure：

- MSSQL 全新写：`src/infrastructure/mssql/` 下 `MssqlRuntimeLoader` / `MssqlRuntimeTypes` / `MssqlConnectionAdapter` / `MssqlConnectionTester` / `MssqlMetadataProvider` / `MssqlTableDataProvider` / `MssqlSqlExecutor` / `MssqlExportProvider`，建议拆出 `MssqlIdentifier` / `MssqlPaginationSql` / `MssqlFilterSql`。
- CockroachDB 复用 `pg` 但独立封装：`src/infrastructure/cockroachdb/` 下 `CockroachDbRuntimeLoader`（可薄封装 `PostgreSqlRuntimeLoader`）/ `CockroachDbConnectionAdapter` / `PgCockroachDbMetadataProvider` / `PgCockroachDbTableDataProvider` / `PgCockroachDbSqlExecutor` / `PgCockroachDbExportProvider`。
- MariaDB 复用 `mysql2` 但独立封装：`src/infrastructure/mariadb/` 下 `MariaDbRuntimeLoader`（可薄封装 `MySqlRuntimeLoader`）/ `MariaDbConnectionAdapter` / `Mysql2MariaDbMetadataProvider` / `Mysql2MariaDbTableDataProvider` / `Mysql2MariaDbSqlExecutor` / `Mysql2MariaDbExportProvider`。
- 可抽共享 helper，但禁止在 MySQL/PostgreSQL provider 内写 `if engine === "mariadb"` / `if engine === "cockroachdb"`。

Presentation：

- `createBootstrapServices.ts`：注册 adapter/runtime/provider/use case；`CompositeDatabaseConnectionTester` 的 Map 增加对应 engine。
- `createBootstrapCommands.ts`：加 SQL 终端命令、导出命令。
- `DatabaseConnectionsTreeNode.ts`：增加 `mssqlDatabase/Schema/Table`、`cockroachDbDatabase/Schema/Table`、`mariaDbSchema/Table` 节点类型。
- `DatabaseConnectionsTreeDataProvider.ts`：扩展 `canExpandConnection` / `getChildren` / `createConnectionTreeItem`，新增各库 TreeItem 创建函数和 contextValue。
- `DatabaseTableDataPanel.ts`：扩展 `TableDataTreeNode`，在加载分支调用对应 use case；MSSQL/CockroachDB 初期只读，MariaDB 验证后可开放写操作。
- `ManageMySqlConnectionsCommand.ts`：`canTestConnection` / `canEditConnection` 放开对应引擎，编辑路径接入新增连接表单的 collect 方法或补专用 collect。
- 新增 `OpenMssqlSqlTerminalCommand` / `OpenCockroachDbSqlTerminalCommand` / `OpenMariaDbSqlTerminalCommand`。
- `package.json`：commands / activationEvents / view 菜单 when 子句同步加 contextValue，只给 `supported` 能力开放菜单。
- `OpenMySqlTableDataCommand` 目前是多引擎表数据入口，短期复用；命名收敛另起任务，不与三库接入绑进同一 PR。

### 能力点亮批次（每库依序）

1. 连接测试：adapter + tester 注册 + 真实连通后，`connectionTest` 改 `supported`；`connectionManagement` 待编辑/测试/详情闭环后再改。
2. Tree：`treeExplorer`（可展开）、`schemaBrowse`（层级稳定）。
3. 表数据：`tableRead` / `tablePagination` / `tableSort` / `tableFilter`（分页、排序 identifier 安全、过滤参数绑定正确）。
4. SQL 终端：`sqlExecute`（结果归一到 `SqlExecutionResult`）。
5. 导出：`exportDml` 与 `exportDdl` 分开点亮，DDL 未经真库验证前保持 `planned`。

### 可独立合入批次

每库按「连接测试 → Tree 浏览 → 表数据只读 → SQL 执行 → DML 导出 → DDL 导出」拆成 6 个可独立合入批次。MariaDB 若真库验证通过，可在表数据批次额外开放写操作，但能力矩阵无单独写能力键，不得把未验证写操作混入「表数据读取」验收。

### 依赖与加载

- MariaDB：不新增依赖，复用 `mysql2`；`MariaDbRuntimeLoader` 内部加载 `mysql2/promise` 或复用 `MySqlRuntimeLoader`。
- CockroachDB：不新增依赖，复用 `pg`；`CockroachDbRuntimeLoader` 内部加载 `pg` 或复用 `PostgreSqlRuntimeLoader`。
- MSSQL：新增 `mssql`（底层 tedious）。实现当天用 `pnpm view mssql version` 确认版本后 `pnpm add mssql@<固定版本>`，不用 `^`。
- 加载方式参考 `MySqlRuntimeLoader`：presentation 不 import 驱动，infrastructure 延迟加载。

### 收尾规则

- 每批只更新 `.agents/todolist.md` 中真正完成的条目。
- 每批必须 `pnpm exec tsc -p ./ --noEmit`，默认 `pnpm test` 全绿；真库集成测试另行声明是否执行。
- 未做真库验证的能力不能写「已验证支持」，只能写「单测覆盖，需真实数据库验证」。

## 风险清单

- 把兼容型数据库直接混进 MySQL/PostgreSQL provider，导致能力差异不可维护。
- MSSQL DDL 过早承诺完整覆盖，实际遗漏约束、identity、index 等对象。
- CockroachDB 误用 PostgreSQL 专有系统函数。
- MariaDB DDL 直接照搬 MySQL，忽略 generated column、sequence、engine、charset/collation 差异。
- 连接表单先开放选项，但后端 capability 未接入，造成用户入口可见但不可用。
- 默认测试依赖外部数据库，影响日常开发体验。

## 验收标准

每个数据库只有同时满足以下条件，才可在 `.agents/todolist.md` 对应产品能力后追加 `✅`：

- 连接配置可新增、编辑、删除、测试。
- Tree 能稳定展示目标层级。
- 对应 capability 的命令入口只在真实支持时显示。
- SQL 执行结果能归一化展示。
- 表数据读取能分页、排序、过滤。
- 导出能力完成 DDL/DML 真实验证后再分别标记。
- 密码未进入远端同步载荷或普通配置存储。
- 新增代码遵守分层边界，`Presentation` 不直接做数据库逻辑，`Domain` 不依赖 `vscode` 或驱动。
