import { describe, expect, it } from 'vitest'
import type { AgentStatusEntry } from '../../../src/shared/agent-status-types'
import {
  canShowMobileNativeChat,
  isMobileNativeChatTranscriptReadable,
  resolveMobileNativeChat
} from './mobile-native-chat-eligibility'

function status(overrides: Partial<AgentStatusEntry> = {}): AgentStatusEntry {
  return {
    state: 'working',
    prompt: '',
    updatedAt: 0,
    stateStartedAt: 0,
    paneKey: 'tab:leaf',
    ...overrides
  } as AgentStatusEntry
}

describe('resolveMobileNativeChat', () => {
  it('prefers the authoritative supported live agent over a stale launch hint', () => {
    expect(
      resolveMobileNativeChat(
        {
          type: 'terminal',
          launchAgent: 'claude',
          agentStatus: status({
            agentType: 'codex',
            providerSession: {
              key: 'session_id',
              id: 'codex-session',
              transcriptPath: '/tmp/codex.jsonl'
            }
          })
        },
        isMobileNativeChatTranscriptReadable(null)
      )
    ).toMatchObject({ agent: 'codex', sessionId: 'codex-session' })
  })

  it('rejects an unsupported live agent instead of combining it with a stale hint', () => {
    expect(
      resolveMobileNativeChat({
        type: 'terminal',
        launchAgent: 'claude',
        agentStatus: {
          agentType: 'gemini',
          providerSession: { id: 'gemini-session', transcriptPath: '/tmp/gemini.jsonl' }
        }
      } as never)
    ).toBeNull()
  })
  it('resolves agent + sessionId from launchAgent and provider session', () => {
    expect(
      resolveMobileNativeChat(
        {
          type: 'terminal',
          launchAgent: 'claude',
          agentStatus: status({
            providerSession: {
              key: 'session_id',
              id: 'sess-1',
              transcriptPath: '/tmp/claude-real-transcript.jsonl'
            }
          })
        },
        isMobileNativeChatTranscriptReadable(null)
      )
    ).toEqual({
      agent: 'claude',
      sessionId: 'sess-1',
      transcriptPath: '/tmp/claude-real-transcript.jsonl'
    })
  })

  it('falls back to agentStatus.agentType when no launchAgent', () => {
    expect(
      resolveMobileNativeChat(
        {
          type: 'terminal',
          agentStatus: status({ agentType: 'codex' })
        },
        isMobileNativeChatTranscriptReadable(null)
      )
    ).toEqual({ agent: 'codex', sessionId: null, transcriptPath: null })
  })

  it('admits OpenClaude with its distinct agent identity', () => {
    expect(
      resolveMobileNativeChat(
        { type: 'terminal', launchAgent: 'openclaude' },
        isMobileNativeChatTranscriptReadable(null)
      )
    ).toEqual({
      agent: 'openclaude',
      sessionId: null,
      transcriptPath: null
    })
  })

  it('returns null for unsupported agents', () => {
    expect(resolveMobileNativeChat({ type: 'terminal', launchAgent: 'gemini' })).toBeNull()
  })

  it('admits Grok only when its transcript is readable by the serving host', () => {
    const tab = { type: 'terminal', launchAgent: 'grok' }
    expect(resolveMobileNativeChat(tab, isMobileNativeChatTranscriptReadable(null))).toMatchObject({
      agent: 'grok'
    })
    expect(
      resolveMobileNativeChat(tab, isMobileNativeChatTranscriptReadable('runtime-ssh-environment'))
    ).toMatchObject({ agent: 'grok' })
    expect(
      resolveMobileNativeChat(tab, isMobileNativeChatTranscriptReadable('model-a-ssh'))
    ).toBeNull()
  })

  // Why: omp's hook reports no transcript path either, so mobile can only show
  // its chat when the serving host is the one holding the session file.
  it('admits omp only when its transcript is readable by the serving host', () => {
    const tab = { type: 'terminal', launchAgent: 'omp' }
    expect(resolveMobileNativeChat(tab, isMobileNativeChatTranscriptReadable(null))).toMatchObject({
      agent: 'omp'
    })
    expect(
      resolveMobileNativeChat(tab, isMobileNativeChatTranscriptReadable('runtime-ssh-environment'))
    ).toMatchObject({ agent: 'omp' })
    expect(
      resolveMobileNativeChat(tab, isMobileNativeChatTranscriptReadable('model-a-ssh'))
    ).toBeNull()
    expect(canShowMobileNativeChat(tab, isMobileNativeChatTranscriptReadable('model-a-ssh'))).toBe(
      false
    )
  })

  // Why (#13663): Claude/Codex hooks do report a path, but on a Model-A SSH
  // worktree it names a file on the target; the serving host cannot open it and
  // settles into an empty transcript instead of an error.
  it.each(['claude', 'openclaude', 'codex'] as const)(
    'admits %s only when its transcript is readable by the serving host',
    (launchAgent) => {
      const tab = { type: 'terminal', launchAgent }
      expect(
        resolveMobileNativeChat(tab, isMobileNativeChatTranscriptReadable(null))
      ).toMatchObject({ agent: launchAgent })
      expect(
        resolveMobileNativeChat(
          tab,
          isMobileNativeChatTranscriptReadable('runtime-ssh-environment')
        )
      ).toMatchObject({ agent: launchAgent })
      expect(
        resolveMobileNativeChat(tab, isMobileNativeChatTranscriptReadable('model-a-ssh'))
      ).toBeNull()
      expect(
        canShowMobileNativeChat(tab, isMobileNativeChatTranscriptReadable('model-a-ssh'))
      ).toBe(false)
    }
  )

  it('rejects a hook-reported Codex transcript path that lives on a Model-A SSH target', () => {
    expect(
      resolveMobileNativeChat(
        {
          type: 'terminal',
          launchAgent: 'codex',
          agentStatus: status({
            agentType: 'codex',
            providerSession: {
              key: 'session_id',
              id: 'sess-remote',
              transcriptPath: '/home/remote/.codex/sessions/rollout.jsonl'
            }
          })
        },
        isMobileNativeChatTranscriptReadable('ssh-target-1')
      )
    ).toBeNull()
  })

  it('returns null for a plain shell (no agent)', () => {
    expect(resolveMobileNativeChat({ type: 'terminal' })).toBeNull()
  })

  it('returns null for non-terminal tabs', () => {
    expect(resolveMobileNativeChat({ type: 'browser', launchAgent: 'claude' })).toBeNull()
  })

  it('resolves Codex structured agent-session tabs directly', () => {
    expect(
      resolveMobileNativeChat({
        type: 'agent-session',
        sessionId: 'structured-1',
        agent: 'codex'
      })
    ).toEqual({
      agent: 'codex',
      sessionId: 'structured-1',
      transcriptPath: null
    })
  })

  it('resolves Claude structured agent-session tabs on the same journal path', () => {
    expect(
      resolveMobileNativeChat({
        type: 'agent-session',
        sessionId: 'structured-1',
        agent: 'claude'
      })
    ).toEqual({
      agent: 'claude',
      sessionId: 'structured-1',
      transcriptPath: null
    })
  })

  it('keeps structured agent-session tabs off the transcript-readability gate', () => {
    expect(
      resolveMobileNativeChat(
        { type: 'agent-session', sessionId: 'structured-1', agent: 'claude' },
        isMobileNativeChatTranscriptReadable('model-a-ssh')
      )
    ).toMatchObject({ agent: 'claude', sessionId: 'structured-1' })
  })

  it('rejects structured agent-session tabs whose provider the reducer cannot replay', () => {
    expect(
      resolveMobileNativeChat({
        type: 'agent-session',
        sessionId: 'structured-1',
        agent: 'grok'
      })
    ).toBeNull()
  })

  it('canShowMobileNativeChat mirrors resolution', () => {
    const tab = { type: 'terminal', launchAgent: 'claude' }
    expect(canShowMobileNativeChat(tab, isMobileNativeChatTranscriptReadable(null))).toBe(true)
    expect(canShowMobileNativeChat(tab, isMobileNativeChatTranscriptReadable('model-a-ssh'))).toBe(
      false
    )
    expect(canShowMobileNativeChat(null)).toBe(false)
  })
})
