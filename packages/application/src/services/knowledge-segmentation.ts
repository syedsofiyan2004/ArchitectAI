import { SourceSection } from '@architectai/domain';

export function segmentDocument(content: string): SourceSection[] {
  // A simple chunker for markdown/text.
  // Splits by markdown headers or double newlines if no headers exist.
  const sections: SourceSection[] = [];
  
  // Regex to match markdown headers
  const headerRegex = /^(#{1,6})\s+(.*)$/gm;
  
  let match;
  let currentPath: string[] = [];

  // Find all headers
  const matches: { index: number, level: number, text: string }[] = [];
  while ((match = headerRegex.exec(content)) !== null) {
    matches.push({
      index: match.index,
      level: match[1]!.length,
      text: match[2]!.trim()
    });
  }

  if (matches.length === 0) {
    // If no markdown headers, just split by double newline blocks roughly
    const chunks = content.split(/\n\n+/);
    chunks.forEach((chunk, i) => {
      if (chunk.trim()) {
        sections.push({
          id: `sec-${i}`,
          heading: `Paragraph ${i + 1}`,
          content: chunk.trim(),
          path: [],
          tokenCountEstimate: Math.ceil(chunk.length / 4)
        });
      }
    });
    return sections;
  }

  // Iterate over matches and create sections
  for (let i = 0; i < matches.length; i++) {
    const currentMatch = matches[i]!;
    const nextMatch = matches[i + 1];
    
    // Maintain path
    // Simple heuristic: just keep the current header in path for this prototype
    currentPath = [currentMatch.text];
    
    const start = currentMatch.index;
    const end = nextMatch ? nextMatch.index : content.length;
    
    const sectionContent = content.substring(start, end).trim();
    if (sectionContent) {
      sections.push({
        id: `sec-h${i}`,
        heading: currentMatch.text,
        content: sectionContent,
        path: currentPath,
        tokenCountEstimate: Math.ceil(sectionContent.length / 4)
      });
    }
  }

  // Also capture anything before the first header
  if (matches[0]!.index > 0) {
    const intro = content.substring(0, matches[0]!.index).trim();
    if (intro) {
      sections.unshift({
        id: 'sec-intro',
        heading: 'Introduction',
        content: intro,
        path: [],
        tokenCountEstimate: Math.ceil(intro.length / 4)
      });
    }
  }

  return sections;
}
