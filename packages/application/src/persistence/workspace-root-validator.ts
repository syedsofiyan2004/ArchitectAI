import * as path from 'node:path';

export class WorkspaceRootValidator {
  public static isPathAllowed(candidatePath: string, allowedRoots: string[]): boolean {
    if (!allowedRoots || allowedRoots.length === 0) {
      return true;
    }

    const resolvedCandidate = path.resolve(candidatePath);

    for (const root of allowedRoots) {
      const resolvedRoot = path.resolve(root);
      const relative = path.relative(resolvedRoot, resolvedCandidate);
      // If relative does not start with '..' and is not absolute, it is inside or equal to the root
      if (!relative.startsWith('..') && !path.isAbsolute(relative)) {
        return true;
      }
    }

    return false;
  }

  public static assertPathAllowed(candidatePath: string, allowedRoots: string[]): void {
    if (!this.isPathAllowed(candidatePath, allowedRoots)) {
      throw new Error(
        `Security restriction: Repository path '${candidatePath}' is not within any configured allowed workspace root [${allowedRoots.join(', ')}].`
      );
    }
  }
}
