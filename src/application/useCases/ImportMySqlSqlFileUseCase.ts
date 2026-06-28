import type { SqlFileReader } from '../import/SqlFileReader';
import type { MySqlSqlFileImportProvider } from '../mysql/MySqlSqlFileImportProvider';
import type { MysqlConnectionConfig } from '../../domain/connections/ConnectionConfig';
import type { SqlFileImportResult } from '../../domain/import/SqlFileImportResult';
import type { CancellationSignal } from '../../domain/tasks/CancellationSignal';
import { throwIfCancellationRequested } from '../../domain/tasks/CancellationSignal';

/**
 * 导入 MySQL SQL 文件的应用用例。
 */
export class ImportMySqlSqlFileUseCase {
	/**
	 * 创建 MySQL SQL 文件导入用例。
	 *
	 * @param sqlFileReader 用于读取 SQL 文件内容的基础设施能力。
	 * @param mySqlSqlFileImportProvider 用于执行 MySQL SQL 文件内容的提供者。
	 */
	public constructor(
		private readonly sqlFileReader: SqlFileReader,
		private readonly mySqlSqlFileImportProvider: MySqlSqlFileImportProvider
	) {}

	/**
	 * 读取并导入指定 SQL 文件。
	 *
	 * @param connection MySQL 连接配置。
	 * @param filePath SQL 文件路径。
	 * @param cancellationSignal 可选的长任务取消信号。
	 * @returns SQL 文件导入结果。
	 */
	public async execute(
		connection: MysqlConnectionConfig,
		filePath: string,
		cancellationSignal?: CancellationSignal
	): Promise<SqlFileImportResult> {
		const normalizedFilePath = filePath.trim();

		if (normalizedFilePath.length === 0) {
			return {
				success: false,
				durationMs: 0,
				errorMessage: 'SQL file path is required.',
			};
		}

		throwIfCancellationRequested(cancellationSignal);
		const sql = await this.sqlFileReader.readText(normalizedFilePath);
		if (sql.trim().length === 0) {
			return {
				success: false,
				durationMs: 0,
				errorMessage: 'SQL file is empty.',
			};
		}

		throwIfCancellationRequested(cancellationSignal);
		return this.mySqlSqlFileImportProvider.importSql(connection, sql);
	}
}
