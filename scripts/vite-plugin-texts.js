import { spawn } from 'node:child_process';
import path from 'node:path';

// Dev-only hot reload for the content pipeline: editing texts/*.md re-runs
// build.cjs and full-reloads the page, so text corrections show up
// immediately. Production builds are untouched (`node build.cjs` still runs
// first via the npm script).
export function textsHotReload() {
  let root = '';
  let running = null;
  let queued = false;

  function rebuild(server, file) {
    if (running) { queued = true; return; }
    const t0 = Date.now();
    running = spawn(process.execPath, ['build.cjs'], { cwd: root, stdio: ['ignore', 'ignore', 'pipe'] });
    let err = '';
    running.stderr.on('data', (d) => { err += d; });
    running.on('close', (code) => {
      running = null;
      if (code === 0) {
        server.config.logger.info(
          `texts: ${path.basename(file)} → data rebuilt in ${Date.now() - t0}ms, reloading`,
          { timestamp: true },
        );
        server.ws.send({ type: 'full-reload' });
      } else {
        // typical cause: invalid frontmatter mid-edit — keep serving old data
        server.config.logger.error(`texts: build.cjs failed (kept previous data)\n${err}`, { timestamp: true });
      }
      if (queued) { queued = false; rebuild(server, file); }
    });
  }

  return {
    name: 'texts-hot-reload',
    apply: 'serve',
    configResolved(config) { root = config.root; },
    configureServer(server) {
      server.watcher.add(path.join(root, 'texts'));
      server.watcher.on('change', (file) => {
        if (file.includes(`${path.sep}texts${path.sep}`) && file.endsWith('.md')) rebuild(server, file);
      });
      server.watcher.on('add', (file) => {
        if (file.includes(`${path.sep}texts${path.sep}`) && file.endsWith('.md')) rebuild(server, file);
      });
    },
  };
}
