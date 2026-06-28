import type { CsvDocument } from './CsvDocument';

/**
 * 解析带表头的 CSV 文本。
 */
export class CsvDocumentParser {
	/**
	 * 将 CSV 文本解析为表头和记录。
	 *
	 * @param content CSV 原始文本。
	 * @returns 解析后的 CSV 文档。
	 */
	public parse(content: string): CsvDocument {
		const records = this.parseRecords(content).filter((record) =>
			record.some((field) => field.trim().length > 0)
		);

		if (records.length === 0) {
			throw new Error('CSV file is empty.');
		}

		const headers = records[0].map((header, index) =>
			index === 0 ? header.replace(/^\uFEFF/, '').trim() : header.trim()
		);
		this.validateHeaders(headers);

		const rows = records.slice(1).map((record, index) => {
			if (record.length > headers.length) {
				throw new Error(
					`CSV row ${index + 2} has more columns than the header row.`
				);
			}

			return Object.fromEntries(
				headers.map((header, headerIndex) => [header, record[headerIndex] ?? ''])
			);
		});

		if (rows.length === 0) {
			throw new Error('CSV file does not contain data rows.');
		}

		return {
			headers,
			rows,
		};
	}

	/**
	 * 解析 CSV 文本为原始二维记录。
	 *
	 * @param content CSV 原始文本。
	 * @returns 未映射表头的二维字段数组。
	 */
	private parseRecords(content: string): string[][] {
		const records: string[][] = [];
		let currentRecord: string[] = [];
		let currentField = '';
		let inQuotedField = false;
		let lastTokenWasRecordTerminator = false;

		for (let index = 0; index < content.length; index += 1) {
			const character = content[index];

			if (inQuotedField) {
				if (character === '"') {
					if (content[index + 1] === '"') {
						currentField += '"';
						index += 1;
					} else {
						inQuotedField = false;
					}
				} else {
					currentField += character;
				}
				lastTokenWasRecordTerminator = false;
				continue;
			}

			if (character === '"' && currentField.length === 0) {
				inQuotedField = true;
				lastTokenWasRecordTerminator = false;
				continue;
			}

			if (character === ',') {
				currentRecord.push(currentField);
				currentField = '';
				lastTokenWasRecordTerminator = false;
				continue;
			}

			if (character === '\n' || character === '\r') {
				currentRecord.push(currentField);
				records.push(currentRecord);
				currentRecord = [];
				currentField = '';
				lastTokenWasRecordTerminator = true;

				if (character === '\r' && content[index + 1] === '\n') {
					index += 1;
				}
				continue;
			}

			currentField += character;
			lastTokenWasRecordTerminator = false;
		}

		if (inQuotedField) {
			throw new Error('CSV file has an unclosed quoted field.');
		}

		if (
			!lastTokenWasRecordTerminator ||
			currentField.length > 0 ||
			currentRecord.length > 0
		) {
			currentRecord.push(currentField);
			records.push(currentRecord);
		}

		return records;
	}

	/**
	 * 校验 CSV 表头是否可用于字段映射。
	 *
	 * @param headers CSV 表头字段名。
	 */
	private validateHeaders(headers: readonly string[]): void {
		if (headers.length === 0) {
			throw new Error('CSV header row is required.');
		}

		const seenHeaders = new Set<string>();
		for (const header of headers) {
			if (header.length === 0) {
				throw new Error('CSV header cannot contain empty column names.');
			}

			if (seenHeaders.has(header)) {
				throw new Error(`CSV header contains duplicate column "${header}".`);
			}

			seenHeaders.add(header);
		}
	}
}
