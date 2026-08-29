import { describe, expect, it } from "bun:test";
import { TomlConfigAdapter } from "./toml-config.adapter";

describe("Adapter: TomlConfigAdapter", () => {
	it("loads configuration with defaults when toml is missing or empty", async () => {
		const adapter = new TomlConfigAdapter(
			"/tmp/stealth-non-existent-config.toml",
		);
		const config = await adapter.load();

		expect(config.engine).toBe("prism");
		expect(config.defaults.timezone).toBe("Asia/Tokyo");
		expect(config.defaults.language).toBe("en-US");
		expect(config.engines.prism.binaryPath).toContain("engines/prism/current");
		expect(config.engines.cloak.binaryPath).toContain("engines/cloak/current");
	});
});
