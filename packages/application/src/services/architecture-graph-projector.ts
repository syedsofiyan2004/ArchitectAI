// ArchitectAI — Provider-Neutral Architecture Graph Projector
// Grounded topology projection derived from authoritative EngineeringContract
import type {
  EngineeringContract,
  ArchitectureGraphProjection,
  ArchitectureGraphNode,
  ArchitectureGraphEdge,
  ArchitectureGraphBoundary,
  GraphNodeCategory,
} from '@architectai/domain';
import {
  ArchitectureGraphProjectionSchema,
  validateArchitectureGraphProjection,
  computeContractFingerprint,
} from '@architectai/domain';
import type { ProviderAdapter } from '@architectai/providers';
import { getCuratedDemoProjection } from './curated-templates.js';

export interface ProjectorOptions {
  revision?: number;
  provider?: ProviderAdapter;
  allowCuratedTemplates?: boolean;
}

export class ArchitectureGraphProjector {
  /**
   * Projects an EngineeringContract into a validated ArchitectureGraphProjection synchronously
   * via deterministic grounded extraction.
   * Never fabricates metrics or non-existent telemetry.
   */
  public projectSync(
    contract: EngineeringContract,
    options: ProjectorOptions = {}
  ): ArchitectureGraphProjection {
    const revision = options.revision ?? 1;

    // 1. Guard against incomplete or empty contracts
    if (!contract || !contract.decisions || contract.decisions.length === 0) {
      return this.buildIncompleteProjection(contract, revision);
    }

    // 2. Curated Demo Fixture Templates (explicitly requested only)
    if (options.allowCuratedTemplates) {
      const curated = getCuratedDemoProjection(contract, revision);
      if (curated) {
        return curated;
      }
    }

    // 3. Generic Deterministic Grounded Extraction from Contract
    const extracted = this.extractGenericTopology(contract, revision);

    // 4. Strict Validation
    const validation = validateArchitectureGraphProjection(extracted, contract);
    if (!validation.valid) {
      extracted.status = 'unresolved';
      extracted.missingSources.push(...validation.errors);
      extracted.unresolvedQuestions.push(
        ...validation.errors.map((err) => `Unresolved architectural grounding error: ${err}`)
      );
    }

    return ArchitectureGraphProjectionSchema.parse(extracted);
  }

  /**
   * Projects an EngineeringContract into a validated ArchitectureGraphProjection asynchronously.
   * If a ProviderAdapter is provided, synthesizes topology through structured output with bounded retries.
   * Otherwise falls back to deterministic grounded extraction.
   */
  public async project(
    contract: EngineeringContract,
    options: ProjectorOptions = {}
  ): Promise<ArchitectureGraphProjection> {
    const revision = options.revision ?? 1;

    if (!contract || !contract.decisions || contract.decisions.length === 0) {
      return this.buildIncompleteProjection(contract, revision);
    }

    if (options.allowCuratedTemplates) {
      const curated = getCuratedDemoProjection(contract, revision);
      if (curated) {
        return curated;
      }
    }

    if (options.provider) {
      return this.synthesizeWithProvider(contract, options.provider, revision);
    }

    return this.projectSync(contract, options);
  }

  /**
   * Checks whether a cached/persisted projection is still valid against the current contract revision
   * AND canonical contract content fingerprint.
   */
  public isProjectionStale(
    projection: ArchitectureGraphProjection,
    currentContract: EngineeringContract,
    currentContractRevision?: number
  ): boolean {
    if (currentContractRevision !== undefined && projection.contractRevision !== currentContractRevision) {
      return true;
    }
    const currentFingerprint = computeContractFingerprint(currentContract);
    return projection.contractFingerprint !== currentFingerprint;
  }

  private buildIncompleteProjection(
    contract: EngineeringContract | null | undefined,
    revision: number
  ): ArchitectureGraphProjection {
    const fingerprint = contract ? computeContractFingerprint(contract) : 'cfp_incomplete';
    const incompleteProjection: ArchitectureGraphProjection = {
      id: `proj_${contract?.id || 'unknown'}_rev${revision}`,
      contractId: contract?.id || 'unknown',
      contractRevision: revision,
      contractFingerprint: fingerprint,
      projectionVersion: '1.0.0',
      createdAt: new Date().toISOString(),
      status: 'incomplete',
      nodes: [],
      edges: [],
      boundaries: [],
      rationale: 'EngineeringContract lacks architectural decisions; topology cannot be grounded.',
      assumptions: contract?.assumptions || [],
      unresolvedQuestions: contract?.unresolvedQuestions?.length
        ? contract.unresolvedQuestions
        : [
            'What core services and storage components are required to satisfy this product intent?',
            'What security boundaries, authentication models, and data persistence layers are needed?',
          ],
      missingSources: ['contract.decisions is empty'],
    };
    return ArchitectureGraphProjectionSchema.parse(incompleteProjection);
  }

