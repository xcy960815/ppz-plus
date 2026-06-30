# 使用

## 连接数据库

1. 打开 Activity Bar 中的 `PPZ Plus` 视图。
2. 点击 `+` 图标或执行 `PPZ Plus: 新增数据库连接`。
3. 使用参数字段或连接 URL 填写连接信息。
4. SQLite3 连接需要从磁盘选择数据库文件。

### 连接类型

- **MySQL**：host、port、user、password、database
- **PostgreSQL**：host、port、user、password、database
- **SQLite3**：文件路径

## 浏览数据库

展开已保存的连接浏览其结构：

- **MySQL**：数据库 → 表
- **PostgreSQL**：数据库 → 模式 → 表
- **SQLite3**：表 / 视图

## 打开表数据

右键点击表节点，选择"打开 MySQL 表数据"可以：

- 分页浏览行数据
- 按列排序
- 过滤数据
- 切换列显隐
- 查看生成的 SQL

## 使用 SQL 终端

右键点击连接或表，选择"打开 SQL 终端"执行 SQL。

- 输入并运行 SELECT 查询
- 执行 INSERT、UPDATE、DELETE 语句
- 查看执行耗时
- VS Code 重新加载后可恢复终端状态

## 导入数据（MySQL）

右键点击 MySQL 连接可以导入：

- **SQL 文件** — 执行 SQL dump
- **CSV 文件** — 导入到指定表
- **JSON 文件** — 导入到指定表

导入流程包含预览、字段映射和错误报告。

## 导出数据

右键点击任意节点可以导出：

- **DDL** — 表/库结构
- **DML** — 表/库数据
- **DDL + DML** — 结构加数据

导出支持 MySQL、PostgreSQL 和 SQLite3。从 schema 节点可批量导出多张表。
