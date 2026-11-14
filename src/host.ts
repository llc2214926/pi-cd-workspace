import { VERSION, type CustomEditor, type ExtensionCommandContext, type ExtensionContext } from "@earendil-works/pi-coding-agent";
import type { Component, TUI } from "@earendil-works/pi-tui";
import { isSupportedPiVersion } from "./compat.ts";
import { WorkspaceError } from "./i18n.ts";

// 补丁默认不安装；只在宿主提供这些可选接口时启用增强，否则沿用原版流程。
export interface WorkspaceCommandContext extends ExtensionCommandContext {
  isBashRunning?(): boolean;
  newSession(options?: NonNullable<Parameters<ExtensionCommandContext["newSession"]>[0]> & { requireIdle?: boolean }): Promise<{ cancelled: boolean }>;
  switchSessionWhenIdle?(sessionPath: string, options?: {
    prepareSnapshot?: (source: ExtensionContext["sessionManager"]) => void;
    withSession?: NonNullable<Parameters<ExtensionCommandContext["switchSession"]>[1]>["withSession"];
  }): Promise<{ cancelled: boolean }>;
}

type NativeTUI = TUI & { getFocusedComponent(): Component | null };

// 非稳定焦点/原生恢复动作读取只在此处；不缓存 TUI、不改 root、编辑器或其他扩展的焦点。
function commandEditor(ctx: ExtensionContext): Partial<CustomEditor> | undefined {
  if (!isSupportedPiVersion(VERSION) || ctx.mode !== "tui" || !ctx.hasUI) return;
  let tui: NativeTUI | undefined;
  const key = "pi-cd-workspace:host-probe";
  try {
    ctx.ui.setWidget(key, (native) => {
      tui = native as NativeTUI;
      return { render: () => [], invalidate() {} };
    }, { placement: "belowEditor" });
  } finally { ctx.ui.setWidget(key, undefined); }
  if (!tui || typeof tui.hasOverlay !== "function" || tui.hasOverlay()
    || typeof tui.getFocusedComponent !== "function") return;
  const editor = tui.getFocusedComponent() as Partial<CustomEditor> | null;
  if (typeof editor?.onAction !== "function" || typeof editor.getText !== "function" || typeof editor.setText !== "function"
    || (editor.getExpandedText?.() ?? editor.getText()) !== ctx.ui.getEditorText()) return;
  return editor;
}

export function canOpenDirectoryUI(ctx: ExtensionContext): boolean {
  return commandEditor(ctx) !== undefined;
}

// 内置 /resume 不能经 sendUserMessage 分发；复用宿主当前编辑器已注册的原生动作。
export function openNativeResume(ctx: ExtensionContext): void {
  if (!isSupportedPiVersion(VERSION) || ctx.mode !== "tui" || !ctx.hasUI) throw new WorkspaceError("switchTuiOnly");
  const editor = commandEditor(ctx);
  const resume = editor?.actionHandlers instanceof Map ? editor.actionHandlers.get("app.session.resume") : undefined;
  if (typeof resume !== "function") throw new WorkspaceError("resumeUnavailable");
  ctx.ui.setEditorText("");
  resume();
}
