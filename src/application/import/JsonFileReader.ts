/**
 * 向应用层提供 JSON 文件文本读取能力。
 */
export interface JsonFileReader {
	/**
	 * 读取指定 JSON 文件的文本内容。
	 *
	 * @param filePath JSON 文件路径。
	 * @returns JSON 文件的 UTF-8 文本内容。
	 */
	readText(filePath: string): Promise<string>;
}
