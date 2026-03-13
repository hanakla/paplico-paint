#!/usr/bin/env node

import * as fs from 'node:fs';
import * as path from 'node:path';
import { createModuleGraph } from 'ts-module-graph';

interface ImportDetail {
  from: string;
  isExternal: boolean;
  members?: {
    default?: boolean;
    namespace?: string;
    named?: string[];
  };
}

interface GraphSummary {
  targetFile: string;
  imports: ImportDetail[];
  importedBy: string[];
  circularDependencies: string[][];
}

function getRelativePath(from: string, to: string): string {
  const relative = path.relative(from, to);
  return relative.startsWith('.') ? relative : `./${relative}`;
}

async function analyzeGraph(
  entryPoint: string,
  options: { baseDir?: string } = {},
): Promise<GraphSummary> {
  const baseDir = options.baseDir || process.cwd();
  const absoluteEntryPoint = path.resolve(baseDir, entryPoint);

  if (!fs.existsSync(absoluteEntryPoint)) {
    throw new Error(`Entry point not found: ${absoluteEntryPoint}`);
  }

  // Create the module graph
  const graph = await createModuleGraph([absoluteEntryPoint]);

  const summary: GraphSummary = {
    targetFile: getRelativePath(baseDir, absoluteEntryPoint),
    imports: [],
    importedBy: [],
    circularDependencies: [],
  };

  // Find the target file in the graph
  let targetNode: any = null;
  let _targetSourceFile: any = null;

  for (const [sourceFile, node] of graph) {
    if (sourceFile.fileName === absoluteEntryPoint) {
      targetNode = node;
      _targetSourceFile = sourceFile;
      break;
    }
  }

  if (!targetNode) {
    throw new Error(`Target file not found in graph: ${absoluteEntryPoint}`);
  }

  // Collect imports of the target file
  for (const imp of targetNode.imports) {
    const moduleSpecifier = imp.id;
    const isExternal =
      !moduleSpecifier.startsWith('.') && !moduleSpecifier.startsWith('/');

    const importDetail: ImportDetail = {
      from: moduleSpecifier,
      isExternal,
      members: {},
    };

    // Extract import members from importSpecifiers array
    if (imp.importSpecifiers && Array.isArray(imp.importSpecifiers)) {
      imp.importSpecifiers.forEach((spec: any) => {
        if (spec.kind === 'default') {
          importDetail.members!.default = true;
        } else if (spec.kind === 'namespace' && spec.name) {
          importDetail.members!.namespace = spec.name.text || spec.name;
        } else if (spec.kind === 'name' && spec.name) {
          if (!importDetail.members!.named) {
            importDetail.members!.named = [];
          }
          const importName = spec.propertyName
            ? `${spec.name.text || spec.name} as ${spec.propertyName.text || spec.propertyName}`
            : spec.name.text || spec.name;
          importDetail.members!.named.push(importName);
        }
      });
    }

    // Also check resolvedImports for additional info
    if (imp.resolvedImports) {
      if (imp.resolvedImports.default && !importDetail.members!.default) {
        importDetail.members!.default = true;
      }
      if (imp.resolvedImports.namespace && !importDetail.members!.namespace) {
        importDetail.members!.namespace =
          imp.resolvedImports.namespace.localName;
      }
      if (imp.resolvedImports.named && !importDetail.members!.named) {
        importDetail.members!.named = Object.keys(imp.resolvedImports.named);
      }
    }

    if (isExternal) {
      summary.imports.push(importDetail);
    } else if (imp.resolvedModule?.resolvedFileName) {
      const resolvedPath = imp.resolvedModule.resolvedFileName;
      if (!resolvedPath.includes('node_modules')) {
        importDetail.from = getRelativePath(baseDir, resolvedPath);
        summary.imports.push(importDetail);
      }
    }
  }

  // Find who imports the target file
  for (const [sourceFile, node] of graph) {
    const modulePath = sourceFile.fileName;

    // Skip node_modules and the target file itself
    if (
      modulePath.includes('node_modules') ||
      modulePath === absoluteEntryPoint
    )
      continue;

    // Check if this module imports the target file
    for (const imp of node.imports) {
      if (imp.resolvedModule?.resolvedFileName === absoluteEntryPoint) {
        summary.importedBy.push(getRelativePath(baseDir, modulePath));
        break;
      }
    }
  }

  // Detect circular dependencies involving the target file
  const circularDeps: string[][] = [];
  const visited = new Set<string>();

  function detectCycles(currentPath: string[], currentFile: string): void {
    if (currentPath.includes(currentFile)) {
      // Found a cycle
      const cycleStart = currentPath.indexOf(currentFile);
      const cycle = [...currentPath.slice(cycleStart), currentFile];

      // Only include if it involves the target file
      if (cycle.includes(absoluteEntryPoint)) {
        circularDeps.push(cycle);
      }
      return;
    }

    if (visited.has(currentFile)) return;
    visited.add(currentFile);

    // Find the node for current file
    for (const [sourceFile, node] of graph) {
      if (sourceFile.fileName === currentFile) {
        for (const imp of node.imports) {
          if (
            imp.resolvedModule?.resolvedFileName &&
            !imp.resolvedModule.resolvedFileName.includes('node_modules')
          ) {
            detectCycles(
              [...currentPath, currentFile],
              imp.resolvedModule.resolvedFileName,
            );
          }
        }
        break;
      }
    }
  }

  detectCycles([], absoluteEntryPoint);

  summary.circularDependencies = circularDeps.map((cycle) =>
    cycle.map((p) => getRelativePath(baseDir, p)),
  );

  return summary;
}

