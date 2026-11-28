# Optional safe-switch host patch / 可选安全切换宿主补丁

`pi-1.7.0-workspace-switch.patch` targets **Pi v1.7.0**, commit `fb0fe823539f6d04850f6e34748c01f01f212e1f` in <https://github.com/earendil-works/pi>. The patch changes only host runtime code and is not an upstream release.

该补丁仅面向上述固定的 Pi v1.7.0 提交。原版 Pi 1.7.0 及以上仍可直接使用扩展，不需要补丁。

**Optional, not installed by default.** Installing or reloading the extension never applies this patch.
Stock Pi keeps the original directory-switching behavior; missing patch APIs do not block any directory command.
Only follow the build steps below if you choose the additional shell and shutdown-snapshot safeguards.

**此补丁可选，默认不安装。** 扩展不会自动应用补丁或改写当前 Pi 安装。没有补丁时，三个目录命令按原逻辑执行；
手动使用带补丁的宿主后，才会自动使用增强接口。此补丁尚非上游功能，不要应用于未列出的版本。

## Why / 原因

- `ctx.isIdle()` does not include user shell commands. Replacing that session could abort a running job.
- Copying a session before `session_before_switch` / `session_shutdown` misses state saved by those hooks.

These are known limits of the original flow, not installation requirements. Without the patch, wait for shell work
before switching; late shutdown saves may exist only in the source backup. The commands remain available.

补丁暴露 shell 忙碌状态，并在替换前预留空闲会话；运行中的 shell（含异步 `user_bash` 回调）不会被目录命令取消。
`/cd` 的最终快照在所有关闭钩子完成后、目标加载前同步写入，包含钩子保存的条目。

## Optional: apply to a separate checkout / 可选：在独立源码应用

Use a **new** directory, not the current Pi installation or a shared worktree with pending changes.
Set `EXTENSION` to this extension's absolute path and check the pinned commit below. Do not apply the patch twice.

```bash
EXTENSION=/absolute/path/to/pi-cd-workspace
PI_VERSION=1.7.0
git clone --branch "v$PI_VERSION" --depth 1 https://github.com/earendil-works/pi.git pi-workspace-host
cd pi-workspace-host
git rev-parse HEAD  # must match the pinned commit above
git apply --check "$EXTENSION/patches/pi-1.7.0-workspace-switch.patch"
git apply "$EXTENSION/patches/pi-1.7.0-workspace-switch.patch"
npm ci --ignore-scripts
```

Pi's checkout does not contain its generated model values. Copy the matching version's catalog from a Pi install or unpack
`@earendil-works/pi-ai@$PI_VERSION` into a temporary directory, then copy `package/dist/providers/data/` to
`packages/ai/src/providers/data/`. Include `.manifest.json`. Do not edit the generated TypeScript wrappers.
Alternatively, `npm run hydrate:model-data` fetches upstream catalogs (requires network; values may change).

Pi 源码不含被忽略的模型数据。需按上段补齐（包括隐藏 manifest），然后检查和构建；不要为此修改系统代理。

```bash
npm run check:model-data
npm run build:offline
npm run check

# Run a separate instance with isolated settings/sessions, no installed extensions.
# 在独立终端中自行运行；不要用活动会话测试失败恢复。
AGENT_DIR=$(mktemp -d /tmp/pi-workspace-agent.XXXXXX)
PI_CODING_AGENT_DIR="$AGENT_DIR" node packages/coding-agent/dist/cli.js \
  --no-extensions -e "$EXTENSION/extensions/index.ts" --tui-mode fullscreen
```

This builds and runs the separate checkout. No global installation, symlink, or running process is replaced.
Build once after applying the patch; `/reload` alone cannot update the host runtime. None of these steps are needed for stock Pi.

构建后运行独立宿主，不覆盖全局安装。只 `/reload` 扩展不能获得新接口，但原版 Pi 无需以上步骤即可使用目录命令。

## API contract / 接口约定

- `ctx.isBashRunning?()` includes local/custom shell execution and pending `user_bash` handlers.
- `ctx.switchSessionWhenIdle?(path, { prepareSnapshot?, withSession? })` is present only if the mode/adapter implements it.
  It returns `{ cancelled: true }` without interrupting work if it cannot reserve an idle session or a before-switch hook vetoes it.
- `prepareSnapshot(source)` is **synchronous**. Use only the supplied read-only session manager; do not capture the old `ctx` or `pi`,
  start work, return a promise, or retain `source`. Write the destination before returning. Its session ID and cwd must not change.
- `ctx.newSession({ requireIdle: true })` uses the same reservation for same-directory fresh sessions.
  Detect `switchSessionWhenIdle` as well: old hosts can silently ignore an unknown option.
- Reservations reject new prompts, shells, compaction, tree navigation and reload until cancellation or replacement.
  Saving extension entries during shutdown remains allowed. Ordinary native switches without the guard keep their existing behavior.

增强模式下，`/cd` 先保留一个私有恢复快照，再使用同目录 `0600` 临时文件原子替换最终快照；失败时保留原会话和已有快照。
没有增强接口时只调用原 `switchSession(path, { withSession })` / `newSession()`，不传补丁专属选项。
新建模式故意不复制旧状态。两种流程的 `/cd` 都在确认新会话接管后才归档原会话；提示保留正常换行，路径和错误中的控制字符仍会转义。

## Verification / 验证记录

- Tested on stock Pi 1.7.0 and the patched v1.7.0 checkout. The patch passed the offline build and 96 focused tests, including a running child shell, a final snapshot after shutdown hooks, and the session replacement lifecycle.
- The npm package contains only extension source, documentation and the optional patch; no test code or generated Pi build.

## Limits / 限制

This is a lifecycle boundary, not rollback after a fatal host error. Once shutdown has begun, the old runtime may be disposed;
a factory/finalization failure may terminate the TUI. Recovery files remain, but automatic UI recovery is not promised.
After a crash, inspect `.cd-pending*` / `.cd-abandoned` files before removing them. Unawaited work started by another extension
is not a completed shutdown save. Do not run two Pi processes that both write the same session file.

真实人工终端验收仍待完成；本地验证使用内存终端、离线真实宿主和独立临时会话，包括一个真实子 shell。
测试仅在本地保留，不包含在补丁、Git 提交或 npm 包中。
