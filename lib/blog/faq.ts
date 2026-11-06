export type FaqItem = { question: string; answer: string };

const ENTITIES: Record<string, string> = {
  '&rsquo;': '’',
  '&lsquo;': '‘',
  '&ldquo;': '“',
  '&rdquo;': '”',
  '&amp;': '&',
  '&nbsp;': ' ',
};

function plain(md: string): string {
  return md
    .replace(/<[^>]+>/g, ' ')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/\*\*?|`/g, '')
    .replace(/&[a-z]+;/g, (e) => ENTITIES[e] ?? ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function parseFaq(source: string): FaqItem[] {
  const section = source.split(/^## Questions\s*$/m)[1]?.split(/^## /m)[0] ?? '';
  return section
    .split(/^### /m)
    .slice(1)
    .map((block) => {
      const [question, ...answer] = block.split('\n');
      return { question: plain(question), answer: plain(answer.join('\n')) };
    })
    .filter((item) => item.question && item.answer);
}
