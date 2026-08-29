import { CloakAdapter } from "../../adapter/cloak/cloak.adapter";
import { TomlConfigAdapter } from "../../adapter/config/toml-config.adapter";
import { PrismAdapter } from "../../adapter/prism/prism.adapter";
import { FileStoreAdapter } from "../../adapter/store/file-store.adapter";
import type { StealthConfig } from "../../domain/config";
import type { EngineType } from "../../domain/launch";
import type { EnginePort } from "../../port/engine.port";
import type { ProfileStorePort } from "../../port/store.port";
import { launchProfile } from "../launcher/launcher";
import { ProfileManager } from "../profile/profile-manager";

function parseOption(args: string[], flag: string): string | undefined {
	const index = args.indexOf(flag);
	if (index >= 0 && index + 1 < args.length) {
		return args[index + 1];
	}
	return undefined;
}

export async function handleCliCommand(
	argv: string[],
	config: StealthConfig,
	store: ProfileStorePort,
	engines: Record<EngineType, EnginePort>,
): Promise<string> {
	const command = argv[0];
	if (!command) {
		throw new Error(
			"No command specified. Available: list, create, delete, launch-args, launch",
		);
	}

	const activeEngineType: EngineType =
		(process.env.STEALTH_ENGINE as EngineType) || config.engine;
	const engine = engines[activeEngineType];
	if (!engine) {
		throw new Error(`Engine '${activeEngineType}' is not supported`);
	}

	const pm = new ProfileManager(store, activeEngineType, config.defaults);

	switch (command) {
		case "list": {
			const profiles = await pm.list();
			return JSON.stringify(profiles);
		}

		case "create": {
			const remaining = argv.slice(1);
			const name = remaining.find((a) => !a.startsWith("--"));
			if (!name) {
				throw new Error("Profile name is required for create");
			}
			const timezone = parseOption(remaining, "--timezone");
			const language = parseOption(remaining, "--language");
			const proxy = parseOption(remaining, "--proxy");
			const result = await pm.create(name, { timezone, language, proxy });
			return JSON.stringify({
				success: true,
				name: result.name,
				engine: activeEngineType,
			});
		}

		case "delete": {
			const name = argv[1];
			if (!name) {
				throw new Error("Profile name is required for delete");
			}
			const success = await pm.delete(name);
			return JSON.stringify({ success });
		}

		case "launch-args": {
			const remaining = argv.slice(1);
			const name = parseOption(remaining, "--profile");
			const profile = name ? await pm.get(name) : null;
			if (name && !profile) {
				throw new Error(
					`Profile '${name}' not found for engine '${activeEngineType}'`,
				);
			}
			const p = profile || {
				name: "ephemeral",
				seed: 12345,
				timezone: config.defaults.timezone,
				language: config.defaults.language,
				acceptLanguages: config.defaults.acceptLanguages,
				screenWidth: config.defaults.screenWidth,
				screenHeight: config.defaults.screenHeight,
				createdAt: "",
				updatedAt: "",
			};
			const userDataDir = store.resolveUserDataDir(p.name, activeEngineType);
			const args = await engine.buildArgs({
				profile: p,
				engine: activeEngineType,
				userDataDir,
				incomingArgs: remaining.filter((a) => a !== "--profile" && a !== name),
			});
			return JSON.stringify(args);
		}

		case "launch": {
			const remaining = argv.slice(1);
			let targetProfile =
				process.env.PRISM_PROFILE || process.env.STEALTH_PROFILE;
			const profileOpt = parseOption(remaining, "--profile");
			if (profileOpt) {
				targetProfile = profileOpt;
			}

			const extraArgs = remaining.filter(
				(a) => a !== "--profile" && a !== targetProfile,
			);
			const result = await launchProfile(
				targetProfile,
				extraArgs,
				engine,
				store,
			);

			return new Promise<string>((resolve, reject) => {
				result.process.on("error", (err) => reject(err));
				result.process.on("exit", (code) => {
					if (code === 0) resolve(JSON.stringify({ success: true }));
					else reject(new Error(`Kernel exited with code ${code}`));
				});
			});
		}

		default: {
			throw new Error(`Unknown command '${command}'`);
		}
	}
}

async function main(): Promise<void> {
	const argv = process.argv.slice(2);
	try {
		const configAdapter = new TomlConfigAdapter();
		const config = await configAdapter.load();
		const store = new FileStoreAdapter(config.vaultRoot);
		const engines: Record<EngineType, EnginePort> = {
			prism: new PrismAdapter(config.engines.prism.binaryPath),
			cloak: new CloakAdapter(config.engines.cloak.binaryPath),
		};

		const output = await handleCliCommand(argv, config, store, engines);
		console.log(output);
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		console.error(`Error: ${message}`);
		process.exit(1);
	}
}

if (import.meta.main) {
	void main();
}
