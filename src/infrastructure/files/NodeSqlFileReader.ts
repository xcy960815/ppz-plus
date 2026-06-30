import { readFile } from 'node:fs/promises';

import type { SqlFileReader } from '../../application/import/SqlFileReader';

/**
 * 基于 Node.js 文件系统读取 SQL 文件。
 */
export class NodeSqlFileReader implements SqlFileReader {
	/**
	 * 读取指定 SQL 文件的 UTF-8 文本内容。
	 *
	 * @param {string} filePath SQL 文件路径。
	 * @returns {Promise<string>} SQL 文件文本内容。
	 */
	public async readText(filePath: string): Promise<string> {
		return readFile(filePath, 'utf8');
	}
}
