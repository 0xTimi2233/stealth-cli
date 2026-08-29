import { describe, expect, it } from "bun:test";
import { createProfileEntity } from "../../domain/profile";
import type { EnginePort } from "../../port/engine.port";
import type { ProfileStorePort } from "../../port/store.port";
import { launchProfile } from "./launcher";

describe("Feature: Launcher", () => {
	it("coordinates store and engine port to build request and launch process", async () => {
		const fakeProfile = createProfileEntity("test-account");

		const mockStore: ProfileStorePort = {
			resolveUserDataDir: (name, engine) =>
				`/vault/${engine}/profiles/${name}/user-data`,
			get: async (name) => (name === "test-account" ? fakeProfile : null),
			list: async () => [fakeProfile],
			save: async () => {},
			delete: async () => true,
		};

		let capturedRequest: unknown = null;

		const mockEngine: EnginePort = {
			name: "prism",
			getKernelPath: () => "/bin/fake-kernel",
			buildArgs: async (req) => {
				capturedRequest = req;
				return ["--fake-arg", ...req.incomingArgs];
			},
			launch: async (req) => {
				capturedRequest = req;
				return {
					engine: "prism",
					process: {} as never,
					pid: 1234,
					userDataDir: req.userDataDir,
					effectiveArgs: ["--fake-arg", ...req.incomingArgs],
				};
			},
		};

		const result = await launchProfile(
			"test-account",
			["--remote-debugging-pipe"],
			mockEngine,
			mockStore,
		);

		expect(result.pid).toBe(1234);
		expect(result.engine).toBe("prism");
		expect(capturedRequest?.userDataDir).toBe(
			"/vault/prism/profiles/test-account/user-data",
		);
		expect(result.effectiveArgs).toContain("--remote-debugging-pipe");
	});
});
