/**
 * Concatenates xterm.js's required CSS with the plugin's own styles
 * into styles.css — the single CSS file Obsidian loads for the plugin.
 *
 * styles.css is a generated file. Edit src/plugin.css for custom styles.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = dirname(fileURLToPath(import.meta.url));

const xtermCss = readFileSync(join(dir, 'node_modules/@xterm/xterm/css/xterm.css'), 'utf8');
const pluginCss = readFileSync(join(dir, 'src/plugin.css'), 'utf8');

writeFileSync(
	join(dir, 'styles.css'),
	`/* generated — edit src/plugin.css for custom styles */\n\n${xtermCss}\n${pluginCss}`,
	'utf8'
);

console.log('styles.css updated (xterm.css + plugin.css)');
