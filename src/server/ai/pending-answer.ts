const pending = new Map<string, Promise<string>>();

export async function pendingAnswer(key: string, choose: () => Promise<string>): Promise<string> {
  const existing = pending.get(key);
  if (existing) return existing;
  const request = choose();
  pending.set(key, request);
  try {
    return await request;
  } finally {
    pending.delete(key);
  }
}
