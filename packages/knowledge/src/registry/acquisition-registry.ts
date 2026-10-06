import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  KnowledgeSource,
  SourceSnapshot,
  ExtractedClaim,
  KnowledgeCandidate,
  KnowledgeConflict,
  AcquisitionRun,
  EngineeringKnowledgeItem
} from '@architectai/domain';

export class KnowledgeAcquisitionRegistry {
  private dataFile: string;

  private data: {
    sources: Record<string, KnowledgeSource>;
    snapshots: Record<string, SourceSnapshot>;
    claims: Record<string, ExtractedClaim>;
    candidates: Record<string, KnowledgeCandidate>;
    conflicts: Record<string, KnowledgeConflict>;
    runs: Record<string, AcquisitionRun>;
    acceptedKnowledge: Record<string, EngineeringKnowledgeItem>;
  };

  constructor(storagePath: string = 'data/knowledge-registry.json') {
    this.dataFile = path.resolve(storagePath);
    this.data = this.load();
  }

  private load() {
    if (fs.existsSync(this.dataFile)) {
      try {
        return JSON.parse(fs.readFileSync(this.dataFile, 'utf8'));
      } catch (err) {
        console.warn('Failed to parse knowledge registry, starting fresh', err);
      }
    }
    return {
      sources: {},
      snapshots: {},
      claims: {},
      candidates: {},
      conflicts: {},
      runs: {},
      acceptedKnowledge: {},
    };
  }

  private save() {
    fs.mkdirSync(path.dirname(this.dataFile), { recursive: true });
    // Write to a temporary file first for safe transactional write
    const tempFile = this.dataFile + '.tmp';
    fs.writeFileSync(tempFile, JSON.stringify(this.data, null, 2), 'utf8');
    fs.renameSync(tempFile, this.dataFile);
  }

  // --- Sources ---
  registerSource(source: KnowledgeSource): void {
    this.data.sources[source.id] = source;
    this.save();
  }

  getSource(id: string): KnowledgeSource | undefined {
    return this.data.sources[id];
  }

  getAllSources(): KnowledgeSource[] {
    return Object.values(this.data.sources);
  }

  // --- Snapshots ---
  saveSnapshot(snapshot: SourceSnapshot): void {
    this.data.snapshots[snapshot.id] = snapshot;
    this.save();
  }

  getSnapshot(id: string): SourceSnapshot | undefined {
    return this.data.snapshots[id];
  }

  findSnapshotBySourceAndHash(sourceId: string, contentHash: string): SourceSnapshot | undefined {
    return Object.values(this.data.snapshots).find(
      s => s.sourceId === sourceId && s.contentHash === contentHash
    );
  }

  // --- Claims ---
  saveClaim(claim: ExtractedClaim): void {
    this.data.claims[claim.id] = claim;
    this.save();
  }
  
  getClaim(id: string): ExtractedClaim | undefined {
    return this.data.claims[id];
  }

  getClaimsForSnapshot(snapshotId: string): ExtractedClaim[] {
    return Object.values(this.data.claims).filter(c => c.sourceSnapshotId === snapshotId);
  }

  // --- Candidates ---
  saveCandidate(candidate: KnowledgeCandidate): void {
    this.data.candidates[candidate.id] = candidate;
    this.save();
  }

  getCandidate(id: string): KnowledgeCandidate | undefined {
    return this.data.candidates[id];
  }

  getAllCandidates(): KnowledgeCandidate[] {
    return Object.values(this.data.candidates);
  }

  // --- Conflicts ---
  saveConflict(conflict: KnowledgeConflict): void {
    this.data.conflicts[conflict.id] = conflict;
    this.save();
  }

  // --- Runs ---
  saveRun(run: AcquisitionRun): void {
    this.data.runs[run.id] = run;
    this.save();
  }

  getRun(id: string): AcquisitionRun | undefined {
    return this.data.runs[id];
  }

  // --- Accepted Knowledge ---
  saveAcceptedKnowledge(item: EngineeringKnowledgeItem): void {
    this.data.acceptedKnowledge[item.id] = item;
    this.save();
  }

  getAllAcceptedKnowledge(): EngineeringKnowledgeItem[] {
    return Object.values(this.data.acceptedKnowledge);
  }

  // Debug/Test reset
  clearAllForTest(): void {
    this.data = {
      sources: {},
      snapshots: {},
      claims: {},
      candidates: {},
      conflicts: {},
      runs: {},
      acceptedKnowledge: {},
    };
    this.save();
  }
}
