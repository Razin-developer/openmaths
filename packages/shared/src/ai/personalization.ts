interface PersonalizationData {
  role?: string;
  subjects?: string;
  about?: string;
}

/** Turns the user's saved personalization answers into a short prose block for the system prompt. */
export function formatPersonalization(raw: unknown): string | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const data = raw as PersonalizationData;
  const lines: string[] = [];
  if (data.role?.trim()) lines.push(`Role/level: ${data.role.trim()}`);
  if (data.subjects?.trim()) lines.push(`Focus subjects: ${data.subjects.trim()}`);
  if (data.about?.trim()) lines.push(`Notes: ${data.about.trim()}`);
  return lines.length > 0 ? lines.join("\n") : undefined;
}
