import React, { useState } from 'react';
import { EngineeringContract } from '@architectai/domain';

interface ContractInspectorProps {
  contract: EngineeringContract;
}

export const ContractInspector: React.FC<ContractInspectorProps> = ({ contract }) => {
  const [copied, setCopied] = useState(false);

  const jsonString = JSON.stringify(contract, null, 2);

  const handleCopy = () => {
    navigator.clipboard.writeText(jsonString);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `engineering-contract-${contract.id}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="inspector-container">
      <div className="section-intro">
        <div>
          <h2 className="section-heading">Canonical Engineering Contract</h2>
          <p className="section-subtext">
            Standard provider-neutral contract output validated against EngineeringContractSchema.
          </p>
        </div>
        <div className="inspector-actions">
          <button type="button" className="btn-secondary" onClick={handleDownload}>
            Download JSON
          </button>
          <button type="button" className="btn-primary" onClick={handleCopy}>
            {copied ? '✓ Copied to Clipboard' : 'Copy JSON Contract'}
          </button>
        </div>
      </div>

      <div className="surface-card json-card">
        <div className="json-header-bar">
          <div className="schema-pill-group">
            <span className="grounding-pill grounded font-mono">
              ✓ Schema Validated
            </span>
            <span className="contract-id-pill font-mono">ID: {contract.id}</span>
          </div>
          <span className="version-pill font-mono">Version: {contract.version}</span>
        </div>

        <pre className="json-pre font-mono">
          <code>{jsonString}</code>
        </pre>
      </div>
    </div>
  );
};
