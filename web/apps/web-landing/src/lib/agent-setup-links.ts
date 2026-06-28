import { CODING_AGENT_PROMPT } from './coding-agent-prompt'

/** Claude Code `q` parameter max length per official deep link docs. */
export const CLAUDE_DEEPLINK_Q_MAX = 5000

/** Conservative browser URL length limit for Cursor https deeplinks. */
export const CURSOR_DEEPLINK_MAX_URL = 2048

const IGRIS_API_URL = 'https://overture.igrisinertial.com'

export function buildCursorDeeplink(prompt: string = CODING_AGENT_PROMPT): string | null {
  const trimmed = prompt.trim()
  if (!trimmed) return null
  const url = `https://cursor.com/link/prompt?text=${encodeURIComponent(trimmed)}`
  if (url.length > CURSOR_DEEPLINK_MAX_URL) return null
  return url
}

export function buildClaudeCodeDeeplink(prompt: string = CODING_AGENT_PROMPT): string | null {
  const trimmed = prompt.trim()
  if (!trimmed || trimmed.length > CLAUDE_DEEPLINK_Q_MAX) return null
  return `claude-cli://open?q=${encodeURIComponent(trimmed)}`
}

/** Interactive Codex CLI command — opens the TUI with the prompt prefilled; does not auto-run. */
export function buildCodexCommand(prompt: string = CODING_AGENT_PROMPT): string {
  return `codex "$(cat <<'EOF'\n${prompt}\nEOF\n)"`
}

export function buildMcpConfigJson(): string {
  const config = {
    mcpServers: {
      igris: {
        command: 'igris',
        args: ['mcp', 'serve', '--api-url', IGRIS_API_URL],
        env: {
          IGRIS_API_KEY: 'your-api-key-here',
        },
      },
    },
  }
  return JSON.stringify(config, null, 2)
}

/** OpenCode has no verified browser deeplink — start the CLI and paste the prompt manually. */
export function buildOpencodeSetup(prompt: string = CODING_AGENT_PROMPT): string {
  return `# From your project directory, start OpenCode and paste the setup prompt when the editor opens.
opencode

# Setup prompt:
${prompt}`
}

/** Pi has no verified browser deeplink — start the CLI and paste the prompt manually. */
export function buildPiSetup(prompt: string = CODING_AGENT_PROMPT): string {
  return `# From your project directory, start Pi and paste the setup prompt when the editor opens.
pi

# Setup prompt:
${prompt}`
}

/** Droid has no verified browser deeplink — start the CLI and paste the prompt manually. */
export function buildDroidSetup(prompt: string = CODING_AGENT_PROMPT): string {
  return `# From your project directory, start Droid and paste the setup prompt when the editor opens.
droid

# Setup prompt:
${prompt}`
}