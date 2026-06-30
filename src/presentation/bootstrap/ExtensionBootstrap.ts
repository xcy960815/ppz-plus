import type * as vscode from "vscode";

import type { ExtensionCommand } from "../commands/ExtensionCommand";
import { CommandRegistry } from "../commands/CommandRegistry";
import type { ExtensionActivationParticipant } from "./ExtensionActivationParticipant";

/**
 * 从表现层协调扩展启动。
 */
export class ExtensionBootstrap {
  /**
   * 将命令注册到 VS Code 扩展上下文。
   */
  private readonly commandRegistry: CommandRegistry;

  /**
   * 创建扩展启动实例。
   *
   * @param commands 激活期间注册的命令。
   * @param activationParticipants 随扩展一起激活的表现层参与者。
   */
  public constructor(
    private readonly commands: readonly ExtensionCommand[],
    private readonly activationParticipants: readonly ExtensionActivationParticipant[],
  ) {
    this.commandRegistry = new CommandRegistry();
  }

  /**
   * 为当前扩展会话激活表现层启动流程。
   *
   * @param {vscode.ExtensionContext} context VS Code 扩展生命周期上下文。
   */
  public activate(context: vscode.ExtensionContext): void {
    this.commandRegistry.register(this.commands, context);
    for (const activationParticipant of this.activationParticipants) {
      activationParticipant.activate(context);
    }
  }
}
