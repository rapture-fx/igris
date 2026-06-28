'use client'

import { forwardRef, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Blocks, Copy, ExternalLink } from 'lucide-react'
import Link from 'next/link'
import { CODING_AGENT_PROMPT } from '../../lib/coding-agent-prompt'
import {
  buildClaudeCodeDeeplink,
  buildCodexCommand,
  buildCursorDeeplink,
  buildDroidSetup,
  buildMcpConfigJson,
  buildOpencodeSetup,
  buildPiSetup,
} from '../../lib/agent-setup-links'
import { DOCS_LINKS } from '../../lib/docs-urls'

const SANS = 'var(--font-geist-sans), -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif'

type CopyAction = {
  kind: 'copy'
  id: string
  label: string
  text: string
}

type LinkAction = {
  kind: 'link'
  label: string
  href: string
  external?: boolean
}

type PopoverAction = CopyAction | LinkAction

type AgentConfig = {
  id: string
  name: string
  description: string
  logo?: string
  logoClass?: string
  imgSize?: string
  getActions: () => PopoverAction[]
}

const ACTION_BTN =
  'inline-flex items-center gap-1.5 text-[#52525b] hover:text-[#171717] transition-colors bg-transparent border-0 p-0 cursor-pointer text-left'

function useAgentConfigs(): AgentConfig[] {
  const cursorDeeplink = useMemo(() => buildCursorDeeplink(CODING_AGENT_PROMPT), [])
  const claudeDeeplink = useMemo(() => buildClaudeCodeDeeplink(CODING_AGENT_PROMPT), [])
  const codexCommand = useMemo(() => buildCodexCommand(CODING_AGENT_PROMPT), [])
  const opencodeSetup = useMemo(() => buildOpencodeSetup(CODING_AGENT_PROMPT), [])
  const piSetup = useMemo(() => buildPiSetup(CODING_AGENT_PROMPT), [])
  const droidSetup = useMemo(() => buildDroidSetup(CODING_AGENT_PROMPT), [])
  const mcpConfig = useMemo(() => buildMcpConfigJson(), [])

  return useMemo(
    () => [
      {
        id: 'cursor',
        name: 'Cursor',
        description:
          'Open Cursor with the Igris setup prompt prefilled. Review the text before sending — nothing runs automatically.',
        logo: '/logos/agents/cursor.png',
        imgSize: 'size-8',
        getActions: () => {
          const actions: PopoverAction[] = []
          if (cursorDeeplink) {
            actions.push({ kind: 'link', label: 'Open in Cursor', href: cursorDeeplink })
          }
          actions.push({
            kind: 'copy',
            id: 'cursor-prompt',
            label: 'Copy setup prompt',
            text: CODING_AGENT_PROMPT,
          })
          return actions
        },
      },
      {
        id: 'claude-code',
        name: 'Claude Code',
        description:
          'Open Claude Code with the setup prompt prefilled. Press Enter to send when you are ready — it does not auto-run.',
        logo: '/logos/agents/claude-code.png',
        imgSize: 'size-8',
        getActions: () => {
          const actions: PopoverAction[] = []
          if (claudeDeeplink) {
            actions.push({ kind: 'link', label: 'Open in Claude Code', href: claudeDeeplink })
          }
          actions.push({
            kind: 'copy',
            id: 'claude-prompt',
            label: 'Copy setup prompt',
            text: CODING_AGENT_PROMPT,
          })
          return actions
        },
      },
      {
        id: 'codex',
        name: 'Codex',
        description:
          'Copy a Codex CLI command that opens the interactive terminal with the setup prompt. Paste and run it locally when ready.',
        logo: '/logos/agents/codex.png',
        getActions: () => [
          { kind: 'copy', id: 'codex-command', label: 'Copy Codex command', text: codexCommand },
          {
            kind: 'copy',
            id: 'codex-prompt',
            label: 'Copy setup prompt',
            text: CODING_AGENT_PROMPT,
          },
        ],
      },
      {
        id: 'opencode',
        name: 'OpenCode',
        description:
          'Copy OpenCode startup steps and the setup prompt. Start OpenCode in your project, paste the prompt, then review before sending.',
        logo: '/logos/agents/opencode.svg',
        getActions: () => [
          { kind: 'copy', id: 'opencode-setup', label: 'Copy OpenCode setup', text: opencodeSetup },
          {
            kind: 'copy',
            id: 'opencode-prompt',
            label: 'Copy setup prompt',
            text: CODING_AGENT_PROMPT,
          },
        ],
      },
      {
        id: 'pi',
        name: 'Pi',
        description:
          'Copy Pi startup steps and the setup prompt. Start Pi in your project, paste the prompt, then review before sending.',
        logo: '/logos/agents/pi.svg',
        imgSize: 'size-10',
        getActions: () => [
          { kind: 'copy', id: 'pi-setup', label: 'Copy Pi setup', text: piSetup },
          {
            kind: 'copy',
            id: 'pi-prompt',
            label: 'Copy setup prompt',
            text: CODING_AGENT_PROMPT,
          },
        ],
      },
      {
        id: 'droid',
        name: 'Droid',
        description:
          'Copy Droid startup steps and the setup prompt. Start Droid in your project, paste the prompt, then review before sending.',
        logo: '/logos/agents/droid.svg',
        logoClass: 'brightness-0',
        imgSize: 'size-10',
        getActions: () => [
          { kind: 'copy', id: 'droid-setup', label: 'Copy Droid setup', text: droidSetup },
          {
            kind: 'copy',
            id: 'droid-prompt',
            label: 'Copy setup prompt',
            text: CODING_AGENT_PROMPT,
          },
        ],
      },
      {
        id: 'mcp',
        name: 'Any agent',
        description:
          'Copy an MCP server config for Igris. Add it to your MCP client and set your API key locally — no automatic configuration.',
        getActions: () => [
          { kind: 'copy', id: 'mcp-config', label: 'Copy MCP config', text: mcpConfig },
          {
            kind: 'copy',
            id: 'mcp-prompt',
            label: 'Copy setup prompt',
            text: CODING_AGENT_PROMPT,
          },
        ],
      },
    ],
    [claudeDeeplink, codexCommand, cursorDeeplink, droidSetup, mcpConfig, opencodeSetup, piSetup],
  )
}