  /**
   * Generic, domain-neutral extraction of topology from arbitrary contract decisions.
   * Sourced directly from contract decisions, invariants, concerns, and requirements.
   * Does NOT contain domain-specific hardcoded branches (no rate limit / payment / image if-checks).
   */
  private extractGenericTopology(
    contract: EngineeringContract,
    revision: number
  ): ArchitectureGraphProjection {
    const nodes: ArchitectureGraphNode[] = [];
    const edges: ArchitectureGraphEdge[] = [];
    const boundaries: ArchitectureGraphBoundary[] = [];
    const missingSources: string[] = [];

    const decisions = contract.decisions;
    const invariants = contract.invariants;
    const concerns = contract.discoveredConcerns;
    const specs = contract.verificationSpecs;

    // 1. Client Node (Derived from user requirement intent)
    const clientNodeId = 'node-clients';
    const declaredTech = contract.requirement?.declaredTechStack || [];

    const clientNode: ArchitectureGraphNode = {
      id: clientNodeId,
      label: 'Client Applications',
      sublabel: 'User Ingress / Web & Mobile Interfaces',
      category: 'client',
      tier: 'public',
      origin: 'contract_requirement',
      confidence: 'inferred_proposed',
      sourceDecisionIds: [],
      sourceConcernIds: [],
      sourceInvariantIds: [],
      sourceSpecIds: [],
      purpose: 'Originates client interactions and requests toward the system.',
      whySelected: 'Client interaction boundary derived from user requirement intent.',
      supportedClaim: contract.requirement?.rawIntent || '',
      tradeOffs: [],
      assumptions: ['Clients communicate across public trust boundaries via standard secure protocols.'],
      unresolvedQuestions: [],
      evidenceReferences: [],
      targetFiles: [],
      x: 120,
      y: 280,
    };
    nodes.push(clientNode);

    // 2. Map Each Architectural Decision into a Grounded Component
    let currentX = 370;
    let currentY = 190;

    for (let i = 0; i < decisions.length; i++) {
      const decision = decisions[i]!;
      const decisionText = `${decision.problemContext} ${decision.selectedOptionName || ''} ${decision.rationale}`.toLowerCase();

      let category: GraphNodeCategory = 'service';
      let tier: 'public' | 'dmz' | 'private_compute' | 'state' | 'external' = 'private_compute';

      if (
        decisionText.includes('database') ||
        decisionText.includes('datastore') ||
        decisionText.includes('postgres') ||
        decisionText.includes('sqlite') ||
        decisionText.includes('sql') ||
        decisionText.includes('storage') ||
        decisionText.includes('persistence') ||
        decisionText.includes('ledger') ||
        decisionText.includes('s3')
      ) {
        category = 'datastore';
        tier = 'state';
      } else if (
        decisionText.includes('cache') ||
        decisionText.includes('redis') ||
        decisionText.includes('lock') ||
        decisionText.includes('mutex') ||
        decisionText.includes('memcached')
      ) {
        category = 'cache';
        tier = 'dmz';
      } else if (
        decisionText.includes('queue') ||
        decisionText.includes('kafka') ||
        decisionText.includes('rabbitmq') ||
        decisionText.includes('sqs') ||
        decisionText.includes('broker') ||
        decisionText.includes('event stream')
      ) {
        category = 'queue';
        tier = 'private_compute';
      } else if (
        decisionText.includes('worker') ||
        decisionText.includes('daemon') ||
        decisionText.includes('consumer') ||
        decisionText.includes('cron') ||
        decisionText.includes('processor')
      ) {
        category = 'worker';
        tier = 'private_compute';
      } else if (
        decisionText.includes('gateway') ||
        decisionText.includes('ingress') ||
        decisionText.includes('proxy') ||
        decisionText.includes('router') ||
        decisionText.includes('reverse proxy') ||
        decisionText.includes('websocket')
      ) {
        category = 'gateway';
        tier = 'dmz';
      } else if (
        decisionText.includes('external') ||
        decisionText.includes('bank') ||
        decisionText.includes('third-party') ||
        decisionText.includes('partner') ||
        decisionText.includes('webhook sender')
      ) {
        category = 'external_system';
        tier = 'external';
      }

      // Check linked invariants
      const linkedInvariants = invariants.filter((inv) =>
        decisionText.includes(inv.property.toLowerCase()) ||
        inv.property.toLowerCase().includes(decision.problemContext.toLowerCase())
      );

      // Check linked concerns
      const linkedConcerns = concerns.filter((c) =>
        decisionText.includes(c.title.toLowerCase()) ||
        (c.dimensions || []).some((d) => decisionText.includes(d.toLowerCase()))
      );

      // Check linked specs
      const linkedSpecs = specs.filter((s) =>
        linkedInvariants.some((inv) => inv.id === s.target) ||
        decisionText.includes(s.target.toLowerCase())
      );

      // Extract grounded technology if explicitly stated in decision or requirement declared tech
      let technology: string | undefined = undefined;
      const optName = decision.selectedOptionName || '';
      for (const tech of ['PostgreSQL', 'SQLite', 'Redis', 'Node.js', 'RabbitMQ', 'Kafka', 'AWS S3', 'Express', 'React', 'TypeScript', 'Docker']) {
        if (optName.toLowerCase().includes(tech.toLowerCase()) || decision.rationale.toLowerCase().includes(tech.toLowerCase())) {
          technology = tech;
          break;
        }
      }
      if (!technology && declaredTech.length > 0) {
        for (const tech of declaredTech) {
          if (decisionText.includes(tech.toLowerCase())) {
            technology = tech;
            break;
          }
        }
      }

      // Extract modeled capacity or SLA ONLY if grounded in invariant properties
      let modeledCapacity: string | undefined = undefined;
      let assumedLatencySla: string | undefined = undefined;

      for (const inv of linkedInvariants) {
        const prop = inv.property;
        if (prop.match(/(\d+\s*(?:req\/s|req\/min|req\/60s|requests|MB|GB))/i)) {
          const match = prop.match(/(\d+\s*(?:req\/s|req\/min|req\/60s|requests|MB|GB)[^,.]*)/i);
          if (match) modeledCapacity = match[0].trim();
        }
        if (prop.match(/(P\d+\s*<\s*\d+ms|\b\d+ms\s*SLA\b)/i)) {
          const match = prop.match(/(P\d+\s*<\s*\d+ms|\b\d+ms\s*SLA\b)/i);
          if (match) assumedLatencySla = match[0].trim();
        }
      }

      const nodeId = `node-${decision.id.replace(/^dec-/, '')}`;
      nodes.push({
        id: nodeId,
        label: decision.selectedOptionName || decision.problemContext,
        sublabel: decision.problemContext,
        category,
        tier,
        origin: 'contract_decision',
        confidence: 'architectural_decision',
        sourceDecisionIds: [decision.id],
        sourceConcernIds: linkedConcerns.map((c) => c.id),
        sourceInvariantIds: linkedInvariants.map((i) => i.id),
        sourceSpecIds: linkedSpecs.map((s) => s.id),
        purpose: decision.rationale,
        whySelected: decision.rationale,
        supportedClaim: decision.rationale,
        tradeOffs: decision.risksAndTradeoffs || [],
        assumptions: decision.assumptions || [],
        unresolvedQuestions: decision.reconsiderationTriggers || [],
        evidenceReferences: (decision.evidence || []).map((e) => e.id),
        targetFiles: [],
        technology,
        modeledCapacity,
        assumedLatencySla,
        x: currentX,
        y: currentY,
      });

      currentX += 240;
      if (currentX > 880) {
        currentX = 370;
        currentY += 180;
      }
    }

    // 3. Connect Edges along architectural hierarchy
    const nonClientNodes = nodes.filter((n) => n.id !== clientNodeId);
    const ingressNodes = nonClientNodes.filter((n) => n.category === 'gateway' || n.tier === 'dmz');
    const serviceNodes = nonClientNodes.filter((n) => n.category === 'service' || n.category === 'compute');
    const entryNodes = ingressNodes.length > 0 ? ingressNodes : serviceNodes.length > 0 ? serviceNodes : [nonClientNodes[0]!];

    // Connect Client to entry nodes
    for (const entry of entryNodes) {
      edges.push({
        id: `edge-${clientNodeId}-${entry.id}`,
        source: clientNodeId,
        target: entry.id,
        label: 'Client Requests',
        protocol: 'HTTPS REST',
        direction: 'unidirectional',
        isSelfLoop: false,
        origin: 'inferred_topology',
        confidence: 'inferred_proposed',
        sourceDecisionIds: [],
        sourceConcernIds: [],
        sourceInvariantIds: [],
        sourceSpecIds: [],
        purpose: `Carries incoming client interactions to ${entry.label}.`,
        whySelected: 'Inferred public ingress flow.',
        assumptions: ['Clients communicate across network boundary via secure HTTP or WebSocket.'],
        evidenceReferences: [],
      });
    }

    // Connect ingress to services
    if (ingressNodes.length > 0 && serviceNodes.length > 0) {
      for (const ing of ingressNodes) {
        for (const svc of serviceNodes) {
          edges.push({
            id: `edge-${ing.id}-${svc.id}`,
            source: ing.id,
            target: svc.id,
            label: 'Admitted Traffic',
            protocol: 'Internal RPC / HTTP',
            direction: 'unidirectional',
            isSelfLoop: false,
            origin: 'inferred_topology',
            confidence: 'inferred_proposed',
            sourceDecisionIds: [],
            sourceConcernIds: [],
            sourceInvariantIds: [],
            sourceSpecIds: [],
            purpose: `Forwards verified traffic from ${ing.label} to ${svc.label}.`,
            whySelected: 'Service ingress forwarding.',
            assumptions: ['Internal network connectivity within private perimeter.'],
            evidenceReferences: [],
          });
        }
      }
    }

    // Connect core compute/services to state, caches, queues, and external dependencies
    const upstreamCandidates = serviceNodes.length > 0 ? serviceNodes : ingressNodes.length > 0 ? ingressNodes : [nonClientNodes[0]!];
    const backendNodes = nonClientNodes.filter((n) => !entryNodes.includes(n) && !serviceNodes.includes(n));

    for (const backend of backendNodes) {
      const upstream = upstreamCandidates[0]!;
      const isCache = backend.category === 'cache';
      const isDatastore = backend.category === 'datastore';
      const isQueue = backend.category === 'queue';

      edges.push({
        id: `edge-${upstream.id}-${backend.id}`,
        source: upstream.id,
        target: backend.id,
        label: isDatastore ? 'Queries & Persistence' :
               isCache ? 'Atomic Read / Mutex' :
               isQueue ? 'Publish Task / Event' : 'Downstream Dependency',
        protocol: isDatastore ? 'Database Protocol' :
                  isCache ? 'Cache Wire Protocol' :
                  isQueue ? 'Message Bus Protocol' : 'TLS REST',
        direction: isCache ? 'bidirectional' : 'unidirectional',
        isSelfLoop: false,
        origin: 'inferred_topology',
        confidence: 'inferred_proposed',
        sourceDecisionIds: [],
        sourceConcernIds: [],
        sourceInvariantIds: [],
        sourceSpecIds: [],
        purpose: `Interactions between ${upstream.label} and ${backend.label}.`,
        whySelected: 'Operational dependency inferred from architecture decisions.',
        assumptions: ['Backend connections managed with connection pooling or circuit breakers.'],
        evidenceReferences: [],
      });
    }

    // Connect Queues to Workers
    const queueNodes = nonClientNodes.filter((n) => n.category === 'queue');
    const workerNodes = nonClientNodes.filter((n) => n.category === 'worker');
    for (const q of queueNodes) {
      for (const w of workerNodes) {
        edges.push({
          id: `edge-${q.id}-${w.id}`,
          source: q.id,
          target: w.id,
          label: 'Consume / Ack',
          protocol: 'Queue Wire Protocol',
          direction: 'bidirectional',
          isSelfLoop: false,
          origin: 'inferred_topology',
          confidence: 'inferred_proposed',
          sourceDecisionIds: [],
          sourceConcernIds: [],
          sourceInvariantIds: [],
          sourceSpecIds: [],
          purpose: `Asynchronous job consumption from ${q.label} by ${w.label}.`,
          whySelected: 'Decoupled asynchronous worker flow.',
          assumptions: ['Workers pull jobs with prefetch limits.'],
          evidenceReferences: [],
        });
      }
    }

    // 4. Group Boundaries by Tier
    const tiers = Array.from(new Set(nodes.map((n) => n.tier)));
    for (const t of tiers) {
      const tierNodes = nodes.filter((n) => n.tier === t);
      boundaries.push({
        id: `tb-${t}`,
        label: t === 'public' ? 'Public Internet Ingress' :
               t === 'dmz' ? 'Perimeter / Ingress Services (DMZ)' :
               t === 'private_compute' ? 'Protected Application Compute' :
               t === 'state' ? 'Persistent State & Data Layer' : 'External Third-Party Perimeter',
        description: `Isolation tier for ${t} systems.`,
        tier: t as any,
        nodeIds: tierNodes.map((n) => n.id),
        rect: {
          x: Math.min(...tierNodes.map((n) => n.x)) - 25,
          y: 50,
          width: 240,
          height: 500,
        },
      });
    }

    const fingerprint = computeContractFingerprint(contract);
    const projection: ArchitectureGraphProjection = {
      id: `proj_${contract.id}_rev${revision}`,
      contractId: contract.id,
      contractRevision: revision,
      contractFingerprint: fingerprint,
      projectionVersion: '1.0.0',
      createdAt: new Date().toISOString(),
      status: 'valid',
      nodes,
      edges,
      boundaries,
      rationale: `Grounded architecture graph derived from ${decisions.length} architectural decisions for ${contract.id}.`,
      assumptions: contract.assumptions || [],
      unresolvedQuestions: contract.unresolvedQuestions || [],
      missingSources,
      simulationModule: {
        available: false,
        description: 'Discrete simulation is not modeled for this scenario; invariants are verified via executable test suites.',
      },
    };

    return projection;
  }

