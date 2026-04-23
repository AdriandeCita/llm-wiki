import { exec, execSync } from 'child_process';
import { existsSync, mkdirSync, writeFileSync, readFileSync, createReadStream } from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import type { LLMWikiSettings } from './settings';

export class DockerManager {
	private readonly containerDir: string;

	constructor(private settings: LLMWikiSettings, pluginDir: string) {
		this.containerDir = path.join(pluginDir, 'container');
	}

	/** Create .claude/ dir and .claude.json in vaultPath if they don't exist. */
	ensureClaudeFiles(): void {
		const { repoRoot } = this.settings;
		const claudeDir = path.join(repoRoot, '.claude');
		const claudeJson = path.join(repoRoot, '.claude.json');
		if (!existsSync(claudeDir)) {
			mkdirSync(claudeDir, { recursive: true });
		}
		if (!existsSync(claudeJson)) {
			writeFileSync(claudeJson, '{}', 'utf8');
		}
	}

	/**
	 * Check if the Dockerfile has changed since the last build.
	 * If so, rebuild the image and update .build-hash.
	 */
	async ensureImageBuilt(onProgress: (msg: string) => void): Promise<void> {
		const { imageName } = this.settings;
		const dockerfilePath = path.join(this.containerDir, 'Dockerfile');
		const hashFilePath = path.join(this.containerDir, '.build-hash');

		if (!existsSync(dockerfilePath)) {
			onProgress(`LLM Wiki: Dockerfile not found at ${dockerfilePath}. Check the plugin directory.`);
			return;
		}

		const currentHash = await this.hashFile(dockerfilePath);
		let storedHash = '';
		if (existsSync(hashFilePath)) {
			storedHash = readFileSync(hashFilePath, 'utf8').trim();
		}

		if (currentHash === storedHash) return;

		onProgress(`LLM Wiki: Building Docker image '${imageName}'… (this may take a few minutes)`);

		const uid = typeof (process as NodeJS.Process & { getuid?: () => number }).getuid === 'function'
			? (process as NodeJS.Process & { getuid: () => number }).getuid()
			: 1000;
		const gid = typeof (process as NodeJS.Process & { getgid?: () => number }).getgid === 'function'
			? (process as NodeJS.Process & { getgid: () => number }).getgid()
			: 1000;

		const cmd = `docker build -t "${imageName}" --build-arg HOST_UID=${uid} --build-arg HOST_GID=${gid} "${this.containerDir}"`;

		await new Promise<void>((resolve, reject) => {
			exec(cmd, (err) => {
				if (err) {
					reject(new Error(`Docker build failed: ${err.message}`));
					return;
				}
				writeFileSync(hashFilePath, currentHash, 'utf8');
				onProgress(`LLM Wiki: Image '${imageName}' built successfully.`);
				resolve();
			});
		});
	}

	async isContainerRunning(): Promise<boolean> {
		const { containerName } = this.settings;
		return new Promise(resolve => {
			exec(
				`docker ps --filter "name=^${containerName}$" --format "{{.Names}}"`,
				(err, stdout) => resolve(!err && stdout.trim() === containerName)
			);
		});
	}

	/**
	 * Start the container detached, running the WebSocket terminal server.
	 * Port is mapped to localhost only for security.
	 */
	async startContainer(): Promise<void> {
		if (await this.isContainerRunning()) return;

		const { repoRoot, containerName, imageName, wsPort } = this.settings;
		const claudeDir = path.join(repoRoot, '.claude');
		const claudeJson = path.join(repoRoot, '.claude.json');

		const cmd = [
			'docker run -d --rm',
			`--name "${containerName}"`,
			`-p 127.0.0.1:${wsPort}:${wsPort}`,
			`-v "${repoRoot}:/wiki"`,
			`-v "${claudeDir}:/home/wiki/.claude"`,
			`-v "${claudeJson}:/home/wiki/.claude.json"`,
			`"${imageName}"`,
			'node /opt/ws-terminal/ws-terminal.js',
		].join(' ');

		await new Promise<void>((resolve, reject) => {
			exec(cmd, (err, _stdout, stderr) => {
				if (err) {
					reject(new Error(`Failed to start container: ${err.message}\n${stderr}`));
					return;
				}
				resolve();
			});
		});
	}

	/** Stop the container synchronously. Called from onunload() which cannot await. */
	/** Graceful stop — used when the plugin is deactivated from settings. */
	stopContainerSync(): void {
		try {
			execSync(`docker stop --time 5 "${this.settings.containerName}"`, {
				stdio: 'ignore',
				timeout: 8000,
			});
		} catch {
			// container may already be stopped or docker may not be running
		}
	}

	/** Instant kill — used on window close where there is no time for a graceful stop. */
	killContainerSync(): void {
		try {
			execSync(`docker kill "${this.settings.containerName}"`, {
				stdio: 'ignore',
				timeout: 3000,
			});
		} catch {
			// container may already be stopped or docker may not be running
		}
	}

	private hashFile(filePath: string): Promise<string> {
		return new Promise((resolve, reject) => {
			const hash = crypto.createHash('sha256');
			const stream = createReadStream(filePath);
			stream.on('data', (chunk) => hash.update(chunk));
			stream.on('end', () => resolve(hash.digest('hex')));
			stream.on('error', reject);
		});
	}
}
