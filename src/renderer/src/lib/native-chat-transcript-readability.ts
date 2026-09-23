import { isRuntimeOwnedSshTargetId } from '../../../shared/execution-host'

/** Model-A SSH stores agent transcripts on a host this renderer's reader cannot open (#13663). */
export function isNativeChatTranscriptLocalReadable(
  connectionId: string | null | undefined
): boolean {
  return connectionId === null || isRuntimeOwnedSshTargetId(connectionId)
}
