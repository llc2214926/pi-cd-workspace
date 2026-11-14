export type Language = "zh" | "en";

export function isLanguage(value: unknown): value is Language {
  return value === "zh" || value === "en";
}

const zh = {
  usage: "用法：/cd [URI编码路径] 保留会话；/cd-new [URI编码路径] 新会话；/cd-resume [URI编码路径] 恢复会话；/cd-workspace lang [zh|en] 切换或查看语言",
  languageStatus: "工作目录扩展语言：中文（zh）；/cd-workspace lang zh|en 切换",
  languageSaved: "工作目录扩展语言：中文（已保存）",
  languageLoadFailed: (error: string) => `无法加载工作目录扩展语言，暂用中文：${error}`,
  languageSaveFailed: (error: string) => `无法保存工作目录扩展语言，本次选择仍有效：${error}`,
  switch: {
    switching: (source: string, destination: string) => `正在切换工作目录…\n原会话：${source}\n目标会话副本：${destination}`,
    starting: (source: string, destination: string) => `正在切换工作目录并新建空会话…\n原会话（保留）：${source}\n目标新会话：${destination}`,
    started: (dir: string) => `已在工作目录新建空会话：${dir}`,
    done: (dir: string) => `工作目录已切换：${dir}`,
    cancelled: "已取消切换工作目录",
    failed: (error: string) => `切换失败：${error}`,
    recovery: (source: string, destination: string) => `原会话：${source}\n目标会话：${destination}\n已保留可用文件。若旧 UI 已销毁，请重启 Pi 并用 --session 指定原会话路径恢复。`,
    abandoned: (path: string) => `未接管的目标会话已移至：${path}`,
    abandonFailed: (path: string, error: string) => `无法标记未接管会话：${path}；${error}。文件仍保留，请手动处理。`,
    archiveFailed: (path: string, error: string) => `已切换，但旧会话归档失败（原路径 ${path}）：${error}`,
    sourceRetained: (source: string, backup: string) => `跨文件系统备份：${backup}；原文件仍保留：${source}`,
    draftFailed: (error: string) => `已切换，但草稿恢复失败：${error}`,
  },
  tooltip: { fullName: "完整名称", footer: "[/] 翻页 · 滚轮" },
  picker: {
    title: "切换工作目录",
    compactFooter: "Enter选目录 · Esc",
    hidden: "（含隐藏项）",
    footer: (hidden: boolean) => `↑↓/jk选择（↑↓长按加速） · ←返回 · →/l进入 · .${hidden ? "隐藏" : "显示"}隐藏项 · r工作区 · Enter选目录 · Esc取消 · 单击：文件仅选中，目录进入 · 滚轮滚动本栏`,
    self: ".（选定当前目录）",
    emptyDirectory: "（无可见项目）",
    directoryError: (code?: string) => `（读取失败${code ? `：${code}` : ""}）`,
    loading: "读取中…",
  },
  errors: {
    agentBusy: "Agent、shell 或待发送消息尚未完成；请等待后重试",
    hostUpgradeRequired: "此 Pi 缺少安全切换接口；请使用带 patches/pi-1.5.2-workspace-switch.patch 的宿主。未切换会话。",
    hostBusy: "主界面正忙或被模态占用；请返回主输入框后重试",
    switchBusy: "工作目录切换进行中，请稍后",
    switchTuiOnly: "目录切换需要 Pi >=1.4.0 交互式 TUI",
    resumeUnavailable: "无法调用宿主原生会话列表；请返回主输入框后直接使用 /resume",
    targetNotDirectory: "目标路径不是目录",
    sameDirectory: "目标目录与当前相同，无需切换",
    sessionNotPersisted: "当前会话未启用持久化，不能自动切换续接",
    sessionHeaderMissing: "当前会话缺少有效的会话头",
    sessionNameCollision: "目标会话文件连续重名，请稍后重试",
    sessionTakeoverFailed: "目标会话未正确接管，原会话文件已保留",
    invalidCdPath: "路径必须使用 encodeURIComponent 编码；无参数可打开目录选择器",
    languageSettingsInvalid: "cd-workspace.json 无效；需要 JSON 对象和 language: zh 或 en",
    languageSettingsNotFile: "cd-workspace.json 必须是普通文件，不能使用符号链接",
    languageSettingsLarge: "cd-workspace.json 超过 16 KiB 上限",
  },
};

