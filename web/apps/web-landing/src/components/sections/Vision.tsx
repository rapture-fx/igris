'use client'

import type { CSSProperties, ReactNode } from 'react'
import Link from 'next/link'
import Footer from './Footer'

const SANS = 'var(--font-geist-sans), -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif'

const LINE_1_CONT = ' to call APIs, trigger workflows, access files, and run tasks through one controlled action layer.'
const LINE_2_CONT = ' in Cloud, webhooks, MCP, and connected workers, with policy, recovery, and receipts built in.'
const LINE_3_CONT = ' that record what happened, recover from failures, and leave evidence your team can inspect.'

const TITLE_STYLE: CSSProperties = {
  fontFamily: SANS,
  fontWeight: 400,
  fontSize: 'clamp(2rem, 5vw, 3.2rem)',
  lineHeight: 1.12,
  letterSpacing: '-0.045em',
}

// One inline phrase of the title. The continuation text is hidden until the
// phrase is hovered, then revealed inline (pure CSS, no layout animation).
function HoverPhrase({ base, cont }: { base: ReactNode; cont: string }) {
  return (
    <span className="group cursor-default">
      <span>{base}</span>
      <span className="hidden font-normal text-[#8f8f8f] group-hover:inline">{cont}</span>
    </span>
  )
}

type Block =
  | { type: 'kicker'; text: string }
  | { type: 'h2'; text: string }
  | { type: 'section'; text: string }
  | { type: 'sub'; text: string }
  | { type: 'lead'; text: string }
  | { type: 'p'; text: string }
  | { type: 'code'; text: string }
  | { type: 'divider' }

const ARTICLE: Block[] = [
  { type: 'h2', text: 'Action layer' },
  { type: 'lead', text: 'Igris lets AI agents act in real systems without giving them direct access to every tool, credential, workflow, or production endpoint. Instead of letting an agent call a system directly and hoping the result is safe, the agent sends the action through Igris first, where the request can be checked, routed, executed, recovered if something fails, and recorded with proof your team can inspect later.' },
  { type: 'p', text: 'Igris does not control how an agent thinks or plans. It controls how the action happens once the agent is ready to do something real. That gives teams a clear boundary between agent reasoning and production execution, so agents can become useful without turning every tool call into an unmanaged risk.' },

  { type: 'section', text: 'Why direct calls are not enough' },
  { type: 'p', text: 'Direct calls are simple when an agent is only running a demo, but they become harder to trust once the action touches real systems. A direct request may complete successfully, but it rarely gives the team one consistent place to understand who requested the action, whether it was allowed, whether approval was needed, what happened when it failed, whether recovery was attempted, and what proof exists after the action finished.' },
  { type: 'p', text: 'Igris gives agent actions a shared execution path. Instead of spreading control across tool logs, hidden scripts, local credentials, and one-off integrations, Igris makes the action visible from the moment it is requested to the moment it is reviewed. The agent still decides what it wants to do, but the action moves through a controlled layer where policy, execution, recovery, and proof can be applied consistently.' },

  { type: 'section', text: 'How agents, actions, and connections work' },
  { type: 'p', text: 'The Igris model is simple. Agents are the systems that request work, actions are the things those agents are allowed to do, and connections are the places where that work is executed. An agent connects to Igris once, then calls registered actions through Igris instead of holding direct access to every tool, credential, workflow, or production endpoint.' },
  { type: 'p', text: 'An action can represent almost anything a team wants to make available to an agent, from sending a message and opening a ticket to calling an internal service, updating a record, triggering a workflow, or running an operation in a private runtime. A connection defines where that action goes, whether that is an external service, an internal API, a webhook, a local worker, or a hosted runtime. Together, these parts give teams a clear map of what agents can do, where the work goes, and what happened after the request was made.' },

  { type: 'section', text: 'Policy, recovery, and proof' },
  { type: 'p', text: 'Policy decides how an action is allowed to happen. Some actions can run automatically, some should require approval, and some should be blocked depending on the agent, the input, the environment, or the risk of the operation. This gives teams control without removing the agent’s ability to reason, plan, and request useful work.' },
  { type: 'p', text: 'Recovery makes failure part of the system instead of something hidden in a log somewhere else. Actions can timeout, services can return errors, runtimes can go offline, and requests can break in unexpected ways. Igris records the failure path, shows whether recovery was attempted, and helps the team understand what still needs attention.' },
  { type: 'p', text: 'Proof gives the team a record after the action runs. Instead of relying on the agent’s own explanation, the team can inspect the run, see what was requested, understand how the action moved through policy and execution, and review the final result in the console. This matters when agent actions affect real workflows, real systems, or real customers.' },

  { type: 'section', text: 'When to use Igris' },
  { type: 'p', text: 'Use Igris when agents need to do more than answer questions. If an agent is allowed to trigger work, change records, call services, send requests, open tasks, touch private systems, or perform operational steps, then the action needs more than a direct call. It needs a path that the team can control, inspect, recover, and improve over time.' },
  { type: 'p', text: 'Igris helps teams move from “the agent can call a tool” to “the agent can act through a controlled execution layer.” It gives the team one place to define actions, connect systems, apply policy, inspect runs, review proof, and understand where agent actions are becoming safe enough to trust.' },

  { type: 'section', text: 'Get started' },
  { type: 'p', text: 'Install Igris and connect your first agent.' },
  { type: 'code', text: 'curl -fsSL https://igrisinertial.com/install | bash' },
  { type: 'p', text: 'After installation, log in, connect an agent, register an action, run it, and review the result in the console. The first setup should be simple: connect the agent once, let it call Igris, and use Igris as the action layer between agent reasoning and real system execution.' },
]

