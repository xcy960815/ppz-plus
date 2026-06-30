import * as vscode from 'vscode';

/**
 * 描述用户级错误提示输入。
 */
export interface UserErrorPresentationInput {
	/**
	 * 保存当前失败的用户操作名称。
	 */
	readonly operation: string;

	/**
	 * 保存捕获到的原始错误。
	 */
	readonly error: unknown;

	/**
	 * 保存错误对象没有可读消息时使用的兜底文案。
	 */
	readonly fallbackMessage?: string;
}

/**
 * 展示面向用户的错误提示，并允许复制详细诊断信息。
 *
 * @param input 用户级错误提示输入。
 */
export async function showUserErrorMessage(
	input: UserErrorPresentationInput
): Promise<void> {
	const errorMessage = extractUserErrorMessage(
		input.error,
		input.fallbackMessage
	);
	const action = await vscode.window.showErrorMessage(
		`${input.operation}失败：${errorMessage}`,
		'复制详情'
	);

	if (action !== '复制详情') {
		return;
	}

	await vscode.env.clipboard.writeText(
		formatUserErrorDetails(input.operation, input.error, errorMessage)
	);
	await vscode.window.showInformationMessage(
		'错误详情已复制到剪贴板。'
	);
}

/**
 * 从未知错误中提取适合直接展示给用户的短消息。
 *
 * @param error 原始错误。
 * @param fallbackMessage 错误无消息时的兜底文案。
 * @returns 用户可读的错误消息。
 */
export function extractUserErrorMessage(
	error: unknown,
	fallbackMessage = '发生未知错误。'
): string {
	if (error instanceof Error && error.message.trim().length > 0) {
		return error.message.trim();
	}

	const aggregateMessage = extractAggregateErrorMessage(error);
	if (aggregateMessage !== undefined) {
		return aggregateMessage;
	}

	if (typeof error === 'string' && error.trim().length > 0) {
		return error.trim();
	}

	return fallbackMessage;
}

/**
 * 格式化可复制的错误详情。
 *
 * @param operation 失败的用户操作名称。
 * @param error 原始错误。
 * @param errorMessage 已展示给用户的错误消息。
 * @returns 可复制到剪贴板的诊断文本。
 */
function formatUserErrorDetails(
	operation: string,
	error: unknown,
	errorMessage: string
): string {
	const detailLines = [
		`操作：${operation}`,
		`消息：${errorMessage}`,
		`创建时间：${new Date().toISOString()}`,
	];
	const aggregateDetails = formatAggregateErrorDetails(error);

	if (error instanceof Error && error.stack) {
		detailLines.push('', '堆栈：', error.stack);
		if (aggregateDetails.length > 0) {
			detailLines.push('', '子错误：', ...aggregateDetails);
		}
		return detailLines.join('\n');
	}

	if (aggregateDetails.length > 0) {
		detailLines.push('', '子错误：', ...aggregateDetails);
	}

	if (typeof error !== 'string') {
		detailLines.push('', '原始错误：', safeStringifyError(error));
	}

	return detailLines.join('\n');
}

/**
 * 从 AggregateError 一类的错误对象中提取子错误消息。
 *
 * @param error 原始错误。
 * @returns 汇总后的子错误消息；没有可读子错误时为空。
 */
function extractAggregateErrorMessage(error: unknown): string | undefined {
	const messages = readAggregateErrors(error)
		.map((item) => extractUserErrorMessage(item, ''))
		.filter((message) => message.length > 0);

	return messages.length > 0 ? messages.join('；') : undefined;
}

/**
 * 格式化 AggregateError 的子错误详情。
 *
 * @param error 原始错误。
 * @returns 可写入诊断信息的子错误行。
 */
function formatAggregateErrorDetails(error: unknown): readonly string[] {
	return readAggregateErrors(error).map((item, index) => {
		const message = extractUserErrorMessage(item, '无错误消息。');
		return `${index + 1}. ${message}`;
	});
}

/**
 * 从未知错误对象中读取 AggregateError 子错误。
 *
 * @param error 原始错误。
 * @returns 子错误列表。
 */
function readAggregateErrors(error: unknown): readonly unknown[] {
	if (!error || typeof error !== 'object' || !('errors' in error)) {
		return [];
	}

	const errors = (error as { readonly errors?: unknown }).errors;
	return Array.isArray(errors) ? errors : [];
}

/**
 * 将未知错误安全转换为字符串。
 *
 * @param error 原始错误。
 * @returns 可写入诊断信息的字符串。
 */
function safeStringifyError(error: unknown): string {
	try {
		return JSON.stringify(error, null, 2) ?? String(error);
	} catch {
		return String(error);
	}
}
