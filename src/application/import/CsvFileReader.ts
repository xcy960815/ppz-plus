/**
 * 向应用层提供 CSV 文件文本读取能力。
 */
export interface CsvFileReader {
	/**
	 * 读取指定 CSV 文件的文本内容。
	 *
	 * @param {string} filePath CSV 文件路径。
	 * @returns {Promise<string>} CSV 文件的 UTF-8 文本内容。
	 */
	readText(filePath: string): Promise<string>;
}
