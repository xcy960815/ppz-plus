import type { ConnectionConfig } from '../../domain/connections/ConnectionConfig';
import type { ConnectionTester } from '../connections/ConnectionTester';

/**
 * 通过配置的连接测试器测试连接配置。
 */
export class TestConnectionUseCase {
	/**
	 * 创建连接测试用例。
	 *
	 * @param connectionTester 用于验证连通性的测试器。
	 */
	public constructor(private readonly connectionTester: ConnectionTester) {}

	/**
	 * 测试连接配置。
	 *
	 * @param {ConnectionConfig} config 待验证的连接配置。
	 */
	public async execute(config: ConnectionConfig): Promise<void> {
		await this.connectionTester.test(config);
	}
}
