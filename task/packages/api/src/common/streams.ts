// Stream naming is shared by every command that reads or writes a
// candidate or a slot, so both feature services use the same helpers
// instead of building the string inline.
export function candidateStream(candidateId: string): string {
  return `candidate-${candidateId}`;
}

export function slotStream(slotId: string): string {
  return `slot-${slotId}`;
}
