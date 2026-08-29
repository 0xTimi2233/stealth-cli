import { randomInt } from "node:crypto";

export interface Profile {
	name: string;
	seed: number;
	timezone: string;
	language: string;
	acceptLanguages: string;
	screenWidth: number;
	screenHeight: number;
	proxy?: string;
	createdAt: string;
	updatedAt: string;
}

export interface ProfileDraftOptions {
	timezone?: string;
	language?: string;
	acceptLanguages?: string;
	screenWidth?: number;
	screenHeight?: number;
	proxy?: string;
	seed?: number;
}

const NAME_PATTERN = /^[a-zA-Z0-9_-]+$/;

export function validateProfileName(name: string): boolean {
	return typeof name === "string" && name.length > 0 && NAME_PATTERN.test(name);
}

export function createProfileEntity(
	name: string,
	options: ProfileDraftOptions = {},
): Profile {
	if (!validateProfileName(name)) {
		throw new Error(
			`Invalid profile name: '${name}'. Must match ${NAME_PATTERN}`,
		);
	}

	const now = new Date().toISOString();
	return {
		name,
		seed: options.seed ?? randomInt(10000, 999999),
		timezone: options.timezone ?? "Asia/Tokyo",
		language: options.language ?? "en-US",
		acceptLanguages: options.acceptLanguages ?? "en-US,en",
		screenWidth: options.screenWidth ?? 1440,
		screenHeight: options.screenHeight ?? 900,
		proxy: options.proxy,
		createdAt: now,
		updatedAt: now,
	};
}
