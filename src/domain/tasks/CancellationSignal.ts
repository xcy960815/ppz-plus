/**
 * 描述跨层传递的任务取消信号。
 */
export interface CancellationSignal {
	/**
	 * 标记用户是否已经请求取消当前任务。
	 */
	readonly isCancellationRequested: boolean;
}

/**
 * 表示用户主动取消了当前长任务。
 */
export class OperationCanceledError extends Error {
	/**
	 * 创建用户取消错误。
	 */
	public constructor() {
		super('Operation canceled by user.');
		this.name = 'OperationCanceledError';
	}
}

/**
 * 在用户请求取消时抛出统一的取消错误。
 *
 * @param cancellationSignal 可选的任务取消信号。
 */
export function throwIfCancellationRequested(
	cancellationSignal?: CancellationSignal
): void {
	if (cancellationSignal?.isCancellationRequested) {
		throw new OperationCanceledError();
	}
}

/**
 * 判断错误是否为用户主动取消。
 *
 * @param error 原始错误。
 * @returns 是否为用户取消错误。
 */
export function isOperationCanceledError(
	error: unknown
): error is OperationCanceledError {
	return error instanceof OperationCanceledError;
}
