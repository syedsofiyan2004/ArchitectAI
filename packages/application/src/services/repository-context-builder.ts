import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  EngineeringContract,
  RepositoryWorkspace,
  RepositoryContext,
  RepositoryContextSchema,
} from '@architectai/domain';
import {
  isSensitivePath,
  isBinaryOrHugeFile,
  isSafeSymlink,
} from './git-workspace.service.js';

export interface ContextBudgetOptions {
  maxFiles?: number;
  maxBytes?: number;
}

export class RepositoryContextBuilder {
  async buildContext(
    contract: EngineeringContract,
    workspace: RepositoryWorkspace,
    budget: ContextBudgetOptions = {}
  ): Promise<RepositoryContext> {
    const repoPath = workspace.repositoryPath;
    const maxFiles = budget.maxFiles ?? 30;
    const maxBytes = budget.maxBytes ?? 256 * 1024; // 256 KB

    let filesInspected = 0;
    let filesOmitted = 0;

    // Collect all candidate code files
    const allFiles = this.collectSourceFiles(repoPath, repoPath, (inspected, omitted) => {
      filesInspected += inspected;
      filesOmitted += omitted;
    });

    // Extract keywords from concerns, decisions, and invariants
    const terms = new Set<string>();
    for (const concern of contract.discoveredConcerns) {
      this.extractWords(concern.title, terms);
      this.extractWords(concern.description, terms);
      for (const d of concern.dimensions) {
        this.extractWords(d, terms);
      }
    }
    for (const dec of contract.decisions) {
      if (dec.selectedOptionName) {
        this.extractWords(dec.selectedOptionName, terms);
      }
      this.extractWords(dec.problemContext, terms);
    }
    for (const inv of contract.invariants) {
      this.extractWords(inv.property, terms);
    }

    // Identify probable entry points
    const probableEntryPoints = allFiles.filter((f) => {
      const base = path.basename(f).toLowerCase();
      return (
        base === 'index.ts' ||
        base === 'index.js' ||
        base === 'main.ts' ||
        base === 'main.js' ||
        base === 'server.ts' ||
        base === 'server.js' ||
        base === 'app.ts' ||
        base === 'app.js'
      );
    });

    // Identify test files
    const existingTests = allFiles.filter((f) => {
      const lower = f.toLowerCase();
      return (
        lower.includes('.test.') ||
        lower.includes('.spec.') ||
        lower.startsWith('test.') ||
        lower.startsWith('test_') ||
        lower.startsWith('test/') ||
        lower.startsWith('tests/') ||
        lower.includes('/test/') ||
        lower.includes('/tests/')
      );
    });

    // Score and filter relevant files
    const relevantFilesSet = new Set<string>();
    for (const entry of probableEntryPoints) {
      relevantFilesSet.add(entry);
    }
    for (const test of existingTests) {
      relevantFilesSet.add(test);
    }

    for (const file of allFiles) {
      if (relevantFilesSet.has(file)) continue;
      const lower = file.toLowerCase();
      for (const term of terms) {
        if (term.length > 3 && lower.includes(term.toLowerCase())) {
          relevantFilesSet.add(file);
          break;
        }
      }
    }

    // Bound context size by files and bytes
    const boundedCandidates = Array.from(relevantFilesSet);
    const relevantFiles: string[] = [];
    let contextBytes = 0;

    for (const file of boundedCandidates) {
      if (relevantFiles.length >= maxFiles) {
        filesOmitted++;
        continue;
      }

      const fullPath = path.join(repoPath, file);
      let size = 0;
      try {
        size = fs.statSync(fullPath).size;
      } catch {
        // ignore
      }

      if (contextBytes + size > maxBytes && relevantFiles.length > 0) {
        filesOmitted++;
        continue;
      }

      relevantFiles.push(file);
      contextBytes += size;
    }

    // Identify relevant directories
    const relevantDirsSet = new Set<string>();
    for (const file of relevantFiles) {
      const dir = path.dirname(file);
      if (dir !== '.' && !isSensitivePath(dir)) {
        relevantDirsSet.add(dir.replace(/\\/g, '/'));
      }
    }
    const relevantDirectories = Array.from(relevantDirsSet);

    // Implementation observations
    const observations: string[] = [];
    if (workspace.detectedLanguages.length > 0) {
      observations.push(`Languages detected: ${workspace.detectedLanguages.join(', ')}.`);
    }
    if (workspace.detectedFrameworks.length > 0) {
      observations.push(`Frameworks & libraries detected: ${workspace.detectedFrameworks.join(', ')}.`);
    }
    if (existingTests.length > 0) {
      observations.push(`Existing test files found: ${existingTests.slice(0, 5).join(', ')}${existingTests.length > 5 ? '...' : ''}.`);
    } else {
      observations.push('No existing test suite detected in source tree.');
    }
    if (workspace.buildScripts['test']) {
      observations.push(`Repository defines test script: '${workspace.buildScripts['test']}'.`);
    }
    if (workspace.buildScripts['build']) {
      observations.push(`Repository defines build script: '${workspace.buildScripts['build']}'.`);
    }
    observations.push(`Git status is ${workspace.isClean ? 'clean' : 'dirty'} at commit ${workspace.headCommit.slice(0, 8)} on branch '${workspace.currentBranch}'.`);

    // Unresolved questions
    const unresolvedQuestions = [...contract.unresolvedQuestions];
    if (!workspace.buildScripts['test'] && existingTests.length > 0) {
      unresolvedQuestions.push('How should tests be executed if no package.json test script is declared?');
    }

    const selectionRationale = `Selected ${relevantFiles.length} files (${contextBytes} bytes) based on entry point detection, test coverage, and semantic keyword matching from ${contract.discoveredConcerns.length} contract concerns. ${filesOmitted} files omitted to preserve context bounds.`;

    return RepositoryContextSchema.parse({
      repositoryPath: workspace.repositoryPath,
      relevantFiles,
      relevantDirectories,
      relevantManifests: workspace.packageManifests,
      probableEntryPoints,
      existingTests,
      implementationObservations: observations,
      unresolvedQuestions,
      filesInspected,
      filesOmitted,
      contextBytes,
      selectionRationale,
    });
  }

  private collectSourceFiles(
    dir: string,
    baseDir: string = dir,
    onCount?: (inspected: number, omitted: number) => void
  ): string[] {
    const results: string[] = [];
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        const relPath = path.relative(baseDir, fullPath).replace(/\\/g, '/');

        // Secret and credential scanning filter
        if (isSensitivePath(relPath)) {
          if (onCount) onCount(1, 1);
          continue;
        }

        // Symlink boundary safety: never follow external symlinks
        if (entry.isSymbolicLink()) {
          if (!isSafeSymlink(fullPath, baseDir)) {
            if (onCount) onCount(1, 1);
            continue;
          }
        }

        if (entry.isDirectory()) {
          results.push(...this.collectSourceFiles(fullPath, baseDir, onCount));
        } else if (entry.isFile()) {
          // Binary and huge file filter
          if (isBinaryOrHugeFile(relPath, fullPath)) {
            if (onCount) onCount(1, 1);
            continue;
          }

          if (onCount) onCount(1, 0);
          results.push(relPath);
        }
      }
    } catch {
      // ignore unreadable dirs
    }
    return results;
  }

  private extractWords(text: string | undefined | null, wordsSet: Set<string>): void {
    if (!text || typeof text !== 'string') return;
    const matches = text.match(/[A-Za-z0-9_]{3,}/g);
    if (matches) {
      for (const w of matches) {
        wordsSet.add(w.toLowerCase());
      }
    }
  }
}
