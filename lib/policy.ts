export type GoverningSourceInput = {
  authorityLevel: string;
  policyDocumentId?: unknown;
  mouDocumentId?: unknown;
  publicSources?: unknown;
};

export function hasGoverningSource(input: GoverningSourceInput) {
  if (input.authorityLevel === "Employer MOU") return Boolean(input.mouDocumentId);
  if (input.policyDocumentId) return true;
  if (!Array.isArray(input.publicSources)) return false;
  return input.publicSources.some((source) => Boolean(source && typeof source === "object" && "url" in source && String(source.url).startsWith("https://")));
}