const AgentLogo = forwardRef<
  HTMLButtonElement,
  { agent: AgentConfig; active: boolean; onClick: () => void }
>(function AgentLogo({ agent, active, onClick }, ref) {
  return (
    <button
      ref={ref}
      type="button"
      onClick={onClick}
      aria-label={`${agent.name} setup`}
      aria-expanded={active}
      className={`flex size-11 items-center justify-center rounded-lg transition-colors ${
        active ? 'bg-[#f4f4f5]' : 'hover:bg-[#fafafa]'
      }`}
    >
      {agent.logo ? (
        <img
          src={agent.logo}
          alt=""
          className={`${agent.imgSize ?? 'size-7'} object-contain ${agent.logoClass ?? ''}`}
          loading="lazy"
          decoding="async"
        />
      ) : (
        <Blocks size={22} strokeWidth={1.5} className="text-[#52525b]" aria-hidden />
      )}
    </button>
  )
})

function AgentPopover({
  agent,
  anchorRect,
  copiedId,
  onCopy,
  onClose,
}: {
  agent: AgentConfig
  anchorRect: DOMRect
  copiedId: string | null
  onCopy: (id: string, text: string) => void
  onClose: () => void
}) {
  const popoverRef = useRef<HTMLDivElement>(null)
  const actions = agent.getActions()

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  useEffect(() => {
    function onPointerDown(event: MouseEvent) {
      const target = event.target as Node
      if (popoverRef.current?.contains(target)) return
      onClose()
    }
    document.addEventListener('mousedown', onPointerDown)
    return () => document.removeEventListener('mousedown', onPointerDown)
  }, [onClose])

  const left = Math.min(
    Math.max(anchorRect.left + anchorRect.width / 2, 160),
    window.innerWidth - 160,
  )
  const top = anchorRect.bottom + 10

  return createPortal(
    <div
      ref={popoverRef}
      role="dialog"
      aria-label={`${agent.name} setup`}
      className="fixed z-50 w-[min(18rem,calc(100vw-2rem))] -translate-x-1/2 rounded-xl border border-[#ececec] bg-white px-4 py-3 shadow-[0_8px_30px_rgba(0,0,0,0.08)]"
      style={{ left, top, fontFamily: SANS }}
    >
      <p className="mb-1 text-[#171717] text-[0.9375rem] font-medium leading-snug">{agent.name}</p>
      <p className="mb-3 text-[#8f8f8f] text-[0.8125rem] leading-relaxed">{agent.description}</p>
      <ul className="flex flex-col gap-2" role="list">
        {actions.map((action) => (
          <li key={action.kind === 'copy' ? action.id : action.label}>
            {action.kind === 'link' ? (
              <a
                href={action.href}
                className={`${ACTION_BTN} underline decoration-[#d4d4d4] underline-offset-2 hover:decoration-[#a3a3a3]`}
                style={{ fontSize: '0.875rem', lineHeight: 1.4 }}
                onClick={onClose}
              >
                {action.label}
                {action.external && (
                  <ExternalLink size={12} strokeWidth={1.75} className="opacity-60" aria-hidden />
                )}
              </a>
            ) : (
              <button
                type="button"
                onClick={() => onCopy(action.id, action.text)}
                className={ACTION_BTN}
                style={{ fontSize: '0.875rem', lineHeight: 1.4 }}
              >
                <Copy size={13} strokeWidth={1.75} className="shrink-0 opacity-60" aria-hidden />
                {copiedId === action.id ? 'Copied' : action.label}
              </button>
            )}
          </li>
        ))}
      </ul>
      {agent.id === 'mcp' && (
        <Link
          href={DOCS_LINKS.firstAgentOnboarding}
          className={`mt-3 inline-flex items-center gap-1 ${ACTION_BTN} underline decoration-[#d4d4d4] underline-offset-2`}
          style={{ fontSize: '0.8125rem', lineHeight: 1.4 }}
          onClick={onClose}
        >
          Onboarding docs
          <ExternalLink size={11} strokeWidth={1.75} className="opacity-60" aria-hidden />
        </Link>
      )}
    </div>,
    document.body,
  )
}

