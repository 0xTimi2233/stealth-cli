import type { ChildProcess } from "node:child_process";
import type { Profile } from "./profile";

export type EngineType = "prism" | "cloak";

export interface LaunchRequest {
	profile: Profile;
	engine: EngineType;
	userDataDir: string;
	incomingArgs: string[];
}

export interface LaunchResult {
	engine: EngineType;
	process: ChildProcess;
	pid: number;
	userDataDir: string;
	effectiveArgs: string[];
}