function formatSummary(summary: GraphSummary): string {
  const lines: string[] = [];

  lines.push('=== TypeScript Module Graph Summary ===');
  lines.push(`Target File: ${summary.targetFile}`);
  lines.push('');

  // Group imports by type
  const internalImports = summary.imports.filter((imp) => !imp.isExternal);
  const externalImports = summary.imports.filter((imp) => imp.isExternal);

  if (internalImports.length > 0) {
    lines.push(`Internal Imports (${internalImports.length}):`);
    internalImports.forEach((imp) => {
      const memberParts: string[] = [];
      if (imp.members?.default) memberParts.push('default');
      if (imp.members?.namespace)
        memberParts.push(`* as ${imp.members.namespace}`);
      if (imp.members?.named && imp.members.named.length > 0) {
        memberParts.push(`{ ${imp.members.named.join(', ')} }`);
      }

      const memberStr =
        memberParts.length > 0 ? ` [${memberParts.join(', ')}]` : '';
      lines.push(`  - ${imp.from}${memberStr}`);
    });
    lines.push('');
  }

  if (externalImports.length > 0) {
    lines.push(`External Imports (${externalImports.length}):`);
    externalImports.forEach((imp) => {
      const memberParts: string[] = [];
      if (imp.members?.default) memberParts.push('default');
      if (imp.members?.namespace)
        memberParts.push(`* as ${imp.members.namespace}`);
      if (imp.members?.named && imp.members.named.length > 0) {
        memberParts.push(`{ ${imp.members.named.join(', ')} }`);
      }

      const memberStr =
        memberParts.length > 0 ? ` [${memberParts.join(', ')}]` : '';
      lines.push(`  - ${imp.from}${memberStr}`);
    });
    lines.push('');
  }

  if (summary.importedBy.length > 0) {
    lines.push(`Imported By (${summary.importedBy.length}):`);
    summary.importedBy.forEach((module) => {
      lines.push(`  - ${module}`);
    });
    lines.push('');
  } else {
    lines.push('Not imported by any internal modules');
    lines.push('');
  }

  if (summary.circularDependencies.length > 0) {
    lines.push(
      `Circular Dependencies Involving This File (${summary.circularDependencies.length}):`,
    );
    summary.circularDependencies.forEach((cycle, index) => {
      lines.push(`  ${index + 1}. ${cycle.join(' → ')}`);
    });
    lines.push('');
  }

  return lines.join('\n');
}

// Main execution
if (process.argv.length < 3) {
  console.error('Usage: ts-graph.ts <entry-point> [--base-dir <dir>]');
  console.error('Example: ts-graph.ts src/index.ts --base-dir .');
  process.exit(1);
}

const entryPoint = process.argv[2];
let baseDir = process.cwd();

// Parse command line arguments
const baseDirIndex = process.argv.indexOf('--base-dir');
if (baseDirIndex !== -1 && baseDirIndex < process.argv.length - 1) {
  baseDir = path.resolve(process.argv[baseDirIndex + 1]);
}

async function main() {
  try {
    console.log(`Analyzing module graph starting from: ${entryPoint}`);
    console.log(`Base directory: ${baseDir}`);
    console.log('');

    const summary = await analyzeGraph(entryPoint, { baseDir });
    console.log(formatSummary(summary));
  } catch (error) {
    console.error(`Error analyzing module graph: ${error}`);
    process.exit(1);
  }
}

main();
