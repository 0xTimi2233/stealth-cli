import { spawn } from "node:child_process";
import { buildArgs as buildCloakOfficialArgs } from "@cloak/args";
import type {
	EngineType,
	LaunchRequest,
	LaunchResult,
} from "../../domain/launch";
import type { EnginePort } from "../../port/engine.port";
import { toCloakLaunchOptions } from "./cloak.mapper";

export class CloakAdapter implements EnginePort {
	readonly name: EngineType = "cloak";

	constructor(private readonly kernelPath: string) {}

	getKernelPath(): string {
		return this.kernelPath;
	}

	async buildArgs(request: LaunchRequest): Promise<string[]> {
		const cloakOptions = toCloakLaunchOptions(request);
		return buildCloakOfficialArgs(cloakOptions);
	}

	async launch(request: LaunchRequest): Promise<LaunchResult> {
		const effectiveArgs = await this.buildArgs(request);
		const proc = spawn(this.kernelPath, effectiveArgs, {
			stdio: "inherit",
			windowsHide: false,
		});

		return {
			engine: this.name,
			process: proc,
			pid: proc.pid ?? -1,
			userDataDir: request.userDataDir,
			effectiveArgs,
		};
	}
}
