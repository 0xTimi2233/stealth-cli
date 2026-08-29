import type { LaunchOptions } from "@cloak/types";
import type { LaunchRequest } from "../../domain/launch";

export function toCloakLaunchOptions(request: LaunchRequest): LaunchOptions {
	const sanitizedExtra = request.incomingArgs.filter(
		(arg) =>
			!arg.includes("--enable-automation") &&
			!arg.includes("--enable-unsafe-swiftshader"),
	);

	const args: string[] = [
		`--user-data-dir=${request.userDataDir}`,
		`--fingerprint=${request.profile.seed}`,
		`--fingerprint-platform=macos`,
		`--window-size=${request.profile.screenWidth},${request.profile.screenHeight}`,
		...sanitizedExtra,
	];

	if (request.profile.proxy) {
		args.push(`--proxy-server=${request.profile.proxy}`);
	}

	return {
		timezone: request.profile.timezone,
		locale: request.profile.language,
		headless: true,
		stealthArgs: true,
		args,
	};
}
