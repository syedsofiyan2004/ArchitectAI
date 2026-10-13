import React, { useState } from 'react';
import { FileCode, Plus, Minus, ChevronDown, ChevronRight, Copy, Check } from 'lucide-react';

interface DiffViewerProps {
  diff: string;
  changedFiles?: string[];
}

interface ParsedFileDiff {
  fileName: string;
  status: 'added' | 'modified' | 'deleted';
  additions: number;
  deletions: number;
  lines: Array<{
    type: 'add' | 'del' | 'context' | 'meta';
    content: string;
    oldLine?: number;
    newLine?: number;
  }>;
}

function parseUnifiedDiff(rawDiff: string, changedFilesList?: string[]): ParsedFileDiff[] {
  if (!rawDiff || rawDiff.trim() === '') {
    if (changedFilesList && changedFilesList.length > 0) {
      return changedFilesList.map((f) => ({
        fileName: f,
        status: 'modified',
        additions: 1,
        deletions: 0,
        lines: [{ type: 'add', content: `// File modified in isolated worktree: ${f}` }],
      }));
    }
    return [];
  }

  const fileDiffs: ParsedFileDiff[] = [];
  const rawFiles = rawDiff.split(/^diff --git /m);

  for (const block of rawFiles) {
    if (!block.trim()) continue;

    const lines = block.split('\n');
    const headerLine = lines[0] || '';
    const match = headerLine.match(/a\/(.+?)\s+b\/(.+)/);
    const fileName = match ? match[2] : headerLine.split(' ')[0] || 'modified-file';

    let additions = 0;
    let deletions = 0;
    let status: 'added' | 'modified' | 'deleted' = 'modified';

    if (block.includes('new file mode')) status = 'added';
    if (block.includes('deleted file mode')) status = 'deleted';

    const parsedLines: ParsedFileDiff['lines'] = [];

    for (const line of lines.slice(1)) {
      if (line.startsWith('+++') || line.startsWith('---') || line.startsWith('index ')) {
        continue;
      }
      if (line.startsWith('@@')) {
        parsedLines.push({ type: 'meta', content: line });
      } else if (line.startsWith('+')) {
        additions++;
        parsedLines.push({ type: 'add', content: line.slice(1) });
      } else if (line.startsWith('-')) {
        deletions++;
        parsedLines.push({ type: 'del', content: line.slice(1) });
      } else {
        parsedLines.push({ type: 'context', content: line.startsWith(' ') ? line.slice(1) : line });
      }
    }

    fileDiffs.push({
      fileName,
      status,
      additions,
      deletions,
      lines: parsedLines,
    });
  }

  return fileDiffs;
}

export const DiffViewer: React.FC<DiffViewerProps> = ({ diff, changedFiles = [] }) => {
  const fileDiffs = parseUnifiedDiff(diff, changedFiles);
  const [collapsedFiles, setCollapsedFiles] = useState<Record<string, boolean>>({});
  const [copied, setCopied] = useState(false);

  const toggleCollapse = (file: string) => {
    setCollapsedFiles((prev) => ({ ...prev, [file]: !prev[file] }));
  };

  const totalAdditions = fileDiffs.reduce((acc, f) => acc + f.additions, 0);
  const totalDeletions = fileDiffs.reduce((acc, f) => acc + f.deletions, 0);

  const handleCopy = () => {
    navigator.clipboard.writeText(diff);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (fileDiffs.length === 0) {
    return (
      <div className="diff-empty-state">
        <FileCode size={24} className="text-muted" />
        <p className="text-secondary">No code modifications recorded in this run.</p>
      </div>
    );
  }

  return (
    <div className="diff-viewer-wrapper">
      <div className="diff-summary-bar">
        <div className="diff-summary-left">
          <span className="diff-files-count">{fileDiffs.length} changed {fileDiffs.length === 1 ? 'file' : 'files'}</span>
          <span className="diff-stats font-mono">
            <span className="stat-add">+{totalAdditions}</span>
            <span className="stat-del">-{totalDeletions}</span>
          </span>
        </div>

        <button type="button" className="btn-ghost copy-diff-btn font-mono" onClick={handleCopy}>
          {copied ? <Check size={13} className="text-success" /> : <Copy size={13} />}
          <span>{copied ? 'Copied' : 'Copy patch'}</span>
        </button>
      </div>

      <div className="diff-files-list">
        {fileDiffs.map((file) => {
          const isCollapsed = collapsedFiles[file.fileName];

          return (
            <div key={file.fileName} className="diff-file-card">
              <div
                className="diff-file-header"
                onClick={() => toggleCollapse(file.fileName)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') toggleCollapse(file.fileName);
                }}
              >
                <div className="diff-file-title-group">
                  {isCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                  <span className="diff-file-name font-mono">{file.fileName}</span>
                  <span className="diff-git-spec font-mono text-muted" style={{ fontSize: '11px', opacity: 0.75 }}>
                    diff --git a/{file.fileName} b/{file.fileName}
                  </span>
                  <span className={`diff-status-badge font-mono status-${file.status}`}>
                    {file.status}
                  </span>
                </div>

                <div className="diff-file-stats font-mono">
                  {file.additions > 0 && <span className="stat-add">+{file.additions}</span>}
                  {file.deletions > 0 && <span className="stat-del">-{file.deletions}</span>}
                </div>
              </div>

              {!isCollapsed && (
                <div className="diff-code-table font-mono">
                  {file.lines.map((l, lIdx) => (
                    <div key={lIdx} className={`diff-code-line line-${l.type}`}>
                      <span className="diff-gutter" aria-hidden="true">
                        {l.type === 'add' ? '+' : l.type === 'del' ? '-' : ' '}
                      </span>
                      <pre className="diff-code-content">{l.content}</pre>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
