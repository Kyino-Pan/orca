import { describe, expect, it } from 'vitest'
import {
  isNativeChatSupportedAgent,
  nativeChatRequiresLocalTranscript,
  resolveNativeChatTranscriptAgent,
  shouldStepNativeChatAskAnswer
} from './native-chat-agent-support'

describe('resolveNativeChatTranscriptAgent', () => {
  it('maps OpenClaude onto the Claude transcript format', () => {
    expect(resolveNativeChatTranscriptAgent('openclaude')).toBe('claude')
    expect(resolveNativeChatTranscriptAgent('claude')).toBe('claude')
  })

  it('passes codex, grok and omp through and rejects everything else', () => {
    expect(resolveNativeChatTranscriptAgent('codex')).toBe('codex')
    expect(resolveNativeChatTranscriptAgent('grok')).toBe('grok')
    expect(resolveNativeChatTranscriptAgent('omp')).toBe('omp')
    expect(resolveNativeChatTranscriptAgent('cursor')).toBeNull()
    expect(resolveNativeChatTranscriptAgent(null)).toBeNull()
    expect(resolveNativeChatTranscriptAgent(undefined)).toBeNull()
  })
})

describe('isNativeChatSupportedAgent', () => {
  it('recognizes the parseable agents and rejects unknown / nullish input', () => {
    expect(isNativeChatSupportedAgent('claude')).toBe(true)
    expect(isNativeChatSupportedAgent('openclaude')).toBe(true)
    expect(isNativeChatSupportedAgent('omp')).toBe(true)
    expect(isNativeChatSupportedAgent('cursor')).toBe(false)
    expect(isNativeChatSupportedAgent(null)).toBe(false)
    expect(isNativeChatSupportedAgent(undefined)).toBe(false)
  })
})

describe('nativeChatRequiresLocalTranscript', () => {
  it('gates every transcript-backed agent on a host-readable transcript', () => {
    // Why (#13663): the file-backed reader resolves paths on the serving host
    // only, so a hook-reported Claude/Codex path on a Model-A SSH target is as
    // unreachable as the undisclosed Grok/omp one.
    expect(nativeChatRequiresLocalTranscript('grok')).toBe(true)
    expect(nativeChatRequiresLocalTranscript('omp')).toBe(true)
    expect(nativeChatRequiresLocalTranscript('claude')).toBe(true)
    expect(nativeChatRequiresLocalTranscript('openclaude')).toBe(true)
    expect(nativeChatRequiresLocalTranscript('codex')).toBe(true)
  })

  it('leaves agents without a native chat transcript ungated', () => {
    expect(nativeChatRequiresLocalTranscript('cursor')).toBe(false)
    expect(nativeChatRequiresLocalTranscript(null)).toBe(false)
    expect(nativeChatRequiresLocalTranscript(undefined)).toBe(false)
  })
})

describe('shouldStepNativeChatAskAnswer', () => {
  it('steps the digit-commit selector agents (Claude, OpenClaude, Codex)', () => {
    expect(shouldStepNativeChatAskAnswer('claude')).toBe(true)
    expect(shouldStepNativeChatAskAnswer('openclaude')).toBe(true)
    // Codex 0.145's request_user_input card ignores typed labels and commits on
    // the highlighted row, so pasted answers misdeliver like STA-1860.
    expect(shouldStepNativeChatAskAnswer('codex')).toBe(true)
  })

  it('does not step other or unknown agents', () => {
    expect(shouldStepNativeChatAskAnswer('grok')).toBe(false)
    expect(shouldStepNativeChatAskAnswer('omp')).toBe(false)
    expect(shouldStepNativeChatAskAnswer('cursor')).toBe(false)
    expect(shouldStepNativeChatAskAnswer(null)).toBe(false)
    expect(shouldStepNativeChatAskAnswer(undefined)).toBe(false)
  })
})
