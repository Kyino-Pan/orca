import { planSourceControlAgentActionLaunch } from '@/lib/source-control-agent-action-plan'
import { useAppStore } from '@/store'
import type { TuiAgent } from '../../../../shared/tui-agent'
import type { SourceControlAgentActionDeliveryPlanState } from './SourceControlAgentActionDialogForm'
import { buildSourceControlAgentConnectionErrorPlan } from './source-control-agent-action-dialog-support'
import { resolveInitialNativeChatSessionOptions } from '@/components/native-chat/native-chat-launch-session-options'
import { isNativeChatTranscriptLocalReadable } from '@/lib/native-chat-transcript-readability'

type BuildSourceControlAgentDeliveryPlanArgs = {
  selectedAgent: TuiAgent | null
  commandInput: string
  agentArgs?: string | undefined
  promptDelivery: 'auto-submit' | 'draft' | 'submit-after-ready'
  detectedAgents: TuiAgent[]
  connectionUnavailable: boolean
  launchPlatform?: NodeJS.Platform
  /** Why: keep the previewed command label in sync with the real remote launch,
   * which omits the Linux-only `orca-ide` rename for SSH hosts. */
  isRemote?: boolean
  /** The worktree's SSH target (null = local); Model B `runtime-ssh-` targets still read the transcript. */
  connectionId?: string | null
}

export function buildSourceControlAgentDeliveryPlan({
  selectedAgent,
  commandInput,
  agentArgs,
  promptDelivery,
  detectedAgents,
  connectionUnavailable,
  launchPlatform,
  isRemote,
  connectionId
}: BuildSourceControlAgentDeliveryPlanArgs): SourceControlAgentActionDeliveryPlanState {
  if (connectionUnavailable) {
    return buildSourceControlAgentConnectionErrorPlan()
  }
  const settings = useAppStore.getState().settings
  const result = planSourceControlAgentActionLaunch({
    agent: selectedAgent,
    commandInput,
    agentArgs,
    sessionOptions: selectedAgent
      ? resolveInitialNativeChatSessionOptions(settings, {
          agent: selectedAgent,
          promptDelivery,
          launchDraftText: commandInput.trim(),
          nativeChatTranscriptIsLocalReadable: isNativeChatTranscriptLocalReadable(connectionId)
        })
      : undefined,
    promptDelivery,
    detectedAgents,
    disabledAgents: settings?.disabledTuiAgents,
    cmdOverrides: settings?.agentCmdOverrides,
    terminalWindowsShell: settings?.terminalWindowsShell,
    platform: launchPlatform,
    isRemote
  })
  if (!result.ok) {
    return { status: 'error', error: result.error }
  }
  return {
    status: 'success',
    summary: result.summary,
    commandLabel: result.commandLabel,
    caveat: result.caveat
  }
}
