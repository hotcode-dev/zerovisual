import ts from 'typescript';

/**
 * Lift the source of a top-level function declaration out of a file's text.
 * Walks the AST via ts.createSourceFile + forEachChild to find the named
 * FunctionDeclaration and slices the original source string.
 */
export function extractFunctionSource(source: string, filename: string, name: string): string {
  const sf = ts.createSourceFile(filename, source, ts.ScriptTarget.ES2022, true);
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
  if (!found) throw new Error(`function ${name} not found in ${filename}`);
  return source.slice(found.getFullStart(), found.getEnd());
}
