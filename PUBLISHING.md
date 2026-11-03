# Publishing smstunnel-mcp

Everything here is ready; nothing has been published. Run the steps in this order: each one needs the one before it.

| # | Where | Needs | Who acts |
| --- | --- | --- | --- |
| 1 | GitHub `narcisbodea/smstunnel-mcp` (public) | nothing | you: create the repo and push |
| 2 | npm `@narcisbodea/smstunnel-mcp` | 1 (links in the package point to the repo) | you: Windows Hello |
| 3 | Official MCP Registry `io.github.narcisbodea/smstunnel-mcp` | 2 (the registry reads `mcpName` from npm) | you: GitHub device login |
| 4 | Glama | 1 (public repo) | you: GitHub login, two clicks |
| 5 | punkpeye/awesome-mcp-servers | 4 (the Glama score badge decides merges) | a pull request |
| 6 | Docker MCP Catalog (optional) | 1 (a commit on GitHub) | a pull request |

Package name: `@narcisbodea/smstunnel-mcp` (the npm scope `@smstunnel` doesn't exist). Registry name: `io.github.narcisbodea/smstunnel-mcp`. Version: `1.1.0` in `package.json`, `server.json`, the plugin, the bundle and the skill (see [Later versions](#later-versions)).

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

Glama lists public GitHub repositories on its own; you can also submit it right away.

1. Submit (if it isn't listed yet): https://glama.ai/mcp/servers → **Add Server** → **Runs from source**. Name `SMSTunnel`; GitHub URL `https://github.com/narcisbodea/smstunnel-mcp`; description: `Send texts (SMS) and sign-in codes from your own Android phone and your own number from any AI app, check whether they went out, and read replies.` → **Submit for Review**. Glama emails how to provide the Dockerfile.
2. Claim it: on the server's page select **Claim** → **Login with GitHub to claim**. `glama.json` (maintainer `narcisbodea`) is in the repo root.
3. Make a release, so the checks run and the score appears: open `https://glama.ai/mcp/servers/narcisbodea/smstunnel-mcp/admin/dockerfile`, use the repository's `Dockerfile` (it builds the server and starts it with `node dist/index.js`), leave `SMSTUNNEL_API_KEY` empty, then **Deploy** → **Make Release** → **Create & Publish Release**. The server starts and lists its tools without a key, which is all the checks need.
4. Check the badge: `https://glama.ai/mcp/servers/narcisbodea/smstunnel-mcp/badges/score.svg`.

Glama also scores every tool's definition (purpose, when to use it, behaviour, parameters); the tools have titles, annotations that match their descriptions, and output schemas.

## 5. awesome-mcp-servers

Only after the Glama badge shows: the list's bot labels pull requests `has-glama` or `missing-glama`, and in practice only `has-glama` ones get merged.

In a fork of `punkpeye/awesome-mcp-servers`, add this line to `README.md` under `### 💬 <a name="communication"></a>Communication`, in alphabetical order between `multimail-dev/mcp-server` and `ni-c/carddav-mcp`:

```markdown
- [narcisbodea/smstunnel-mcp](https://github.com/narcisbodea/smstunnel-mcp) [![narcisbodea/smstunnel-mcp MCP server](https://glama.ai/mcp/servers/narcisbodea/smstunnel-mcp/badges/score.svg)](https://glama.ai/mcp/servers/narcisbodea/smstunnel-mcp) 🎖️ 📇 ☁️ - Send texts (SMS) and sign-in codes from your own Android phone and your own number, check whether they went out, and read replies.
```

🎖️ official implementation, 📇 TypeScript, ☁️ it talks to a remote API. If Glama's page path differs (for example `@narcisbodea/...`), copy the badge snippet Glama shows.

Pull request title: `Add SMSTunnel MCP server`. Body: one sentence on what it does, plus the Glama link.

**About "agent" pull requests:** the list's CONTRIBUTING asks automated agents to put `🤖🤖🤖` at the end of the title for a "fast-tracked" merge. The maintainer wrote that this is a trap to spot bot pull requests, and that human ones get priority (glama.ai/blog/2026-03-19-open-source-has-a-bot-problem). It is not a fast track. If you open the pull request yourself, no marker is needed; if an agent opens it, it should add the marker, as asked.

## 6. Docker MCP Catalog (optional, low odds right now)

Since August 2026 the catalog has merged almost nothing new: 5 merges, none adding a server, with about 2,400 pull requests open. Prepare it only if you want to be in the queue.

1. Fork `docker/mcp-registry` and copy `directories/docker-mcp-registry/servers/smstunnel/server.yaml` from this repository to `servers/smstunnel/server.yaml` there.
2. Replace `REPLACE_WITH_THE_40_CHARACTER_SHA_OF_THE_PUSHED_COMMIT` with the commit Docker should build (`git rev-parse HEAD` after step 1; it must be on GitHub). Docker builds the image `mcp/smstunnel` from this repository's `Dockerfile` at that commit.
3. Optional local check (needs Go 1.24+, Task and Docker Desktop): `task validate -- --name smstunnel`, `task build -- --tools smstunnel`, `task catalog -- smstunnel`, `docker mcp catalog import $PWD/catalogs/smstunnel/catalog.yaml`, try it in Docker Desktop's MCP Toolkit, then `docker mcp catalog reset`.
4. Open the pull request with their template. MIT is an accepted license. The server lists its tools without a key, so no `tools.json` is needed. Docker asks for test credentials through a form in its README: send only a dedicated test key, never your own.

AI-assisted pull requests are welcome there (their CONTRIBUTING even offers `cat add_mcp_server.md | claude`); no trailer or disclosure line is required.

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

## Later versions

1. Raise the version in `package.json`, in both places in `server.json`, in `.claude-plugin/plugin.json` (its `version` and the exact `@narcisbodea/smstunnel-mcp@x.y.z` its server runs: the plugin directory refuses a range), in `mcpb/manifest.json` and in `metadata.version` of `skills/smstunnel-sms/SKILL.md`. In `package-lock.json`, change only its two top-level `version` fields. New tools also go in the `tools` list of `mcpb/manifest.json`.
2. `npm test`, then `npm publish`, then `mcp-publisher publish`.
3. Glama: **Make Release** again. Docker (if listed) opens its own pull requests to move the pinned commit.
4. Build and attach a new `smstunnel.mcpb` (section 8).
