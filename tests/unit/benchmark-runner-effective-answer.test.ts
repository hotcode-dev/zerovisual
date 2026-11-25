import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

// runner.ts is not importable in unit tests: it is a script that kicks off
// runBenchmark() on load (network + filesystem side effects) and its helpers
// are module-local. To cover pickEffectiveAnswer without restructuring the
// module, we lift the function's actual source out of runner.ts, transpile it
// to plain JS, and pin its exact semantics.

const runnerSource = readFileSync(fileURLToPath(new URL('../../benchmark/runner.ts', import.meta.url)), 'utf8');

function extractFunctionSource(name: string): string {
  const sf = ts.createSourceFile('runner.ts', runnerSource, ts.ScriptTarget.ES2022, true);
  let found: ts.FunctionDeclaration | undefined;
  const walk = (n: ts.Node): void => {
    if (found) return;
    if (ts.isFunctionDeclaration(n) && n.name && n.name.text === name) {
      found = n;
      return;
    }
    n.forEachChild(walk);
  };
  sf.forEachChild(walk);
  if (!found) throw new Error(`function ${name} not found in benchmark/runner.ts`);
  return runnerSource.slice(found.getFullStart(), found.getEnd());
}

const helperJs = ts.transpileModule(extractFunctionSource('pickEffectiveAnswer'), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS }
}).outputText;

const pickEffectiveAnswer = new Function(`${helperJs}\nreturn pickEffectiveAnswer;`)() as (res: {
  content: string;
  reasoning: string;
}) => string;

describe('runner.ts pickEffectiveAnswer (module-local helper)', () => {
  it('returns trimmed content when its trimmed length is over 10 chars', () => {
    expect(pickEffectiveAnswer({ content: '  The header is shifted  ', reasoning: 'ignore me entirely' })).toBe(
      'The header is shifted'
    );
  });

  it('falls back to reasoning when trimmed content length is exactly 10 (boundary)', () => {
    expect(pickEffectiveAnswer({ content: '    1234567890   ', reasoning: 'fallback answer here' })).toBe(
      'fallback answer here'
    );
  });

  it('uses content when trimmed length is exactly 11 (boundary)', () => {
    expect(pickEffectiveAnswer({ content: '12345678901', reasoning: 'fallback answer here' })).toBe('12345678901');
  });

  it('takes the last three reasoning paragraphs when content is short', () => {
    const reasoning = ['p1', 'p2', 'p3', 'p4', 'p5'].join('\n\n');
    expect(pickEffectiveAnswer({ content: '', reasoning })).toBe(['p3', 'p4', 'p5'].join('\n\n'));
  });

  it('keeps fewer than three reasoning paragraphs intact', () => {
    expect(pickEffectiveAnswer({ content: 'short', reasoning: 'only one paragraph' })).toBe('only one paragraph');
    expect(pickEffectiveAnswer({ content: 'short', reasoning: 'a\n\nb\n\nc' })).toBe('a\n\nb\n\nc');
  });

  it('trims the outer edges of the paragraph join (inner paragraph whitespace is preserved)', () => {
    expect(pickEffectiveAnswer({ content: 'short', reasoning: '  p1\n\n  p2  ' })).toBe('p1\n\n  p2');
  });

  it('falls back to reasoning.trim() when the paragraph join is blank', () => {
    expect(pickEffectiveAnswer({ content: '', reasoning: '   \n\n  ' })).toBe('');
    expect(pickEffectiveAnswer({ content: 'short', reasoning: '' })).toBe('');
  });

  it('treats whitespace-only content as short', () => {
    expect(pickEffectiveAnswer({ content: ' \n\t ', reasoning: 'r1\n\nr2' })).toBe('r1\n\nr2');
  });
});

describe('runner.ts effective-answer dedup (structural guard)', () => {
  it('defines pickEffectiveAnswer exactly once', () => {
    expect(runnerSource.match(/function pickEffectiveAnswer\(/g)).toHaveLength(1);
  });

  it('routes both Mode A and Mode B through the helper', () => {
    expect(runnerSource).toContain('const effectiveAnswerA = pickEffectiveAnswer(resA);');
    expect(runnerSource).toContain('const effectiveAnswerB = pickEffectiveAnswer(resB);');
  });

  it('leaves no duplicated inline effective-answer ternaries behind', () => {
    // The threshold expression must exist exactly once — inside the helper itself.
    expect(runnerSource.match(/content\.length > 10/g)).toHaveLength(1);
    expect(runnerSource.match(/reasoning\.split\('\\n\\n'\)\.slice\(-3\)/g)).toHaveLength(1);
  });
});
