import type { EngineType, LaunchRequest, LaunchResult } from "../domain/launch";

export interface EnginePort {
	readonly name: EngineType;
	getKernelPath(): string;
	buildArgs(request: LaunchRequest): Promise<string[]>;
	launch(request: LaunchRequest): Promise<LaunchResult>;
}
