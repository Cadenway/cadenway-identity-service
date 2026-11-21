/** Names the AuthnRequest by the unique ID of its already persisted Identity flow. */
export function samlRequestId(flowId: string): string {
  return `_${flowId}`;
}
