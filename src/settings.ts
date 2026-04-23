import { App, PluginSettingTab, Setting } from 'obsidian';
import type LLMWikiPlugin from './main';

export interface LLMWikiSettings {
	repoRoot: string;
	containerName: string;
	imageName: string;
	wsPort: number;
}

export const DEFAULT_SETTINGS: LLMWikiSettings = {
	repoRoot: '',
	containerName: 'llm-wiki',
	imageName: 'llm-wiki',
	wsPort: 7681,
};

export class LLMWikiSettingTab extends PluginSettingTab {
	plugin: LLMWikiPlugin;

	constructor(app: App, plugin: LLMWikiPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();
		containerEl.createEl('h2', { text: 'LLM Wiki' });

		new Setting(containerEl)
			.setName('Vault path')
			.setDesc('Absolute path to the wiki vault. Leave empty to auto-detect.')
			.addText(text => text
				.setPlaceholder('Auto-detected')
				.setValue(this.plugin.settings.repoRoot)
				.onChange(async (value) => {
					this.plugin.settings.repoRoot = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Container name')
			.setDesc('Docker container name')
			.addText(text => text
				.setValue(this.plugin.settings.containerName)
				.onChange(async (value) => {
					this.plugin.settings.containerName = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Image name')
			.setDesc('Docker image tag to build and run')
			.addText(text => text
				.setValue(this.plugin.settings.imageName)
				.onChange(async (value) => {
					this.plugin.settings.imageName = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('WebSocket port')
			.setDesc('Port for the terminal WebSocket server inside the container (default: 7681)')
			.addText(text => text
				.setValue(String(this.plugin.settings.wsPort))
				.onChange(async (value) => {
					const port = parseInt(value, 10);
					if (!isNaN(port) && port > 0 && port < 65536) {
						this.plugin.settings.wsPort = port;
						await this.plugin.saveSettings();
					}
				}));
	}
}
