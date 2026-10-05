import { z } from 'zod';

export const PackageManifestSummarySchema = z.object({
  path: z.string(),
  name: z.string().optional(),
  version: z.string().optional(),
  dependencies: z.record(z.string()).default({}),
  devDependencies: z.record(z.string()).default({}),
  scripts: z.record(z.string()).default({}),
});
export type PackageManifestSummary = z.infer<typeof PackageManifestSummarySchema>;

export const RepositoryWorkspaceSchema = z.object({
  repositoryPath: z.string(),
  currentBranch: z.string(),
  headCommit: z.string(),
  isClean: z.boolean(),
  detectedLanguages: z.array(z.string()).default([]),
  detectedFrameworks: z.array(z.string()).default([]),
  packageManifests: z.array(PackageManifestSummarySchema).default([]),
  buildScripts: z.record(z.string()).default({}),
  majorDirectories: z.array(z.string()).default([]),
  trackedFileCount: z.number().default(0),
});
export type RepositoryWorkspace = z.infer<typeof RepositoryWorkspaceSchema>;

export const RepositoryContextSchema = z.object({
  repositoryPath: z.string(),
  relevantFiles: z.array(z.string()).default([]),
  relevantDirectories: z.array(z.string()).default([]),
  relevantManifests: z.array(PackageManifestSummarySchema).default([]),
  probableEntryPoints: z.array(z.string()).default([]),
  existingTests: z.array(z.string()).default([]),
  implementationObservations: z.array(z.string()).default([]),
  unresolvedQuestions: z.array(z.string()).default([]),
});
export type RepositoryContext = z.infer<typeof RepositoryContextSchema>;
