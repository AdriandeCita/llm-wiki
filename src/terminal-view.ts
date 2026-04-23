import { ItemView, Menu, WorkspaceLeaf } from 'obsidian';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import type LLMWikiPlugin from './main';

export const TERMINAL_VIEW_TYPE = 'llm-wiki-terminal';

export class TerminalView extends ItemView {
	private terminal: Terminal | null = null;
	private fitAddon: FitAddon | null = null;
	private ws: WebSocket | null = null;
	private resizeObserver: ResizeObserver | null = null;
	private plugin: LLMWikiPlugin;

	constructor(leaf: WorkspaceLeaf, plugin: LLMWikiPlugin) {
		super(leaf);
		this.plugin = plugin;
	}

	getViewType(): string { return TERMINAL_VIEW_TYPE; }
	getDisplayText(): string { return 'LLM Wiki agent'; }
	getIcon(): string { return 'terminal'; }

	async onOpen(): Promise<void> {
		// Add a reconnect button to the panel header
		this.addAction('refresh-cw', 'Reconnect', () => {
			this.ws?.close();
			this.terminal?.writeln('\r\n\x1b[2mReconnecting…\x1b[0m');
			this.connectWebSocket();
		});

		const container = this.containerEl.children[1] as HTMLElement;
		container.empty();
		container.setCssStyles({ padding: '0', overflow: 'hidden', position: 'relative' });

		const termEl = container.createDiv({ cls: 'llm-wiki-terminal' });

		this.fitAddon = new FitAddon();
		this.terminal = new Terminal({
			theme: {
				background: '#1e1e2e',
				foreground: '#cdd6f4',
				cursor: '#f5e0dc',
				selectionBackground: '#45475a',
			},
			fontFamily: '"Cascadia Code", "JetBrains Mono", "Fira Code", "SF Mono", monospace',
			fontSize: 13,
			convertEol: true,
			cursorBlink: true,
			scrollback: 5000,
		});

		this.terminal.loadAddon(this.fitAddon);
		this.terminal.open(termEl);

		// Ctrl+Shift+C → copy selection to clipboard
		// Ctrl+Shift+V → paste from clipboard
		// Returning false prevents xterm from handling the key itself.
		this.terminal.attachCustomKeyEventHandler((e: KeyboardEvent) => {
			if (e.type !== 'keydown') return true;
			if (e.ctrlKey && e.shiftKey && e.code === 'KeyC') {
				const sel = this.terminal?.getSelection();
				if (sel) navigator.clipboard.writeText(sel).catch(() => {});
				return false;
			}
			if (e.ctrlKey && e.shiftKey && e.code === 'KeyV') {
				navigator.clipboard.readText().then(text => {
					if (this.ws?.readyState === WebSocket.OPEN) this.ws?.send(text);
				}).catch(() => {});
				return false;
			}
			return true;
		});

		// Right-click context menu for copy / paste
		termEl.addEventListener('contextmenu', (e: MouseEvent) => {
			e.preventDefault();
			const menu = new Menu();
			menu.addItem(item => item
				.setTitle('Copy')
				.setIcon('copy')
				.onClick(() => {
					const sel = this.terminal?.getSelection();
					if (sel) navigator.clipboard.writeText(sel).catch(() => {});
				}));
			menu.addItem(item => item
				.setTitle('Paste')
				.setIcon('clipboard-paste')
				.onClick(async () => {
					const text = await navigator.clipboard.readText().catch(() => '');
					if (text && this.ws?.readyState === WebSocket.OPEN) this.ws.send(text);
				}));
			menu.showAtMouseEvent(e);
		});

		// Stop Obsidian from consuming mousedown events meant for xterm's selection.
		// Without this, dragging to select text can be interrupted by Obsidian's
		// pane-resize and drag handlers.
		termEl.addEventListener('mousedown', (e: MouseEvent) => e.stopPropagation());

		// Allow layout to settle before fitting
		setTimeout(() => this.fitAddon?.fit(), 50);

		this.resizeObserver = new ResizeObserver(() => {
			this.fitAddon?.fit();
			this.sendResize();
		});
		this.resizeObserver.observe(termEl);

		// Register keyboard input handler once (reused across reconnects)
		this.terminal.onData(data => {
			if (this.ws?.readyState === WebSocket.OPEN) {
				this.ws.send(data);
			}
		});

		this.connectWebSocket();
	}

	async onClose(): Promise<void> {
		this.resizeObserver?.disconnect();
		this.resizeObserver = null;
		this.ws?.close();
		this.ws = null;
		this.terminal?.dispose();
		this.terminal = null;
	}

	private connectWebSocket(retries = 8, delayMs = 1000): void {
		const { wsPort } = this.plugin.settings;
		const url = `ws://127.0.0.1:${wsPort}`;

		if (retries === 8) {
			this.terminal?.writeln(`\x1b[2mConnecting to ${url}…\x1b[0m`);
		}

		const ws = new WebSocket(url);
		this.ws = ws;

		ws.onopen = () => {
			// Erase the "Connecting…" line
			this.terminal?.write('\x1b[1A\x1b[2K');
			this.sendResize();
		};

		ws.onmessage = (event) => {
			this.terminal?.write(event.data as string);
		};

		ws.onerror = () => {
			// Let onclose handle the retry logic
		};

		ws.onclose = () => {
			if (ws !== this.ws) return; // stale connection, ignore

			if (retries > 0) {
				// Show a dot for each retry attempt
				this.terminal?.write('.');
				setTimeout(() => {
					if (this.ws === ws || this.ws === null) {
						this.connectWebSocket(retries - 1, delayMs);
					}
				}, delayMs);
				return;
			}

			this.terminal?.writeln(
				`\r\n\x1b[31mCould not connect to ${url}\x1b[0m\r\n` +
				'\x1b[2mIs Docker running? Check the browser console for details.\x1b[0m\r\n' +
				'\x1b[2mUse the ↺ button in the panel header to retry.\x1b[0m'
			);
		};
	}

	private sendResize(): void {
		if (this.ws?.readyState === WebSocket.OPEN && this.terminal) {
			this.ws.send('\x01' + JSON.stringify({ type: 'resize', cols: this.terminal.cols, rows: this.terminal.rows }));
		}
	}
}
