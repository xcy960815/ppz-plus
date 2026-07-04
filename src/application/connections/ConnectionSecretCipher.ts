import type { EncryptedConnectionSecret } from "./ConnectionSyncPayload";

/**
 * 加密和解密连接同步密码。
 */
export interface ConnectionSecretCipher {
  /**
   * 使用用户提供的同步密钥加密明文密码。
   *
   * @param {string} plaintext 明文密码。
   * @param {string} syncKey 用户输入的同步密钥。
   * @returns {Promise<EncryptedConnectionSecret>} 可写入同步载荷的密文。
   */
  encrypt(plaintext: string, syncKey: string): Promise<EncryptedConnectionSecret>;

  /**
   * 使用用户提供的同步密钥解密密码密文。
   *
   * @param {EncryptedConnectionSecret} encryptedSecret 密码密文。
   * @param {string} syncKey 用户输入的同步密钥。
   * @returns {Promise<string>} 解出的明文密码。
   */
  decrypt(encryptedSecret: EncryptedConnectionSecret, syncKey: string): Promise<string>;
}
