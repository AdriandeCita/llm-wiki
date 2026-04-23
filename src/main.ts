import { Notice, Plugin, WorkspaceLeaf } from 'obsidian';
import { readFileSync } from 'fs';
import * as path from 'path';
import { DEFAULT_SETTINGS, LLMWikiSettings, LLMWikiSettingTab } from './settings';
import { DockerManager } from './docker';
import { TERMINAL_VIEW_TYPE, TerminalView } from './terminal-view';

export default class LLMWikiPlugin extends Plugin {
	settings: LLMWikiSettings;
	docker: DockerManager;
	pluginDir: string;

	// Registered manually (not via registerDomEvent) so it outlives onunload,
	// which Obsidian may call before beforeunload fires during window close.
	private readonly beforeUnloadHandler = () => this.docker?.killContainerSync();

	async onload(): Promise<void> {
		await this.loadSettings();

		const vaultPath = (this.app.vault.adapter as any).getBasePath() as string;

		// Auto-detect vault path
		if (!this.settings.repoRoot) {
			this.settings.repoRoot = vaultPath;
		}

		this.pluginDir = path.join(vaultPath, this.manifest.dir ?? `.obsidian/plugins/${this.manifest.id}`);
		this.docker = new DockerManager(this.settings, this.pluginDir);

		this.registerView(
			TERMINAL_VIEW_TYPE,
			(leaf: WorkspaceLeaf) => new TerminalView(leaf, this)
		);

		this.addRibbonIcon('terminal', 'Open LLM Wiki agent', () => {
			this.openTerminal();
		});

		this.addCommand({
			id: 'open-terminal',
			name: 'Open agent terminal',
			callback: () => this.openTerminal(),
		});

		this.addSettingTab(new LLMWikiSettingTab(this.app, this));

		window.addEventListener('beforeunload', this.beforeUnloadHandler);

		this.app.workspace.onLayoutReady(async () => {
			try {
				await this.ensureVaultFolders();
				this.docker.ensureClaudeFiles();
				await this.docker.ensureImageBuilt(msg => new Notice(msg, 10000));
				await this.docker.startContainer();
				await this.openTerminal();
			} catch (e) {
				new Notice(`LLM Wiki: ${(e as Error).message}`, 15000);
				console.error('LLM Wiki startup error:', e);
			}
		});
	}

	onunload(): void {
		window.removeEventListener('beforeunload', this.beforeUnloadHandler);
		this.docker?.stopContainerSync();
	}

	/** Create inbox/, raw/, artifacts/ and seed CLAUDE.md if they don't exist. */
	private async ensureVaultFolders(): Promise<void> {
		for (const folder of ['inbox', 'raw', 'artifacts']) {
			if (!(await this.app.vault.adapter.exists(folder))) {
				await this.app.vault.createFolder(folder);
			}
		}

		if (!(await this.app.vault.adapter.exists('CLAUDE.md'))) {
			const template = readFileSync(
				path.join(this.pluginDir, 'container', 'CLAUDE.md'),
				'utf8'
			);
			await this.app.vault.create('CLAUDE.md', template);
		}
	}

	async openTerminal(): Promise<void> {
		const existing = this.app.workspace.getLeavesOfType(TERMINAL_VIEW_TYPE);
		const existingLeaf = existing[0];
		if (existingLeaf) {
			this.app.workspace.revealLeaf(existingLeaf);
			return;
		}
		// Open as a horizontal split (terminal below the current content)
		const leaf = this.app.workspace.getLeaf('split', 'horizontal');
		if (!leaf) return;
		await leaf.setViewState({ type: TERMINAL_VIEW_TYPE, active: true });
		this.app.workspace.revealLeaf(leaf);
	}

	async loadSettings(): Promise<void> {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData() as Partial<LLMWikiSettings>);
	}

	async saveSettings(): Promise<void> {
		await this.saveData(this.settings);
	}
}
