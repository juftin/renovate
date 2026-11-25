import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { promisify } from "node:util";

const exec = promisify(execFile);
const runner = createRequire(import.meta.url)("../renovate-config.js");
const packages = ["cooldown-parent", "cooldown-child"];
const versions = ["1.0.0", "1.1.0"];

test(
  "uv locks preserve downstream locked checks and honor project-configured cooldowns",
  { timeout: 60000 },
  async () => {
    const cwd = await mkdtemp(join(tmpdir(), "renovate-uv-"));
    const cleanEnv = Object.fromEntries(
      Object.entries(process.env).filter(
        ([key]) => !key.startsWith("UV_") && !key.startsWith("PIP_"),
      ),
    );
    const runnerEnv = {
      ...cleanEnv,
      ...(runner.customEnvVariables ?? {}),
      UV_CACHE_DIR: join(cwd, "cache"),
      UV_PYTHON_DOWNLOADS: "never",
    };
    const ciEnv = {
      ...cleanEnv,
      UV_CACHE_DIR: join(cwd, "cache"),
      UV_PYTHON_DOWNLOADS: "never",
    };
    const wheels = new Map();
    const server = createServer((request, response) => {
      const path = new URL(request.url, "http://localhost").pathname;
      const name = path.split("/").filter(Boolean).at(-1);
      if (path.startsWith("/simple/") && packages.includes(name)) {
        response.setHeader(
          "Content-Type",
          "application/vnd.pypi.simple.v1+json",
        );
        response.end(
          JSON.stringify({
            meta: { "api-version": "1.0" },
            name,
            files: versions.map((version, index) => {
              const filename = `${name.replaceAll("-", "_")}-${version}-py3-none-any.whl`;
              const bytes = wheels.get(filename);
              return {
                filename,
                url: `/files/${filename}`,
                size: bytes.length,
                hashes: {
                  sha256: createHash("sha256").update(bytes).digest("hex"),
                },
                "upload-time": new Date(
                  Date.now() - (index ? 1 : 20) * 86400000,
                ).toISOString(),
              };
            }),
          }),
        );
      } else if (path.startsWith("/files/") && wheels.has(name)) {
        response.end(wheels.get(name));
      } else {
        response.writeHead(404).end();
      }
    });
    try {
      // Standard-library-only wheel fixtures; no real registry or package code.
      await exec(
        "uv",
        [
          "run",
          "--no-project",
          "--no-config",
          "python",
          "-c",
          `
"""Build synthetic distributions for isolated lockfile resolution tests."""
import pathlib, sys, zipfile
for name in ("cooldown-parent", "cooldown-child"):
    for version in ("1.0.0", "1.1.0"):
        dist = name.replace("-", "_")
        info = f"{dist}-{version}.dist-info"
        metadata = f"Metadata-Version: 2.3\\nName: {name}\\nVersion: {version}\\n"
        if name == "cooldown-parent":
            metadata += "Requires-Dist: cooldown-child>=1\\n"
        with zipfile.ZipFile(pathlib.Path(sys.argv[1]) / f"{dist}-{version}-py3-none-any.whl", "w") as wheel:
            wheel.writestr(f"{info}/METADATA", metadata)
            wheel.writestr(f"{info}/WHEEL", "Wheel-Version: 1.0\\nRoot-Is-Purelib: true\\nTag: py3-none-any\\n")
            wheel.writestr(f"{info}/RECORD", "")
`,
          cwd,
        ],
        { cwd, env: runnerEnv },
      );
      for (const name of packages)
        for (const version of versions) {
          const filename = `${name.replaceAll("-", "_")}-${version}-py3-none-any.whl`;
          wheels.set(filename, await readFile(join(cwd, filename)));
        }
      await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
      const indexUrl = `http://127.0.0.1:${server.address().port}/simple/`;
      runnerEnv.UV_DEFAULT_INDEX = indexUrl;
      ciEnv.UV_DEFAULT_INDEX = indexUrl;
      const project = `[project]\nname = "fixture"\nversion = "0.0.0"\nrequires-python = ">=3.9"\ndependencies = ["cooldown-parent>=1"]\n`;
      const lock = async () => {
        await exec("uv", ["lock", "--upgrade"], { cwd, env: runnerEnv });
        // Downstream CI runs `uv sync --locked` / `uv lock --check` without runner env vars.
        await exec("uv", ["lock", "--check"], { cwd, env: ciEnv });
        const content = await readFile(join(cwd, "uv.lock"), "utf8");
        return Object.fromEntries(
          packages.map((name) => [
            name,
            content.match(
              new RegExp(`name = "${name}"\\nversion = "([^"]+)"`),
            )?.[1],
          ]),
        );
      };
      // Projects without `[tool.uv] exclude-newer` stay compatible with locked CI checks.
      await writeFile(join(cwd, "pyproject.toml"), project);
      assert.deepEqual(await lock(), {
        "cooldown-parent": "1.1.0",
        "cooldown-child": "1.1.0",
      });
      // Projects that configure `[tool.uv] exclude-newer` age direct and transitive deps.
      await writeFile(
        join(cwd, "pyproject.toml"),
        `${project}\n[tool.uv]\nexclude-newer = "7 days"\n`,
      );
      assert.deepEqual(await lock(), {
        "cooldown-parent": "1.0.0",
        "cooldown-child": "1.0.0",
      });
      // Repeat the actual maintenance command against the existing lockfile.
      assert.deepEqual(await lock(), {
        "cooldown-parent": "1.0.0",
        "cooldown-child": "1.0.0",
      });
      // Scoped exceptions override the project cutoff only for the named package.
      await writeFile(
        join(cwd, "pyproject.toml"),
        `${project}\n[tool.uv]\nexclude-newer = "7 days"\nexclude-newer-package = { cooldown-parent = false }\n`,
      );
      assert.deepEqual(await lock(), {
        "cooldown-parent": "1.1.0",
        "cooldown-child": "1.0.0",
      });
    } finally {
      server.closeAllConnections();
      if (server.listening)
        await new Promise((resolve) => server.close(resolve));
      await rm(cwd, { recursive: true, force: true });
    }
  },
);
