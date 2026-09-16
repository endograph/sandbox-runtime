import { createHash } from "node:crypto";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

// Preserve upstream's shipped native helpers byte for byte. Only the mount
// ordering in our TypeScript source differs; consumers need no build hooks.
const url = "https://registry.npmjs.org/@anthropic-ai/sandbox-runtime/-/sandbox-runtime-0.0.75.tgz";
const integrity = "oqAKi6QtkT2DpLwFoDCDD757zw2i6ftpLTyV8rNSV9QWF53q2m1JxEs0RYXv2CIXtCoje4RGYQylagn15RKmww==";
const response = await fetch(url);
if (!response.ok) throw new Error(`Upstream package download failed: ${response.status}`);
const bytes = Buffer.from(await response.arrayBuffer());
if (createHash("sha512").update(bytes).digest("base64") !== integrity) throw new Error("Upstream package integrity mismatch");
const work = mkdtempSync(join(tmpdir(), "endograph-srt-vendor-"));
try {
  const archive = join(work, "upstream.tgz");
  writeFileSync(archive, bytes);
  const result = Bun.spawnSync(["tar", "-xzf", archive, "--strip-components=1", "-C", resolve(import.meta.dir, ".."),
    "package/vendor/seccomp", "package/vendor/srt-win", "package/vendor/java-proxy-agent"], { stdout: "inherit", stderr: "inherit" });
  if (result.exitCode !== 0) throw new Error("Upstream helper extraction failed");
} finally {
  rmSync(work, { recursive: true, force: true });
}
console.log("Prepared integrity-verified upstream 0.0.75 native helpers");
