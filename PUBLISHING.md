# Publishing smstunnel-mcp

Published so far: the GitHub repository, npm `@narcisbodea/smstunnel-mcp` 1.1.0, the Official MCP Registry (1.0.0 and 1.1.0), the Claude Desktop bundle (release `mcpb-v1.1.0`), the Claude Code plugin (submitted to Anthropic's directory), and Glama (listed, claimed, rated A). The sections below are the steps for each place, in the order they depend on each other. The other directories (Gemini's gallery, Cursor, Cline, awesome lists, skill directories) are tracked with their texts in the owner's notes, outside this repository.

| # | Where | Needs | Who acts |
| --- | --- | --- | --- |
| 1 | GitHub `narcisbodea/smstunnel-mcp` (public) | nothing | you: push |
| 2 | npm `@narcisbodea/smstunnel-mcp` | 1 (links in the package point to the repo) | you: Windows Hello |
| 3 | Official MCP Registry `io.github.narcisbodea/smstunnel-mcp` | 2 (the registry reads `mcpName` from npm) | the `v*` tag workflow (or your GitHub device login) |
| 4 | Glama | 1 (public repo) | you: GitHub login |
| 5 | punkpeye/awesome-mcp-servers | 4 (the Glama score badge decides merges) | a pull request |
| 6 | Docker MCP Catalog | 1 (a commit with the Dockerfile on GitHub) | a pull request |
| 9 | Gemini CLI extensions gallery | 1 + the `gemini-cli-extension` topic | automatic, daily |
| 10 | Cursor (cursor.directory, Cursor Marketplace) | 1 | you: a form, signed in |

