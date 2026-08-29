import type { LaunchRequest, LaunchResult } from "../../domain/launch";
import { createProfileEntity } from "../../domain/profile";
import type { EnginePort } from "../../port/engine.port";
import type { ProfileStorePort } from "../../port/store.port";

export async function launchProfile(
	name: string | undefined,
	incomingArgs: string[],
	engine: EnginePort,
	store: ProfileStorePort,
): Promise<LaunchResult> {
	const profileName = name || "ephemeral";
	let profile = name ? await store.get(name, engine.name) : null;

	if (name && !profile) {
		throw new Error(`Profile '${name}' not found for engine '${engine.name}'`);
	}

	if (!profile) {
		profile = createProfileEntity(profileName);
	}

	const userDataDir = store.resolveUserDataDir(profileName, engine.name);

	const request: LaunchRequest = {
		profile,
		engine: engine.name,
		userDataDir,
		incomingArgs,
	};

	return engine.launch(request);
}
