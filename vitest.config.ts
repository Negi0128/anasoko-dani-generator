import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    // worker_threads has been observed to crash (access violation) on
    // process exit after tests that exercise yauzl/zlib + better-sqlite3
    // together (large zip extraction). Forked child processes tear down
    // cleanly instead.
    pool: 'forks',
    // .claude holds agent worktrees — full copies of this repo whose test
    // files would otherwise be collected and run alongside the real ones.
    exclude: ['**/node_modules/**', '**/dist/**', '**/out/**', '**/.claude/**']
  }
})
