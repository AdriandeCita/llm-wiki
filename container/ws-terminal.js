'use strict';

/**
 * WebSocket → PTY bridge.
 * Runs inside the Docker container; the Obsidian plugin connects to it
 * via ws://127.0.0.1:{WS_PORT} and gets a full PTY session.
 *
 * Protocol:
 *   server → client : raw terminal output (string)
 *   client → server : raw keyboard input (string)
 *   client → server : '\x01' + JSON  →  control message  { type: 'resize', cols, rows }
 */

const WebSocket = require('ws');
const pty = require('node-pty');

const PORT = parseInt(process.env.WS_PORT || '7681', 10);
const COMMAND = process.env.WS_COMMAND || 'claude';

const wss = new WebSocket.Server({ port: PORT, host: '0.0.0.0' });

console.log(`ws-terminal: listening on ws://0.0.0.0:${PORT}`);
console.log(`ws-terminal: each connection will run: ${COMMAND}`);

wss.on('connection', ws => {
  console.log('ws-terminal: client connected');

  const p = pty.spawn('/bin/bash', ['-c', `exec ${COMMAND}`], {
    name: 'xterm-256color',
    cols: 220,
    rows: 50,
    cwd: process.cwd(),
    env: {
      ...process.env,
      TERM: 'xterm-256color',
      FORCE_COLOR: '1',
      COLORTERM: 'truecolor',
    },
  });

  p.onData(data => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(data);
    }
  });

  p.onExit(({ exitCode }) => {
    console.log(`ws-terminal: process exited (code ${exitCode})`);
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(
        `\r\n\x1b[2m[Session ended (exit code ${exitCode}). Use the reconnect button to start a new session.]\x1b[0m\r\n`
      );
      ws.close();
    }
  });

  ws.on('message', data => {
    const str = data.toString();

    // Control messages are prefixed with SOH (\x01)
    if (str.charCodeAt(0) === 1) {
      try {
        const msg = JSON.parse(str.slice(1));
        if (msg.type === 'resize' && msg.cols > 0 && msg.rows > 0) {
          p.resize(msg.cols, msg.rows);
        }
      } catch {
        // ignore malformed control messages
      }
      return;
    }

    p.write(str);
  });

  ws.on('close', () => {
    console.log('ws-terminal: client disconnected');
    try { p.kill(); } catch { /* already exited */ }
  });

  ws.on('error', err => {
    console.error('ws-terminal: WebSocket error:', err.message);
    try { p.kill(); } catch { /* already exited */ }
  });
});

wss.on('error', err => {
  console.error('ws-terminal: server error:', err.message);
  process.exit(1);
});
