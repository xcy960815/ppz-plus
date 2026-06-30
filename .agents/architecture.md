# 架构约束

更新时间：2026-06-30

本文档记录 `ppz-plus` 的分层边界、目录职责和依赖方向。具体实现时优先遵守现有代码结构，不为了抽象而抽象。

## 分层边界

| 层 | 职责 | 依赖方向 |
|----|------|---------|
| Presentation | VS Code 命令、Tree View、Webview Panel、通知、进度和 QuickPick | → Application |
| Application | Use case 编排、参数校验、接口定义、多服务协调 | → Domain |
| Domain | 纯数据模型、能力声明、导入导出模型、查询结果模型 | 无外部依赖 |
| Infrastructure | 驱动封装、存储实现、文件系统、运行时适配 | → Domain，并实现 Application 接口 |

## 核心规则

- `Presentation` 只负责 VS Code UI 入口，不直接做数据库逻辑。
- `Application` 负责编排 use case，不直接依赖具体数据库驱动。
- `Domain` 不依赖 `vscode`、数据库驱动或 Node 运行时细节。
- `Infrastructure` 封装驱动、存储、文件、任务执行，不引用 Presentation。
- `Application` 定义接口，`Infrastructure` 实现接口。
- 导入导出必须是独立子系统，不挂在 UI 或单一连接对象上。

## 当前项目结构

```text
src/
  extension.ts
  presentation/
    bootstrap/
    commands/
    explorer/
    sql/
    tableData/
  application/
    capabilities/
    connections/
    export/
    import/
    mysql/
    postgresql/
    shared/
    useCases/
  domain/
    capabilities/
    connections/
    database/
    export/
    import/
    query/
    tasks/
  infrastructure/
    capabilities/
    connections/
    files/
    mysql/
    postgresql/
    shared/
    storage/
  test/
```

## 子系统职责

### 命令系统

应负责：

- 用户入口
- 参数收集
- 调用 use case

不应负责：

- 直接操作连接对象
- 直接刷新 Tree
- 直接执行 SQL

### Tree View

应负责：

- 展示资源树
- 根据节点类型绑定命令
- 拉取树节点 DTO

不应负责：

- 持有数据库连接
- 直接发起导出
- 维护业务状态

### Webview

应负责：

- 用户交互
- 展示查询结果
- 发送结构化请求

不应负责：

- 自己定义数据库能力规则
- 直接决定驱动行为

### 数据库适配层

不要继续使用单一“大连接类”。能力按接口拆分：

- `ConnectionTester`
- `MetadataProvider`
- `SqlExecutor`
- `TableDataProvider`
- `ExportProvider`
- `ImportProvider`

每个数据库按能力实现，不支持的能力通过 capability 声明或入口限制明确表达。

### 导入导出层

导入导出是独立子系统，职责包括：

- 导出目标解析
- 导出格式选择
- DDL/DML 生成
- 结果写入策略
- 导入源解析
- 导入执行任务
- 失败恢复与日志
