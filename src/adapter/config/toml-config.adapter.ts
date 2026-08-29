import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import type { StealthConfig } from "../../domain/config";
import type { EngineType } from "../../domain/launch";
import type { ConfigPort } from "../../port/config.port";

function resolveStealthHome(): string {
	return process.env.STEALTH_HOME || join(homedir(), ".stealth");
}

export class TomlConfigAdapter implements ConfigPort {
	constructor(private readonly configPath?: string) {}

	async load(): Promise<StealthConfig> {
		const home = resolveStealthHome();
		const targetPath = this.configPath || join(home, "config.toml");

		let parsed: Record<string, unknown> = {};
		try {
			const content = await readFile(targetPath, "utf8");
			parsed = Bun.TOML.parse(content) as Record<string, unknown>;
		} catch {
			// Missing or unreadable config falls back directly to default SSOT specification
		}

		const engineRaw =
			typeof parsed.engine === "string" ? parsed.engine : "prism";
		const engine: EngineType = engineRaw === "cloak" ? "cloak" : "prism";

		const enginesObj = (
			parsed.engines && typeof parsed.engines === "object" ? parsed.engines : {}
		) as Record<string, { binary_path?: string }>;

		const defaultsObj = (
			parsed.defaults && typeof parsed.defaults === "object"
				? parsed.defaults
				: {}
		) as {
			fingerprint?: {
				timezone?: string;
				language?: string;
				accept_languages?: string;
				screen_width?: number;
				screen_height?: number;
			};
		};

		const fp = defaultsObj.fingerprint || {};

		return {
			engine,
			vaultRoot: join(home, "vault"),
			engines: {
				prism: {
					binaryPath:
						enginesObj.prism?.binary_path ||
						join(home, "engines/prism/current"),
				},
				cloak: {
					binaryPath:
						enginesObj.cloak?.binary_path ||
						join(home, "engines/cloak/current"),
				},
			},
			defaults: {
				timezone: fp.timezone || "Asia/Tokyo",
				language: fp.language || "en-US",
				acceptLanguages: fp.accept_languages || "en-US,en",
				screenWidth: fp.screen_width || 1440,
				screenHeight: fp.screen_height || 900,
			},
		};
	}
}
