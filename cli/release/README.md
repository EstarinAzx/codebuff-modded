# codebuff-mod

BYOK fork of [Codebuff](https://github.com/CodebuffAI/codebuff). Bring your own LLM provider API key — no codebuff.com account, no central billing, no quotas beyond what your provider enforces.

Fork source: https://github.com/EstarinAzx/codebuff

## Installation

```bash
npm install -g codebuff-mod
```

(Use `sudo` if you get a permission error.)

## Quick start

```bash
cd ~/my-project
cbm           # or: codebuff-mod
```

Inside the CLI:

```
/providers:add <preset> <profile-name> <apiKey>
```

Presets:

| Preset | Default model | Notes |
|---|---|---|
| `openai` | gpt-5.1 | api.openai.com |
| `anthropic` | claude-sonnet-4.5 | api.anthropic.com |
| `openrouter` | anthropic/claude-sonnet-4.5 | openrouter.ai |
| `opencode` | minimax-m2.7 | opencode.ai/zen/v1 |
| `opencode-go` | glm-5 | opencode.ai/zen/go/v1 |
| `deepseek` | deepseek-chat | api.deepseek.com |
| `gemini` | gemini-2.5-pro | generativelanguage.googleapis.com |
| `mistral` | mistral-large-latest | api.mistral.ai |
| `together` | meta-llama/Llama-3.3-70B-Instruct-Turbo | api.together.xyz |
| `groq` | llama-3.3-70b-versatile | api.groq.com |
| `custom-openai` | (yours) | Any OpenAI-compatible endpoint — needs `<baseUrl>` arg |

Then run any coding task. Agent picks model from your active profile, sends requests directly to your provider, no codebuff.com involvement.

## Commands

| Command | What it does |
|---|---|
| `/providers` | List your profiles (`*` marks active) |
| `/providers:add <preset> <name> <apiKey>` | Add a new profile, set active |
| `/providers:select <id\|name>` | Switch active profile |
| `/providers:remove <id\|name>` | Remove a profile |
| `/providers:test` | Send a 1-token ping to verify the active profile works |
| `/providers:refresh-models` | Bust the 24h `/v1/models` cache for the active profile |
| `/model` | Show current model + live-probe available ids |
| `/model <id>` | Swap model on the active profile |
| `/mode:default` `/mode:lite` `/mode:max` `/mode:plan` | Switch agent mode (mod-* templates in `.agents/`) |

Your profiles live at `~/.config/manicode/providers.json` (chmod 0600). API keys are masked in all log output.

## Knowledge files

Add a `knowledge.md` anywhere in your project to give the agent persistent context. The agent reads + writes them as it works.

## Troubleshooting

### Permission errors during install

```bash
sudo npm install -g codebuff-mod
```

If still broken, [reinstall Node](https://nodejs.org/en/download).

### Binary download fails

The launcher fetches the platform binary from GitHub Releases of `EstarinAzx/codebuff` on first run. If you're behind a proxy, set `HTTPS_PROXY`:

```bash
export HTTPS_PROXY=http://your-proxy-server:port   # bash/zsh
$env:HTTPS_PROXY = "http://your-proxy-server:port" # PowerShell
set HTTPS_PROXY=http://your-proxy-server:port      # CMD
```

Also supported: `HTTP_PROXY`, `NO_PROXY` (with comma-separated hostnames). URL-embedded credentials work (`http://user:pw@proxy:port`).

### "No active BYOK profile and no Codebuff backend configured"

You haven't added a provider profile yet. Run `/providers:add` (see above).

### Override binary download URL (testing)

```bash
export CODEBUFF_MOD_RELEASE_URL=https://example.com/codebuff-mod-linux-x64.tar.gz
```

### Use the legacy Codebuff backend instead (advanced)

```bash
export CODEBUFF_USE_BACKEND=1
export NEXT_PUBLIC_CODEBUFF_APP_URL=https://codebuff.com
```

This restores the upstream behavior (requires a real codebuff.com account + API key).

## License

MIT. Built on top of [Codebuff](https://github.com/CodebuffAI/codebuff) (Apache-2.0).

## Issues

https://github.com/EstarinAzx/codebuff/issues
