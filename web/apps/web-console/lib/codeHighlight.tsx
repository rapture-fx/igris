import * as React from 'react';

const HL = {
  keyword:  '#c792ea',
  string:   '#a5e075',
  fn:       '#82aaff',
  prop:     '#7fdbca',
  flag:     '#f78c6c',
  variable: '#ffcb6b',
  punct:    '#5a5a52',
} as const;

export type Token = { type: keyof typeof HL | 'text'; value: string };

function tokenize(src: string, rules: Array<{ type: Token['type']; re: RegExp }>): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  let buf = '';
  while (i < src.length) {
    let matched: { type: Token['type']; value: string } | null = null;
    for (const rule of rules) {
      rule.re.lastIndex = i;
      const m = rule.re.exec(src);
      if (m && m.index === i && m[0].length > 0) {
        matched = { type: rule.type, value: m[0] };
        break;
      }
    }
    if (matched) {
      if (buf) { tokens.push({ type: 'text', value: buf }); buf = ''; }
      tokens.push(matched);
      i += matched.value.length;
    } else {
      buf += src[i];
      i += 1;
    }
  }
  if (buf) tokens.push({ type: 'text', value: buf });
  return tokens;
}

export function tokensForCurl(src: string): Token[] {
  return tokenize(src, [
    { type: 'string',   re: /'(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*"/y },
    { type: 'fn',       re: /\bcurl\b/y },
    { type: 'keyword',  re: /\b(?:POST|GET|PUT|DELETE|PATCH|HEAD|OPTIONS)\b/y },
    { type: 'flag',     re: /-{1,2}[A-Za-z][\w-]*/y },
    { type: 'variable', re: /\$[A-Z_][A-Z0-9_]*/y },
    { type: 'punct',    re: /\\(?=\s*$)/my },
  ]);
}

export function tokensForTs(src: string): Token[] {
  const tokens = tokenize(src, [
    { type: 'string',  re: /`(?:[^`\\$]|\\.|\$(?!\{))*`|`(?:[^`\\]|\\.|\$\{[^}]*\})*`/y },
    { type: 'string',  re: /'(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*"/y },
    { type: 'keyword', re: /\b(?:await|async|const|let|var|return|new|function|if|else|true|false|null|undefined)\b/y },
    { type: 'fn',      re: /\b(?:fetch|JSON|stringify|process|env)\b/y },
    { type: 'prop',    re: /[A-Za-z_][\w-]*(?=\s*:)/y },
  ]);
  const refined: Token[] = [];
  for (const t of tokens) {
    if (t.type === 'string' && t.value.startsWith('`') && t.value.includes('${')) {
      const parts = t.value.split(/(\$\{[^}]*\})/g);
      for (const part of parts) {
        if (!part) continue;
        refined.push({ type: part.startsWith('${') ? 'variable' : 'string', value: part });
      }
    } else {
      refined.push(t);
    }
  }
  return refined;
}

function renderTokens(tokens: Token[]): React.ReactNode {
  return tokens.map((t, idx) => {
    if (t.type === 'text') return <span key={idx}>{t.value}</span>;
    return <span key={idx} style={{ color: HL[t.type] }}>{t.value}</span>;
  });
}

export function CodeBlock({ tokens }: { tokens: Token[] }) {
  return (
    <pre
      className="overflow-x-auto whitespace-pre-wrap text-[11.5px] leading-relaxed text-[#c8c7be] m-0"
      style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace' }}
    >
      {renderTokens(tokens)}
    </pre>
  );
}