// 中英文字段和参数签名保持一致。
const en: typeof zh = {
  usage: "Usage: /cd [URI-encoded-path] keeps the session; /cd-new [URI-encoded-path] starts fresh; /cd-resume [URI-encoded-path] opens resume; /cd-workspace lang [zh|en] sets or shows the language",
  languageStatus: "Workspace language: English (en); switch with /cd-workspace lang zh|en",
  languageSaved: "Workspace language: English (saved)",
  languageLoadFailed: (error) => `Could not load workspace language; using Chinese: ${error}`,
  languageSaveFailed: (error) => `Could not save workspace language; this selection still applies for now: ${error}`,
  switch: {
    switching: (source, destination) => `Switching working directory…\nOriginal session: ${source}\nTarget session copy: ${destination}`,
    starting: (source, destination) => `Switching working directory with a new empty session…\nOriginal session (kept): ${source}\nNew target session: ${destination}`,
    started: (dir) => `Started a new empty session in: ${dir}`,
    done: (dir) => `Working directory switched: ${dir}`,
    cancelled: "Cancelled switching working directory",
    failed: (error) => `Switch failed: ${error}`,
    recovery: (source, destination) => `Original session: ${source}\nTarget session: ${destination}\nAvailable files are preserved. If the old UI was destroyed, restart Pi with --session pointing to the original file.`,
    abandoned: (path) => `Unclaimed target session moved to: ${path}`,
    abandonFailed: (path, error) => `Could not mark unclaimed session: ${path}; ${error}. File preserved; handle it manually.`,
    archiveFailed: (path, error) => `Switched, but old session archive failed (original path ${path}): ${error}`,
    sourceRetained: (source, backup) => `Cross-filesystem backup: ${backup}; original file retained: ${source}`,
    draftFailed: (error) => `Switched, but could not restore the draft: ${error}`,
  },
  tooltip: { fullName: "Full name", footer: "[/] page · wheel" },
  picker: {
    title: "Select working directory",
    compactFooter: "Enter directory · Esc",
    hidden: " (with hidden)",
    footer: (hidden) => `↑↓/jk select (hold ↑↓ to speed up) · ← back · →/l enter · . ${hidden ? "hide" : "show"} hidden · r workspace · Enter directory · Esc cancel · click: select file / enter directory · wheel scrolls column`,
    self: ". (select current directory)",
    emptyDirectory: "(no visible items)",
    directoryError: (code) => `(read failed${code ? `: ${code}` : ""})`,
    loading: "Loading…",
  },
  errors: {
    agentBusy: "Agent, shell, or queued messages are still active; wait before retrying",
    hostUpgradeRequired: "This Pi lacks safe session switching. Use a host with patches/pi-1.5.2-workspace-switch.patch. No session was switched.",
    hostBusy: "The host is busy or a modal is open; return to the main editor and retry",
    switchBusy: "A working directory switch is already in progress",
    switchTuiOnly: "Directory switching requires Pi >=1.4.0 interactive TUI",
    resumeUnavailable: "The native session picker is unavailable; return to the main editor and run /resume directly",
    targetNotDirectory: "The target path is not a directory",
    sameDirectory: "The target directory is the current directory; no switch needed",
    sessionNotPersisted: "Session persistence is disabled; cannot switch and continue automatically",
    sessionHeaderMissing: "The current session has no valid header",
    sessionNameCollision: "Too many target session filename collisions; retry later",
    sessionTakeoverFailed: "The target session did not take over correctly; the original file is preserved",
    invalidCdPath: "Encode the path with encodeURIComponent, or omit it to open the directory picker",
    languageSettingsInvalid: "Invalid cd-workspace.json; expected a JSON object with language: zh or en",
    languageSettingsNotFile: "cd-workspace.json must be a regular file, not a symlink",
    languageSettingsLarge: "cd-workspace.json exceeds the 16 KiB limit",
  },
};

export function getMessages(language: Language) {
  return language === "en" ? en : zh;
}

export class WorkspaceError extends Error {
  constructor(readonly code: keyof typeof zh.errors) {
    super(zh.errors[code]);
    this.name = "WorkspaceError";
  }
}

export function describeError(error: unknown, language: Language): string {
  return error instanceof WorkspaceError ? getMessages(language).errors[error.code]
    : error instanceof Error ? error.message : String(error);
}
