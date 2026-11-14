# Safe workspace switching / 安全切换宿主补丁

`pi-1.5.2-workspace-switch.patch` targets **Pi v1.5.2**, commit
`b4afdddf44e059c67ccf5097e5317d913521b470` in <https://github.com/earendil-works/pi>.
It contains host runtime changes only, no tests or generated artifacts. It is not an upstream release.

此补丁针对上述固定版本，尚非上游发布功能。扩展不会自动应用补丁或改写当前 Pi 安装。
未经补丁的宿主仍可加载扩展和设置语言，但三个目录命令会明确拒绝执行；不能只按版本号判断安全接口是否存在。

## Why / 原因

- `ctx.isIdle()` does not include user shell commands. Replacing that session could abort a running job.
- Copying a session before `session_before_switch` / `session_shutdown` misses state saved by those hooks.

补丁暴露 shell 忙碌状态，并在替换前预留空闲会话；运行中的 shell（含异步 `user_bash` 回调）不会被目录命令取消。
`/cd` 的最终快照在所有关闭钩子完成后、目标加载前同步写入，包含钩子保存的条目。

## Apply to a separate checkout / 在独立源码应用

Use a **new** directory, not the current Pi installation or a shared worktree with pending changes.
Set `EXTENSION` to this extension's absolute path. Do not apply the patch twice.

```bash
EXTENSION=/absolute/path/to/pi-cd-workspace
git clone --branch v1.5.2 --depth 1 https://github.com/earendil-works/pi.git pi-workspace-host
cd pi-workspace-host
git rev-parse HEAD  # must match b4afdddf44e059c67ccf5097e5317d913521b470
git apply --check "$EXTENSION/patches/pi-1.5.2-workspace-switch.patch"
git apply "$EXTENSION/patches/pi-1.5.2-workspace-switch.patch"
npm ci --ignore-scripts
```

Pi's checkout does not contain its generated model values. Copy a valid catalog from a Pi install or unpack
`@earendil-works/pi-ai@1.5.2` into a temporary directory, then copy `package/dist/providers/data/` to
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
Build once after applying the patch; `/reload` alone cannot update the host runtime.

构建后运行独立宿主，不覆盖全局安装。只 `/reload` 扩展不能让未打补丁的宿主获得新接口。

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

`/cd` 先保留一个私有恢复快照，再使用同目录 `0600` 临时文件原子替换最终快照；失败时保留原会话和已有快照。
新建模式故意不复制旧状态。确认新会话接管后才归档原会话；提示保留正常换行，路径和错误中的控制字符仍会转义。

## Verification / 验证记录

- Source and test type checks; 112 local tests on SDK 1.4.0 / 1.5.0 / 1.5.2. Switching mocks implement the new contract;
  separate real-runtime checks confirm that unpatched hosts refuse all directory commands while language settings still work.
  The 1.4.0 co-load check uses the archived 1.4-compatible sidebar, not the newer sidebar requiring 1.5.
- Patched host: `npm run check`, `npm run build:offline`, and 187 targeted tests passed, including 11 local safety/integration cases.
  Ten upstream tree-navigation API tests were skipped without credentials. RPC tests pass but emit listener-count warnings from
  repeated RPC startup in their fixture; this patch does not change that setup. No model API calls were made.
- The patch applies cleanly to the pinned commit and reproduces the seven edited host source files byte-for-byte.
- The 17-file npm package contains the patch/docs and no tests or dependencies. The unpacked extension loads independently,
  co-loads with the sidebar in either order, and passes the offline patched-runtime integration checks.

## Limits / 限制

This is a lifecycle boundary, not rollback after a fatal host error. Once shutdown has begun, the old runtime may be disposed;
a factory/finalization failure may terminate the TUI. Recovery files remain, but automatic UI recovery is not promised.
After a crash, inspect `.cd-pending*` / `.cd-abandoned` files before removing them. Unawaited work started by another extension
is not a completed shutdown save. Do not run two Pi processes that both write the same session file.

真实人工终端验收仍待完成；本地验证使用内存终端、离线真实宿主和独立临时会话，包括一个真实子 shell。
测试仅在本地保留，不包含在补丁、Git 提交或 npm 包中。