function ArticleBlock({ block }: { block: Block }) {
  switch (block.type) {
    case 'kicker':
      return (
        <p
          className="mb-4 text-xs font-medium uppercase text-[#8f8f8f]"
          style={{ fontFamily: SANS, letterSpacing: '0.18em' }}
        >
          {block.text}
        </p>
      )
    case 'h2':
      return (
        <h3
          className="mb-5 text-[#171717]"
          style={{ fontFamily: SANS, fontWeight: 600, fontSize: 'clamp(2.5rem, 6vw, 4rem)', lineHeight: 1.05, letterSpacing: '-0.045em' }}
        >
          {block.text}
        </h3>
      )
    case 'section':
      return (
        <h4
          className="mb-5 mt-16 text-[#171717]"
          style={{ fontFamily: SANS, fontWeight: 600, fontSize: 'clamp(1.5rem, 3.4vw, 2rem)', lineHeight: 1.15, letterSpacing: '-0.03em' }}
        >
          {block.text}
        </h4>
      )
    case 'sub':
      return (
        <h5
          className="mb-3 mt-12 text-[#171717]"
          style={{ fontFamily: SANS, fontWeight: 600, fontSize: '1.0625rem', lineHeight: 1.4, letterSpacing: '-0.01em' }}
        >
          {block.text}
        </h5>
      )
    case 'lead':
      return (
        <p
          className="mb-8 text-[#171717]"
          style={{ fontFamily: SANS, fontWeight: 400, fontSize: 'clamp(1.5rem, 2.8vw, 1.875rem)', lineHeight: 1.45, letterSpacing: '-0.02em' }}
        >
          {block.text}
        </p>
      )
    case 'p':
      return (
        <p
          className="mb-6 text-[#27272a]"
          style={{ fontFamily: SANS, fontWeight: 400, fontSize: '1.375rem', lineHeight: 1.75 }}
        >
          {block.text}
        </p>
      )
    case 'code':
      return (
        <p
          className="mb-7 whitespace-pre-line text-[#27272a]"
          style={{ fontFamily: SANS, fontWeight: 400, fontSize: '1.375rem', lineHeight: 1.75 }}
        >
          {block.text}
        </p>
      )
    case 'divider':
      return <hr className="my-14 border-0 border-t border-[#ececec]" />
    default:
      return null
  }
}

export default function Vision() {
  // ARTICLE[0] is the "Action layer" title, now rendered as the hero below.
  const bodyBlocks = ARTICLE.slice(1)

  return (
    <section
      aria-labelledby="vision-heading"
      className="bg-white text-[#171717]"
    >
      <h2 id="vision-heading" className="sr-only">Vision</h2>
      <div className="mx-auto max-w-[960px] px-4 pt-24 pb-24 sm:px-6 lg:px-8 md:pt-36 md:pb-28">
        <article>
          <div className="max-w-[640px]">
            <h3 className="mb-14 mt-3 text-black" style={TITLE_STYLE}>
              <HoverPhrase base={<>Action layer <span className="underline underline-offset-4 decoration-[#d4d4d4] decoration-2">for AI agents</span></>} cont={LINE_1_CONT} />
              <br />
              <HoverPhrase base={<span className="underline underline-offset-4 decoration-[#d4d4d4] decoration-2">To execute safely</span>} cont={LINE_2_CONT} />
              {' and '}
              <HoverPhrase base={<span className="underline underline-offset-4 decoration-[#d4d4d4] decoration-2">proven by runs</span>} cont={LINE_3_CONT} />
            </h3>

            <div className="flex flex-wrap items-center gap-4 mb-14">
              <Link
                href="/auth?mode=signup"
                prefetch={false}
                className="inline-flex h-12 items-center justify-center rounded-[20px] px-6 bg-[#171717] text-white text-[15px] hover:bg-[#383838] transition-colors"
                style={{ fontFamily: SANS, fontWeight: 500 }}
              >
                Get API Key
              </Link>
              <Link
                href="/auth?mode=signin"
                prefetch={false}
                className="inline-flex h-12 items-center justify-center rounded-[20px] border border-[rgba(0,0,0,0.1)] dark:border-white/[0.12] bg-white dark:bg-transparent px-6 text-[15px] text-[#171717] dark:text-[#f6f6f4] hover:bg-[#fafafa] dark:hover:bg-white/[0.06] hover:border-[rgba(0,0,0,0.15)] transition-colors"
                style={{ fontFamily: SANS, fontWeight: 500 }}
              >
                Setup an Agent
              </Link>
            </div>
          </div>

          {bodyBlocks.map((block, index) => (
            <ArticleBlock key={index} block={block} />
          ))}
        </article>
      </div>

      <Footer />
    </section>
  )
}