export default function AgentSetupLogos() {
  const agents = useAgentConfigs()
  const [openId, setOpenId] = useState<string | null>(null)
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const anchorRefs = useRef<Record<string, HTMLButtonElement | null>>({})

  const openAgent = useCallback((id: string) => {
    const el = anchorRefs.current[id]
    if (!el) return
    if (openId === id) {
      setOpenId(null)
      setAnchorRect(null)
      return
    }
    setAnchorRect(el.getBoundingClientRect())
    setOpenId(id)
  }, [openId])

  const closePopover = useCallback(() => {
    setOpenId(null)
    setAnchorRect(null)
  }, [])

  const copyText = useCallback(async (id: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedId(id)
      window.setTimeout(() => setCopiedId(null), 2000)
    } catch {
      setCopiedId(null)
    }
  }, [])

  const activeAgent = openId ? agents.find((a) => a.id === openId) : null

  return (
    <div className="mb-7">
      <p
        className="mb-3 text-[#8f8f8f]"
        style={{ fontFamily: SANS, fontWeight: 400, fontSize: '1.125rem', lineHeight: 1.5 }}
      >
        Set up with your coding agent
      </p>
      <div className="flex flex-wrap items-center gap-1">
        {agents.map((agent) => (
          <AgentLogo
            key={agent.id}
            ref={(el) => {
              anchorRefs.current[agent.id] = el
            }}
            agent={agent}
            active={openId === agent.id}
            onClick={() => openAgent(agent.id)}
          />
        ))}
      </div>
      {activeAgent && anchorRect && (
        <AgentPopover
          agent={activeAgent}
          anchorRect={anchorRect}
          copiedId={copiedId}
          onCopy={copyText}
          onClose={closePopover}
        />
      )}
    </div>
  )
}