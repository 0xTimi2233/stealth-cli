import { TomlConfigAdapter } from "../../adapter/config/toml-config.adapter";
import type { StealthConfig } from "../../domain/config";

export async function resolveAppConfig(
	customConfigPath?: string,
): Promise<StealthConfig> {
	const adapter = new TomlConfigAdapter(customConfigPath);
	return adapter.load();
}
