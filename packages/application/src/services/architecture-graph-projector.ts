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
  computeProjectionGroundingStatus,
  extractMeaningfulTokens,
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
    extracted.groundingStatus = computeProjectionGroundingStatus(extracted);

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
      groundingStatus: 'needs_clarification',
      nodes: [],
      edges: [],
      boundaries: [],
      rationale: 'EngineeringContract lacks architectural decisions; topology cannot be grounded.',
      assumptions: contract?.assumptions ? [...contract.assumptions] : [],
      unresolvedQuestions: contract?.unresolvedQuestions?.length
        ? [...contract.unresolvedQuestions]
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

    const contractAllText = [
      contract.requirement?.rawIntent || '',
      ...(contract.requirement?.declaredTechStack || []),
      ...(contract.requirement?.explicitConstraints || []),
      ...decisions.map(
        (d) =>
          `${d.problemContext} ${d.selectedOptionName || ''} ${d.rationale} ${(d.assumptions || []).join(' ')} ${(d.risksAndTradeoffs || []).join(' ')} ${(d.consideredOptions || []).map((o) => `${o.name} ${o.description}`).join(' ')}`
      ),
      ...invariants.map((i) => i.property),
      ...(contract.assumptions || []),
    ].join(' ').toLowerCase();

    const getGroundedProtocol = (text: string): string => {
      const lower = text.toLowerCase();
      if (lower.includes('websocket')) return 'WebSocket';
      if (lower.includes('grpc')) return 'gRPC';
      if (lower.includes('https')) return 'HTTPS';
      if (lower.includes('http') || lower.includes('rest')) return 'HTTP';
      return '';
    };

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
      unresolvedQuestions: ['What authentication and authorization protocol is required for client requests?'],
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

    // 3. Connect Edges: Confirmed when decisions establish relationship, Proposed when inferred
    const nonClientNodes = nodes.filter((n) => n.id !== clientNodeId);
    const gatewayNodes = nonClientNodes.filter((n) => n.category === 'gateway');
    const serviceNodes = nonClientNodes.filter((n) => n.category === 'service' || n.category === 'compute');
    const entryNode = gatewayNodes.length > 0 ? gatewayNodes[0]! : (serviceNodes.length > 0 ? serviceNodes[0]! : nonClientNodes[0]);

    // Connect Client to the single entry node as Proposed
    if (entryNode) {
      const proto = getGroundedProtocol(contractAllText);
      edges.push({
        id: `edge-${clientNodeId}-${entryNode.id}`,
        source: clientNodeId,
        target: entryNode.id,
        label: 'Client Ingress',
        protocol: proto,
        direction: proto === 'WebSocket' ? 'bidirectional' : 'unidirectional',
        isSelfLoop: false,
        origin: 'inferred_topology',
        confidence: 'inferred_proposed',
        sourceDecisionIds: [],
        sourceConcernIds: [],
        sourceInvariantIds: [],
        sourceSpecIds: [],
        purpose: `Carries incoming client interactions to ${entryNode.label}.`,
        whySelected: 'Inferred public ingress flow derived from user requirement intent.',
        assumptions: ['Clients communicate across public network boundary to ingress entry point.'],
        unresolvedQuestions: ['What authentication and transport security protocol is enforced for client requests?'],
        evidenceReferences: [],
      });
    }

    // Connect decision-grounded relationships between non-client nodes
    const connectedPairs = new Set<string>();

    for (let i = 0; i < nonClientNodes.length; i++) {
      for (let j = 0; j < nonClientNodes.length; j++) {
        if (i === j) continue;
        const nodeA = nonClientNodes[i]!;
        const nodeB = nonClientNodes[j]!;
        const pairKey = `${nodeA.id}->${nodeB.id}`;
        const reverseKey = `${nodeB.id}->${nodeA.id}`;

        const tokensA = extractMeaningfulTokens(`${nodeA.label} ${nodeA.category}`);
        const tokensB = extractMeaningfulTokens(`${nodeB.label} ${nodeB.category}`);

        for (const d of decisions) {
          const dFullText = `${d.problemContext} ${d.selectedOptionName || ''} ${d.rationale} ${(d.consideredOptions || []).map((o) => `${o.name} ${o.description}`).join(' ')}`.toLowerCase();
          const matchA = Array.from(tokensA).some((t) => dFullText.includes(t));
          const matchB = Array.from(tokensB).some((t) => dFullText.includes(t));

          if (matchA && matchB && !connectedPairs.has(pairKey) && !connectedPairs.has(reverseKey)) {
            let source = nodeA;
            let target = nodeB;
            if (
              (nodeA.category === 'datastore' || nodeA.category === 'cache' || nodeA.category === 'worker') &&
              (nodeB.category === 'gateway' || nodeB.category === 'service' || nodeB.category === 'queue')
            ) {
              source = nodeB;
              target = nodeA;
            }

            const edgeProto = getGroundedProtocol(dFullText);
            edges.push({
              id: `edge-${source.id}-${target.id}`,
              source: source.id,
              target: target.id,
              label: `${source.label} to ${target.label}`,
              protocol: edgeProto,
              direction: target.category === 'cache' ? 'bidirectional' : 'unidirectional',
              isSelfLoop: false,
              origin: 'contract_decision',
              confidence: 'architectural_decision',
              sourceDecisionIds: [d.id],
              sourceConcernIds: [],
              sourceInvariantIds: [],
              sourceSpecIds: [],
              purpose: d.rationale,
              whySelected: `Architectural connection established by decision "${d.problemContext}".`,
              assumptions: [...(d.assumptions || [])],
              unresolvedQuestions: [...(d.reconsiderationTriggers || [])],
              evidenceReferences: (d.evidence || []).map((e) => e.id),
            });
            connectedPairs.add(`${source.id}->${target.id}`);
            break;
          }
        }
      }
    }

    // Connect any remaining unlinked backend nodes to entryNode as Proposed
    for (const nodeX of nonClientNodes) {
      if (nodeX.id === entryNode?.id) continue;
      const isConnected = edges.some((e) => e.source === nodeX.id || e.target === nodeX.id);
      if (!isConnected && entryNode) {
        const isStateOrCache = nodeX.category === 'datastore' || nodeX.category === 'cache';
        const isQueueOrWorker = nodeX.category === 'queue' || nodeX.category === 'worker';

        edges.push({
          id: `edge-${entryNode.id}-${nodeX.id}`,
          source: entryNode.id,
          target: nodeX.id,
          label: isStateOrCache ? 'State Access' : isQueueOrWorker ? 'Task Flow' : 'Service Dependency',
          protocol: '', // Do NOT invent wire protocol unless grounded in contract text
          direction: nodeX.category === 'cache' ? 'bidirectional' : 'unidirectional',
          isSelfLoop: false,
          origin: 'inferred_topology',
          confidence: 'inferred_proposed',
          sourceDecisionIds: [],
          sourceConcernIds: [],
          sourceInvariantIds: [],
          sourceSpecIds: [],
          purpose: `Inferred operational dependency between ${entryNode.label} and ${nodeX.label}.`,
          whySelected: 'Proposed candidate connection awaiting explicit interface definition.',
          assumptions: [`Traffic between ${entryNode.label} and ${nodeX.label} is confined to private infrastructure.`],
          unresolvedQuestions: [`What protocol, timeout bounds, and retry policies govern communication with ${nodeX.label}?`],
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
    const tempProjection: ArchitectureGraphProjection = {
      id: `proj_${contract.id}_rev${revision}`,
      contractId: contract.id,
      contractRevision: revision,
      contractFingerprint: fingerprint,
      projectionVersion: '1.0.0',
      createdAt: new Date().toISOString(),
      status: 'valid',
      groundingStatus: 'proposed_design',
      nodes,
      edges,
      boundaries,
      rationale: `Grounded architecture graph derived from ${decisions.length} architectural decisions for ${contract.id}.`,
      assumptions: [...(contract.assumptions || [])],
      unresolvedQuestions: [...(contract.unresolvedQuestions || [])],
      missingSources,
      simulationModule: {
        available: false,
        description: 'Discrete simulation is not modeled for this scenario; invariants are verified via executable test suites.',
      },
    };
    tempProjection.groundingStatus = computeProjectionGroundingStatus(tempProjection);

    return tempProjection;
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
          candidate.groundingStatus = computeProjectionGroundingStatus(candidate);
          return ArchitectureGraphProjectionSchema.parse(candidate);
        }

        lastErrors = validation.errors;
      } catch (err: unknown) {
        lastErrors = [err instanceof Error ? err.message : String(err)];
      }
    }

    // Bounded retries exhausted: return an honest unresolved graph with questions, NEVER a fabricated design
    const fallback: ArchitectureGraphProjection = {
      id: `proj_unresolved_${contract.id}_rev${revision}`,
      contractId: contract.id,
      contractRevision: revision,
      contractFingerprint: computeContractFingerprint(contract),
      projectionVersion: '1.0.0',
      createdAt: new Date().toISOString(),
      status: 'unresolved',
      groundingStatus: 'needs_clarification',
      nodes: [],
      edges: [],
      boundaries: [],
      rationale: `Topology synthesis could not resolve a grounded architecture after bounded attempts. Clarification required.`,
      assumptions: [...(contract.assumptions || [])],
      unresolvedQuestions: [
        ...(contract.unresolvedQuestions || []),
        ...lastErrors.map((e) => `Topology synthesis could not resolve: ${e}`),
      ],
      missingSources: [...lastErrors],
      simulationModule: {
        available: false,
      },
    };
    return ArchitectureGraphProjectionSchema.parse(fallback);
  }
}
