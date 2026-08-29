import { homedir } from "node:os";
import { join } from "node:path";

export function resolveBinaryPath(rawPath: string): string {
	let p = rawPath.startsWith("~") ? rawPath.replace("~", homedir()) : rawPath;
	if (process.platform === "darwin" && p.endsWith(".app")) {
		p = join(p, "Contents/MacOS/Chromium");
	}
	return p;
}
