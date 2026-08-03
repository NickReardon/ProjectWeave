import type { SourceNote } from '../../src/domain/model';

export function sourceNote(
  path: string,
  frontmatter: string,
  body = '',
): SourceNote {
  const content = ['---', frontmatter.trim(), '---', body].join('\n');
  return {
    path,
    content,
    fingerprint: 'test:' + path + ':' + String(content.length),
  };
}
