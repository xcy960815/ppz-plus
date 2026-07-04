# Usage

## Connect to a Database

1. Open the `PPZ Plus` activity bar view.
2. Click the `+` icon or run `PPZ Plus: Add MySQL Connection`.
3. Enter connection details using parameter fields or a connection URL.
4. For SQLite3, select the database file from disk.

### Connection Types

- **MySQL**: host, port, user, password, database
- **PostgreSQL**: host, port, user, password, database
- **SQLite3**: file path
- **MSSQL**: host, port, user, password, database, encrypt, trustServerCertificate (staged rollout; connection testing still needs real SQL Server validation)
- **CockroachDB**: host, port, user, password, database, ssl (profile storage only for now)
- **MariaDB**: host, port, user, password, database (profile storage only for now)

## Browse the Database

Expand a saved connection to browse its structure:

- **MySQL**: schemas → tables
- **PostgreSQL**: databases → schemas → tables
- **SQLite3**: tables / views

MSSQL, CockroachDB, and MariaDB browsing is not open yet. Saved profiles for those engines do not expand into database structures.

## Sync Connection Profiles

Run `PPZ Plus: 上传连接配置到 VS Code 账号` to write the current connection list to VS Code Settings Sync. Connection profiles are synced through the VS Code account, and connection passwords are encrypted with the sync key you enter before they are written remotely. The sync key is never uploaded.

Run `PPZ Plus: 从 VS Code 账号拉取连接配置` to merge profiles from VS Code account sync by connection ID. Pulling requires the same sync key used during upload; successfully decrypted passwords are stored in local SecretStorage, and profiles without encrypted passwords keep any existing local password.

## Open Table Data

Right-click a table node and select "Open Table Data" to:

- Page through rows
- Sort by column
- Filter data
- Toggle column visibility
- View the generated SQL

## Use the SQL Terminal

Right-click a connection or table and select "Open SQL Terminal" to execute queries.

- Write and run SELECT queries
- Execute INSERT, UPDATE, DELETE statements
- View elapsed execution time
- Terminal state is restored after VS Code reloads

## Import Data (MySQL)

Right-click a MySQL connection to import:

- **SQL files** — execute SQL dumps
- **CSV files** — import into selected tables
- **JSON files** — import into selected tables

Import flows include preview, column mapping, and error reporting.

## Export Data

Right-click any node to export:

- **DDL** — table/schema structure
- **DML** — table/schema data
- **DDL + DML** — both structure and data

Export is supported for MySQL, PostgreSQL, and SQLite3. Use batch export from schema nodes to export multiple tables at once.