  /**
   * Synthesizes topology via a provider adapter with bounded retries and schema/grounding validation.
   */
  private async synthesizeWithProvider(
    contract: EngineeringContract,
    provider: ProviderAdapter,
    revision: number
  ): Promise<ArchitectureGraphProjection> {
    const maxRetries = 2;
    let lastErrors: string[] = [];

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const response = await provider.generateStructured<ArchitectureGraphProjection>({
          schema: ArchitectureGraphProjectionSchema,
          schemaName: 'ArchitectureGraphProjection',
          messages: [
            {
              role: 'system',
              content: `You are an architectural topology synthesis engine for ArchitectAI.
Synthesize a strictly grounded ArchitectureGraphProjection from the provided EngineeringContract.
RULES:
1. Every node and edge must trace to real decision IDs, invariant IDs, or concern IDs from the contract.
2. If a component is inferred rather than explicitly specified in the contract, set origin='inferred_topology' and confidence='inferred_proposed'.
3. Do NOT invent technologies, capacities, SLAs, or dependencies not present in the contract.
4. If the contract is underspecified or incomplete, do not invent a complete design: populate unresolvedQuestions and missingSources.
5. Node IDs and edge source/target references must match exactly with zero dangling edges.
6. Return valid JSON satisfying ArchitectureGraphProjectionSchema.`,
            },
            {
              role: 'user',
              content: JSON.stringify(contract, null, 2),
            },
            ...(attempt > 0
              ? [
                  {
                    role: 'assistant' as const,
                    content: 'Previous candidate failed validation.',
                  },
                  {
                    role: 'user' as const,
                    content: `Validation failed with errors: ${lastErrors.join('; ')}. Fix these errors and return a strictly grounded projection.`,
                  },
                ]
              : []),
          ],
        });

        const candidate = response.data;
        candidate.contractFingerprint = computeContractFingerprint(contract);
        candidate.contractRevision = revision;

        const validation = validateArchitectureGraphProjection(candidate, contract);
        if (validation.valid) {
          candidate.status = 'valid';
          return ArchitectureGraphProjectionSchema.parse(candidate);
        }

        lastErrors = validation.errors;
      } catch (err: unknown) {
        lastErrors = [err instanceof Error ? err.message : String(err)];
      }
    }

    // Bounded retries exhausted: return an honest unresolved graph with questions, NEVER a fabricated design
    const fallback = this.extractGenericTopology(contract, revision);
    fallback.status = 'unresolved';
    fallback.missingSources.push(...lastErrors);
    fallback.unresolvedQuestions.push(
      ...lastErrors.map((e) => `Topology synthesis could not resolve: ${e}`)
    );
    return ArchitectureGraphProjectionSchema.parse(fallback);
  }
}
