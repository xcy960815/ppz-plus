/**
 * 描述 @vscode/sqlite3 返回的语句执行上下文。
 */
export interface Sqlite3RunContext {
	readonly lastID?: number;
	readonly changes?: number;
}

/**
 * 描述 @vscode/sqlite3 Database 实例的最小运行时接口。
 */
export interface Sqlite3RuntimeDatabase {
	all(
		sql: string,
		params: readonly unknown[],
		callback: (error: Error | null, rows: unknown[]) => void
	): void;
	get(
		sql: string,
		params: readonly unknown[],
		callback: (error: Error | null, row: unknown) => void
	): void;
	run(
		sql: string,
		params: readonly unknown[],
		callback: (this: Sqlite3RunContext, error: Error | null) => void
	): void;
	exec(sql: string, callback: (error: Error | null) => void): void;
	close(callback: (error: Error | null) => void): void;
}

/**
 * 描述 @vscode/sqlite3 模块的最小运行时接口。
 */
export interface Sqlite3RuntimeModule {
	readonly OPEN_READWRITE: number;
	readonly OPEN_CREATE: number;
	readonly OPEN_READONLY: number;
	readonly Database: new (
		filename: string,
		mode: number,
		callback?: (error: Error | null) => void
	) => Sqlite3RuntimeDatabase;
	verbose?(): Sqlite3RuntimeModule;
}

/**
 * 描述 SQLite3 查询返回的原始行集合。
 */
export type Sqlite3QueryRows = readonly Record<string, unknown>[];
