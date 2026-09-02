import type { GitHubReadmeDocument } from "./github";

export const MAX_CACHED_README_CHARACTERS = 250_000;

type CachedReadmeFields = {
  readmeContent: string | null;
  readmePath: string | null;
  readmeHtmlUrl: string | null;
  readmeRawUrl: string | null;
  readmeCachedAt: Date | null;
};

type ReadmeCacheWriteValues = Omit<CachedReadmeFields, "readmeCachedAt"> & {
  readmeCachedAt: Date;
};

export function readmeCacheValues(
  document: GitHubReadmeDocument | null,
  cachedAt = new Date(),
): ReadmeCacheWriteValues {
  return {
    readmeContent: document?.content.slice(0, MAX_CACHED_README_CHARACTERS) ?? null,
    readmePath: document?.path ?? null,
    readmeHtmlUrl: document?.htmlUrl ?? null,
    readmeRawUrl: document?.rawUrl ?? null,
    readmeCachedAt: cachedAt,
  };
}

export function cachedReadmeDocument(fields: CachedReadmeFields | null | undefined): GitHubReadmeDocument | null {
  if (!fields?.readmeContent || !fields.readmeCachedAt) return null;
  return {
    content: fields.readmeContent,
    path: fields.readmePath ?? "README.md",
    htmlUrl: fields.readmeHtmlUrl,
    rawUrl: fields.readmeRawUrl,
  };
}