Package name: `@narcisbodea/smstunnel-mcp` (the npm scope `@smstunnel` doesn't exist). Registry name: `io.github.narcisbodea/smstunnel-mcp`. Version: `1.1.0` in `package.json`, `server.json`, the Claude Code and Cursor plugins, the Gemini extension, the Docker image, the bundle and the skill (see [Later versions](#later-versions)).

## 1. GitHub

```bash
cd D:/ANDROID/smstunnel-mcp
gh repo create narcisbodea/smstunnel-mcp --public --source . --push \
  --description "SMSTunnel MCP server: AI apps send texts from your own Android phone and your own number"
gh repo edit narcisbodea/smstunnel-mcp --homepage https://smstunnel.io \
  --add-topic mcp --add-topic mcp-server --add-topic sms --add-topic android --add-topic smstunnel
```

The repository holds no keys: `.env.production` (it has a real key) is ignored by `.gitignore`, `.dockerignore` and the npm `files` list. Check with `git ls-files` before pushing.

## 2. npm

In a normal terminal (not inside Claude Code: npm's security-key login needs a real terminal):

```bash
cd D:/ANDROID/smstunnel-mcp
npm whoami                 # if it answers E401: npm login
npm test                   # 73 unit tests
npm publish                # access is public (publishConfig); prepack builds dist/
                           # the browser opens: confirm with Windows Hello
npm view @narcisbodea/smstunnel-mcp version mcpName   # a new version can take a few minutes to show
```

`npm pack --dry-run` lists what goes out: `dist/`, `README.md`, `LICENSE`, `package.json` (17 files, about 27 KB).

## 3. Official MCP Registry

The registry checks that npm's `@narcisbodea/smstunnel-mcp@1.1.0` has `"mcpName": "io.github.narcisbodea/smstunnel-mcp"`, so publish to npm first. `server.json` validates against the current schema (2025-12-11) and passes the registry's own check (`POST /v0/validate` answered `{"valid":true,"issues":[]}`).

Install `mcp-publisher` once (PowerShell, from the registry's quickstart):

```powershell
$arch = if ([System.Runtime.InteropServices.RuntimeInformation]::ProcessArchitecture -eq "Arm64") { "arm64" } else { "amd64" }; Invoke-WebRequest -Uri "https://github.com/modelcontextprotocol/registry/releases/latest/download/mcp-publisher_windows_$arch.tar.gz" -OutFile "mcp-publisher.tar.gz"; tar xf mcp-publisher.tar.gz mcp-publisher.exe; rm mcp-publisher.tar.gz
```

Then, in `D:\ANDROID\smstunnel-mcp` (don't run `mcp-publisher init`: `server.json` is already there):

```powershell
.\mcp-publisher.exe validate server.json
.\mcp-publisher.exe login github      # opens https://github.com/login/device: enter the code shown
.\mcp-publisher.exe publish
curl "https://registry.modelcontextprotocol.io/v0.1/servers?search=io.github.narcisbodea/smstunnel-mcp"
```

GitHub login grants only `io.github.narcisbodea/*`, matched case-sensitively, which is why the name is lowercase. A published version can't be changed: every update needs a new version in `package.json` and `server.json` (both places in `server.json`), published to npm first.

## 4. Glama

Done on 3 Nov 2026: https://glama.ai/mcp/servers/narcisbodea/smstunnel-mcp is listed, claimed (`glama.json` names `narcisbodea`), rated A, and its score badge works. Its last inspection (3 Nov, 07:44 UTC) saw the six tools of 1.0.0, so it needs a new release to show `find_contact`.

Glama builds its own image from fields on `https://glama.ai/mcp/servers/narcisbodea/smstunnel-mcp/admin/dockerfile` (signed in with GitHub); it doesn't take a pasted Dockerfile. It copies the repository, runs the build steps, and starts the command under `mcp-proxy`. These values install the published npm release, the same one the Docker image runs:

| Field | Value |
| --- | --- |
| Node.js version | `24` |
| Python version | leave as it is |
| Build steps | `["npm ci --prefix docker --omit=dev --ignore-scripts --no-audit --no-fund"]` |
| CMD arguments | `["node", "docker/node_modules/@narcisbodea/smstunnel-mcp/dist/index.js"]` |
| Environment variables JSON schema | the block below |
| Placeholder parameters | `{}` (the server starts and lists its tools without a key) |
| Pinned commit SHA | leave empty |

```json
{
  "type": "object",
  "properties": {
    "SMSTUNNEL_API_KEY": { "type": "string", "description": "Your SMSTunnel API key, from https://dashboard.smstunnel.io/apps (Apps → Add an app)." },
    "SMSTUNNEL_DEVICE_ID": { "type": "string", "description": "Optional: the phone that sends when the assistant doesn't name one (its ID under Phones in the dashboard)." },
    "SMSTUNNEL_DEFAULT_COUNTRY_CODE": { "type": "string", "description": "Optional: country calling code that completes numbers written without + or 00, e.g. +40." }
  },
  "required": []
}
```

Then **Deploy**, wait for the test to pass, **Make Release**, and publish it on the releases page. Check the badge: `https://glama.ai/mcp/servers/narcisbodea/smstunnel-mcp/badges/score.svg`.

Glama also scores every tool's definition (purpose, when to use it, behaviour, parameters); the tools have titles, annotations that match their descriptions, and output schemas.

## 5. awesome-mcp-servers

The Glama badge shows, so this can go now: the list's bot labels pull requests `has-glama` or `missing-glama`, and in practice only `has-glama` ones get merged.

In a fork of `punkpeye/awesome-mcp-servers`, add this line to `README.md` under `### 💬 <a name="communication"></a>Communication`, in alphabetical order between `multimail-dev/mcp-server` and `ni-c/carddav-mcp`:

```markdown
- [narcisbodea/smstunnel-mcp](https://github.com/narcisbodea/smstunnel-mcp) [![narcisbodea/smstunnel-mcp MCP server](https://glama.ai/mcp/servers/narcisbodea/smstunnel-mcp/badges/score.svg)](https://glama.ai/mcp/servers/narcisbodea/smstunnel-mcp) 🎖️ 📇 ☁️ - Send texts (SMS) and sign-in codes from your own Android phone and your own number, check whether they went out, and read replies.
```

🎖️ official implementation, 📇 TypeScript, ☁️ it talks to a remote API. If Glama's page path differs (for example `@narcisbodea/...`), copy the badge snippet Glama shows.

Pull request title: `Add SMSTunnel MCP server`. Body: one sentence on what it does, plus the Glama link.

**About "agent" pull requests:** the list's CONTRIBUTING asks automated agents to put `🤖🤖🤖` at the end of the title for a "fast-tracked" merge. The maintainer wrote that this is a trap to spot bot pull requests, and that human ones get priority (glama.ai/blog/2026-03-19-open-source-has-a-bot-problem). It is not a fast track. If you open the pull request yourself, no marker is needed; if an agent opens it, it should add the marker, as asked.

## 6. Docker MCP Catalog (low odds right now)

Since 1 September 2026 the catalog has merged 5 pull requests, none adding a server (the last new local servers went in in April), with about 2,500 open. A pull request still puts SMSTunnel in the queue.

The `Dockerfile` installs the published npm release, not this checkout: `docker/package.json` names the exact version and `docker/package-lock.json` pins it and its three dependencies by sha512. The base image is Node.js 24 LTS on Alpine, pinned by digest; npm, npx, corepack and yarn are removed from the final image, the code is owned by root, and the server runs as the unprivileged user `node`. `docker run --rm -i --init --cap-drop=ALL --read-only` works (that is how Docker's tooling lists the tools), and the server lists its tools without a key, so no `tools.json` is needed.

The pull request's files (`servers/smstunnel/server.yaml` and the description) are kept in the owner's notes, outside this repository. Docker builds `mcp/smstunnel` from this repository's `Dockerfile` at the commit named in `source.commit`, which must be on GitHub; after the first merge, Docker's bot opens pull requests to move that pin.

AI-assisted pull requests are welcome there (their CONTRIBUTING even offers `cat add_mcp_server.md | claude`); no trailer or disclosure line is required. Docker asks for test credentials through a form: send only a key from a separate test account with no phone linked, so every text waits in the queue and none goes out.

## 7. Claude Code plugin

The repository is also a plugin marketplace (`.claude-plugin/plugin.json` and `marketplace.json`): `/plugin install smstunnel --marketplace narcisbodea/smstunnel-mcp`. Check it with `claude plugin validate --strict .`. To list it in Anthropic's directory (claude.ai, Cowork and Claude Code), submit it from the developer portal at https://claude.ai/directory/manage, signed in with a paid claude.ai plan.

## 8. Claude Desktop bundle (`smstunnel.mcpb`)

`mcpb/manifest.json` describes the bundle. `mcpb/icon.png` is a copy of `assets/icon.png`, so `npx -y @anthropic-ai/mcpb validate mcpb/manifest.json` also passes in the repository; if the icon changes, copy it to both places. Build it from a clean copy, so the bundle holds only runtime files:

```bash
B=$(mktemp -d)
git archive HEAD package.json package-lock.json tsconfig.json src LICENSE README.md assets/icon.png | tar -x -C "$B"
cd "$B" && npm ci && npm run build && npm prune --omit=dev
cp <repo>/mcpb/manifest.json manifest.json && cp assets/icon.png icon.png
rm -rf src tsconfig.json assets package-lock.json && printf 'README.md\n' > .mcpbignore
npx -y @anthropic-ai/mcpb validate manifest.json && npx -y @anthropic-ai/mcpb pack . smstunnel.mcpb
```

Attach `smstunnel.mcpb` to a GitHub release whose tag does NOT start with `v` (for example `mcpb-v1.1.0`): a `v*` tag runs the MCP Registry workflow. The README links to `releases/latest/download/smstunnel.mcpb`, so keep that file name.

## 9. Gemini CLI extension

`gemini-extension.json` and `GEMINI.md` make the repository a Gemini CLI extension: `gemini extensions install https://github.com/narcisbodea/smstunnel-mcp`. It runs `npx -y @narcisbodea/smstunnel-mcp@1.1.0`, loads the agent skill from `skills/`, and asks for two settings at install: the key (kept in the system keychain) and an optional default country code. Gemini CLI passes both to the server as `SMSTUNNEL_API_KEY` and `SMSTUNNEL_DEFAULT_COUNTRY_CODE`.

The gallery at https://geminicli.com/extensions finds extensions on its own: a public repository with the GitHub topic `gemini-cli-extension` and `gemini-extension.json` at its root, crawled daily. There is no form.

```bash
gh repo edit narcisbodea/smstunnel-mcp --add-topic gemini-cli-extension
```

Check it locally with `gemini extensions validate .`.

## 10. Cursor plugin

`.cursor-plugin/plugin.json` and the root `mcp.json` make the repository a Cursor plugin: the server (pinned to `@1.1.0`), the agent skill from `skills/`, the logo `assets/icon.png`, and one variable, `SMSTUNNEL_API_KEY`, which Cursor asks for under **Plugins → Configure**. `plugin.json` validates against Cursor's schema (`cursor/plugins`, `schemas/plugin.schema.json`). Submit the repository URL at https://cursor.com/marketplace/publish (the official Marketplace, reviewed by Cursor) and at https://cursor.directory/plugins/new (the community list); both need you signed in.

## Later versions

1. Raise the version in `package.json`, in both places in `server.json`, in `.claude-plugin/plugin.json` (its `version` and the exact `@narcisbodea/smstunnel-mcp@x.y.z` its server runs: the plugin directory refuses a range), in `.cursor-plugin/plugin.json`, in `gemini-extension.json` (its `version` and the `@x.y.z` in `args`), in the `@x.y.z` of `mcp.json`, in `mcpb/manifest.json` and in `metadata.version` of `skills/smstunnel-sms/SKILL.md`. In `package-lock.json`, change only its two top-level `version` fields. New tools also go in the `tools` list of `mcpb/manifest.json`.
2. `npm test`, then `npm publish`, then `mcp-publisher publish` (or push the `vX.Y.Z` tag).
3. Only after the new version is on npm: set it in `docker/package.json` (`version` and the dependency), then run `npm install --package-lock-only --ignore-scripts` in `docker/` and commit both files. Check with `docker build -t smstunnel-mcp . && docker run --rm smstunnel-mcp --version`.
4. Glama: **Make Release** again. Docker (if listed) opens its own pull requests to move the pinned commit.
5. Build and attach a new `smstunnel.mcpb` (section 8).
