/**
 * 列出领域模型中预留的数据库引擎。
 */
export const DATABASE_ENGINES = [
	'mysql',
	'postgresql',
	'sqlite3',
	'mssql',
	'cockroachdb',
	'mariadb',
] as const;

/**
 * 表示支持的数据库引擎标识。
 */
export type DatabaseEngine = (typeof DATABASE_ENGINES)[number];
