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
    a.download = `contract-${contract.id}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="inspector-view">
      <div className="section-intro">
        <div>
          <h2 className="section-heading">Canonical EngineeringContract (Schema Verified)</h2>
          <p className="section-subtext">
            Standard provider-neutral contract output compliant with EngineeringContractSchema.
          </p>
        </div>
        <div className="inspector-actions">
          <button type="button" className="btn btn-secondary" onClick={handleDownload}>
            Download JSON
          </button>
          <button type="button" className="btn btn-primary" onClick={handleCopy}>
            {copied ? '✓ Copied to Clipboard' : 'Copy JSON Contract'}
          </button>
        </div>
      </div>

      <div className="json-container card">
        <div className="json-header">
          <div className="meta-left">
            <span className="schema-badge font-mono">zod: EngineeringContractSchema (valid)</span>
            <span className="contract-id font-mono">ID: {contract.id}</span>
          </div>
          <span className="version-pill font-mono">v{contract.version}</span>
        </div>
        <pre className="json-code font-mono">
          <code>{jsonString}</code>
        </pre>
      </div>
    </div>
  );
};
