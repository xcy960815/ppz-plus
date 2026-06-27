/**
 * Lists the database engines reserved by the domain model.
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
 * Represents a supported database engine identifier.
 */
export type DatabaseEngine = (typeof DATABASE_ENGINES)[number];
