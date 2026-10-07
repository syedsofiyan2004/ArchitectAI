import type { DatabaseSync } from 'node:sqlite';
import {
  ArchitectureRun,
  ArchitectureRunSchema,
  RunLifecycleState,
  validateRunStateTransition,
  ContractRevision,
  ContractRevisionSchema,
  UserAnswerRecord,
  UserAnswerRecordSchema,
} from '@architectai/domain';

export class ArchitectureRunStore {
  constructor(private readonly db: DatabaseSync) {}

  public create(run: ArchitectureRun): void {
    const validated = ArchitectureRunSchema.parse(run);
    const stmt = this.db.prepare(`
      INSERT INTO architecture_runs (
        id, project_id, title, state, raw_intent, explicit_constraints,
        declared_tech_stack, context, decomposition, contract, contract_revision,
        dimensions_detected, analysis_mode, error, user_answers,
        created_at, updated_at, completed_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      validated.id,
      validated.projectId,
      validated.title,
      validated.state,
      validated.rawIntent,
      JSON.stringify(validated.explicitConstraints),
      JSON.stringify(validated.declaredTechStack),
      JSON.stringify(validated.context),
      validated.decomposition ? JSON.stringify(validated.decomposition) : null,
      validated.contract ? JSON.stringify(validated.contract) : null,
      validated.contractRevision,
      JSON.stringify(validated.dimensionsDetected),
      validated.analysisMode,
      validated.error ?? null,
      JSON.stringify(validated.userAnswers),
      validated.createdAt,
      validated.updatedAt,
      validated.completedAt ?? null
    );

    // If initial contract exists, record initial revision
    if (validated.contract) {
      const rev: ContractRevision = {
        id: `rev_${validated.id}_1`,
        runId: validated.id,
        revisionNumber: validated.contractRevision || 1,
        contract: validated.contract,
        reason: 'Initial architecture analysis contract',
        createdAt: validated.createdAt,
      };
      this.saveContractRevision(rev);
    }
  }

  public findById(id: string): ArchitectureRun | null {
    const stmt = this.db.prepare('SELECT * FROM architecture_runs WHERE id = ?');
    const row = stmt.get(id) as Record<string, unknown> | undefined;
    if (!row) return null;
    return this.mapRow(row);
  }

  public listByProjectId(projectId: string): ArchitectureRun[] {
    const stmt = this.db.prepare('SELECT * FROM architecture_runs WHERE project_id = ? ORDER BY created_at DESC');
    const rows = stmt.all(projectId) as Array<Record<string, unknown>>;
    return rows.map((r) => this.mapRow(r));
  }

  public listAll(): ArchitectureRun[] {
    const rows = this.db.prepare('SELECT * FROM architecture_runs ORDER BY created_at DESC').all() as Array<Record<string, unknown>>;
    return rows.map((r) => this.mapRow(r));
  }

  public updateState(id: string, newState: RunLifecycleState): ArchitectureRun {
    const existing = this.findById(id);
    if (!existing) {
      throw new Error(`Architecture run '${id}' not found.`);
    }

    validateRunStateTransition(existing.state, newState);

    const now = new Date().toISOString();
    const completedAt =
      ['VERIFIED', 'FAILED', 'CANCELLED'].includes(newState)
        ? (existing.completedAt || now)
        : existing.completedAt;

    const stmt = this.db.prepare(`
      UPDATE architecture_runs SET
        state = ?,
        updated_at = ?,
        completed_at = ?
      WHERE id = ?
    `);
    stmt.run(newState, now, completedAt ?? null, id);

    return {
      ...existing,
      state: newState,
      updatedAt: now,
      completedAt,
    };
  }

  public update(id: string, updates: Partial<ArchitectureRun>): ArchitectureRun | null {
    const existing = this.findById(id);
    if (!existing) return null;

    if (updates.state && updates.state !== existing.state) {
      validateRunStateTransition(existing.state, updates.state);
    }

    const merged: ArchitectureRun = {
      ...existing,
      ...updates,
      id: existing.id,
      projectId: existing.projectId,
      updatedAt: updates.updatedAt || new Date().toISOString(),
    };
    const validated = ArchitectureRunSchema.parse(merged);

    const stmt = this.db.prepare(`
      UPDATE architecture_runs SET
        title = ?,
        state = ?,
        raw_intent = ?,
        explicit_constraints = ?,
        declared_tech_stack = ?,
        context = ?,
        decomposition = ?,
        contract = ?,
        contract_revision = ?,
        dimensions_detected = ?,
        analysis_mode = ?,
        error = ?,
        user_answers = ?,
        updated_at = ?,
        completed_at = ?
      WHERE id = ?
    `);

    stmt.run(
      validated.title,
      validated.state,
      validated.rawIntent,
      JSON.stringify(validated.explicitConstraints),
      JSON.stringify(validated.declaredTechStack),
      JSON.stringify(validated.context),
      validated.decomposition ? JSON.stringify(validated.decomposition) : null,
      validated.contract ? JSON.stringify(validated.contract) : null,
      validated.contractRevision,
      JSON.stringify(validated.dimensionsDetected),
      validated.analysisMode,
      validated.error ?? null,
      JSON.stringify(validated.userAnswers),
      validated.updatedAt,
      validated.completedAt ?? null,
      validated.id
    );

    if (validated.contract && (!existing.contract || existing.contract.id !== validated.contract.id || updates.contractRevision)) {
      const revNumber = validated.contractRevision || 1;
      this.saveContractRevision({
        id: `rev_${validated.id}_${revNumber}`,
        runId: validated.id,
        revisionNumber: revNumber,
        contract: validated.contract,
        reason: 'Architecture analysis contract saved',
        createdAt: validated.updatedAt,
      });
    }

    return validated;
  }

  public saveContractRevision(revision: ContractRevision): void {
    const validated = ContractRevisionSchema.parse(revision);
    const stmt = this.db.prepare(`
      INSERT INTO contract_revisions (
        id, run_id, revision_number, contract, reason, parent_revision_id, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        contract = excluded.contract,
        reason = excluded.reason
    `);

    stmt.run(
      validated.id,
      validated.runId,
      validated.revisionNumber,
      JSON.stringify(validated.contract),
      validated.reason ?? null,
      validated.parentRevisionId ?? null,
      validated.createdAt
    );
  }

  public getContractRevisions(runId: string): ContractRevision[] {
    const stmt = this.db.prepare('SELECT * FROM contract_revisions WHERE run_id = ? ORDER BY revision_number ASC');
    const rows = stmt.all(runId) as Array<Record<string, unknown>>;
    return rows.map((row) =>
      ContractRevisionSchema.parse({
        id: String(row['id']),
        runId: String(row['run_id']),
        revisionNumber: Number(row['revision_number']),
        contract: JSON.parse(String(row['contract'])),
        reason: row['reason'] ? String(row['reason']) : undefined,
        parentRevisionId: row['parent_revision_id'] ? String(row['parent_revision_id']) : undefined,
        createdAt: String(row['created_at']),
      })
    );
  }

  public recordUserAnswer(answer: UserAnswerRecord): void {
    const validated = UserAnswerRecordSchema.parse(answer);
    const stmt = this.db.prepare(`
      INSERT INTO user_answers (id, run_id, question, answer, answered_at)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET answer = excluded.answer, answered_at = excluded.answered_at
    `);
    stmt.run(
      validated.id,
      validated.runId,
      validated.question,
      validated.answer,
      validated.answeredAt
    );

    // Also update cached map in architecture_runs
    const run = this.findById(validated.runId);
    if (run) {
      const updatedAnswers = { ...run.userAnswers, [validated.question]: validated.answer };
      this.update(run.id, { userAnswers: updatedAnswers });
    }
  }

  public getUserAnswers(runId: string): UserAnswerRecord[] {
    const stmt = this.db.prepare('SELECT * FROM user_answers WHERE run_id = ? ORDER BY answered_at ASC');
    const rows = stmt.all(runId) as Array<Record<string, unknown>>;
    return rows.map((row) =>
      UserAnswerRecordSchema.parse({
        id: String(row['id']),
        runId: String(row['run_id']),
        question: String(row['question']),
        answer: String(row['answer']),
        answeredAt: String(row['answered_at']),
      })
    );
  }

  public delete(id: string): void {
    this.db.prepare('DELETE FROM architecture_runs WHERE id = ?').run(id);
  }

  private mapRow(row: Record<string, unknown>): ArchitectureRun {
    return ArchitectureRunSchema.parse({
      id: String(row['id']),
      projectId: String(row['project_id']),
      title: String(row['title']),
      state: row['state'],
      rawIntent: String(row['raw_intent']),
      explicitConstraints: row['explicit_constraints'] ? JSON.parse(String(row['explicit_constraints'])) : [],
      declaredTechStack: row['declared_tech_stack'] ? JSON.parse(String(row['declared_tech_stack'])) : [],
      context: row['context'] ? JSON.parse(String(row['context'])) : {},
      decomposition: row['decomposition'] ? JSON.parse(String(row['decomposition'])) : undefined,
      contract: row['contract'] ? JSON.parse(String(row['contract'])) : undefined,
      contractRevision: Number(row['contract_revision'] || 1),
      dimensionsDetected: row['dimensions_detected'] ? JSON.parse(String(row['dimensions_detected'])) : [],
      analysisMode: row['analysis_mode'] || 'heuristic',
      error: row['error'] ? String(row['error']) : undefined,
      userAnswers: row['user_answers'] ? JSON.parse(String(row['user_answers'])) : {},
      createdAt: String(row['created_at']),
      updatedAt: String(row['updated_at']),
      completedAt: row['completed_at'] ? String(row['completed_at']) : undefined,
    });
  }
}
