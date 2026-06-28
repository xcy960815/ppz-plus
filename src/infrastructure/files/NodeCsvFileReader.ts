import { readFile } from 'node:fs/promises';

import type { CsvFileReader } from '../../application/import/CsvFileReader';

/**
 * 基于 Node.js 文件系统读取 CSV 文件。
 */
export class NodeCsvFileReader implements CsvFileReader {
	/**
	 * 读取指定 CSV 文件的 UTF-8 文本内容。
	 *
	 * @param filePath CSV 文件路径。
	 * @returns CSV 文件文本内容。
	 */
	public async readText(filePath: string): Promise<string> {
		return readFile(filePath, 'utf8');
	}
}
