import { getAgentDir, type ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { DirectoryCommands } from "../src/cd-command.ts";
import { displayText } from "../src/display.ts";
import { describeError, getMessages, isLanguage, type Language } from "../src/i18n.ts";
import { loadLanguage, saveLanguage } from "../src/language.ts";

export default function cdWorkspaceExtension(pi: ExtensionAPI) {
  let commands: DirectoryCommands | undefined;
  let language: Language = "zh", agentDir = "";
  let generation = 0, languageGeneration = 0;
  let saving: Promise<void> = Promise.resolve();
  const stop = () => {
    commands?.dispose(); commands = undefined;
    // 不能等待正在触发 shutdown 的切换命令；只等待已经确认的偏好保存。
    return saving;
  };
  pi.on("session_start", async (_event, ctx) => {
    const current = ++generation;
    await stop();
    if (current !== generation || ctx.mode !== "tui") return;
    const directory = getAgentDir(), settings = await loadLanguage(directory);
    if (current !== generation) return;
    agentDir = directory; language = settings.language;
    commands = new DirectoryCommands(() => language);
    if (settings.error !== undefined) {
      ctx.ui.notify(displayText(getMessages(language).languageLoadFailed(describeError(settings.error, language))), "warning");
    }
  });
  pi.on("session_shutdown", async () => { generation++; await stop(); });
  pi.on("ui_prompt_start", () => commands?.prompt(true));
  pi.on("ui_prompt_end", () => commands?.prompt(false));
  pi.registerCommand("cd", {
    description: "切换工作目录并保留会话 / Switch working directory, keep session",
    handler: async (args, ctx) => { await commands?.command(args, ctx); },
  });
  pi.registerCommand("cd-new", {
    description: "切换工作目录并新建会话 / Switch working directory, start fresh",
    handler: async (args, ctx) => { await commands?.command(args, ctx, "new"); },
  });
  pi.registerCommand("cd-resume", {
    description: "切换目录后选择恢复会话（同目录直接恢复） / Switch directory, then open resume",
    handler: async (args, ctx) => { await commands?.command(args, ctx, "resume"); },
  });
  pi.registerCommand("cd-workspace", {
    description: "工作目录扩展语言与用法 / Workspace language and usage: lang zh|en",
    handler: async (args, ctx) => {
      if (!commands || ctx.mode !== "tui") return;
      const [name, value, ...rest] = args.trim().split(/\s+/);
      if (name !== "lang" || rest.length || (value !== undefined && !isLanguage(value))) {
        ctx.ui.notify(getMessages(language).usage, "info"); return;
      }
      if (!value) { ctx.ui.notify(getMessages(language).languageStatus, "info"); return; }
      language = value as Language;
      commands.redraw();
      const selected = language, directory = agentDir, current = generation, choice = ++languageGeneration;
      const live = () => current === generation && choice === languageGeneration && commands !== undefined;
      saving = saving.then(async () => {
        try { await saveLanguage(selected, directory); }
        catch (error) {
          if (live()) ctx.ui.notify(displayText(getMessages(selected).languageSaveFailed(describeError(error, selected))), "warning");
          return;
        }
        if (live()) ctx.ui.notify(getMessages(selected).languageSaved, "info");
      });
      await saving;
    },
  });
}
