#!/usr/bin/env node

import * as fs from 'node:fs'
import * as path from 'node:path'
import * as ts from 'typescript'

interface Summary {
  filePath: string
  imports: ImportInfo[]
  classes: ClassInfo[]
  functions: FunctionInfo[]
  reactHooks: FunctionInfo[]
  interfaces: InterfaceInfo[]
  types: TypeAliasInfo[]
  namespaces: NamespaceInfo[]
  variables: VariableInfo[]
}

interface ClassInfo {
  name: string
  isExported: boolean
  isAbstract: boolean
  extends?: string
  implements: string[]
  members: MemberInfo[]
  startLine: number
  endLine: number
}

interface MemberInfo {
  name: string
  kind: 'property' | 'method' | 'getter' | 'setter'
  visibility: 'public' | 'private' | 'protected'
  isStatic: boolean
  isAbstract: boolean
  type?: string
  parameters?: ParameterInfo[]
  returnType?: string
  line: number
}

interface FunctionInfo {
  name: string
  isExported: boolean
  isAsync: boolean
  parameters: ParameterInfo[]
  returnType?: string
  startLine: number
  endLine: number
}

interface ParameterInfo {
  name: string
  type?: string
  isOptional: boolean
}

interface VariableInfo {
  name: string
  isExported: boolean
  isConst: boolean
  type?: string
  line: number
}

interface ImportInfo {
  module: string
  imports: string[]
  isDefaultImport: boolean
  isNamespaceImport: boolean
  line: number
}

interface InterfaceInfo {
  name: string
  isExported: boolean
  extends: string[]
  members: InterfaceMemberInfo[]
  startLine: number
  endLine: number
}

interface InterfaceMemberInfo {
  name: string
  type?: string
  isOptional: boolean
  line: number
}

interface TypeAliasInfo {
  name: string
  isExported: boolean
  type: string
  line: number
}

interface NamespaceInfo {
  name: string
  isExported: boolean
  startLine: number
  endLine: number
}

function getVisibility(node: ts.Node): 'public' | 'private' | 'protected' {
  const modifiers = ts.canHaveModifiers(node)
    ? ts.getModifiers(node)
    : undefined
  if (modifiers) {
    if (modifiers.some((m) => m.kind === ts.SyntaxKind.PrivateKeyword))
      return 'private'
    if (modifiers.some((m) => m.kind === ts.SyntaxKind.ProtectedKeyword))
      return 'protected'
  }
  return 'public'
}

function isExported(node: ts.Node): boolean {
  const modifiers = ts.canHaveModifiers(node)
    ? ts.getModifiers(node)
    : undefined
  return !!modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword)
}

function isStatic(node: ts.Node): boolean {
  const modifiers = ts.canHaveModifiers(node)
    ? ts.getModifiers(node)
    : undefined
  return !!modifiers?.some((m) => m.kind === ts.SyntaxKind.StaticKeyword)
}

function isAbstract(node: ts.Node): boolean {
  const modifiers = ts.canHaveModifiers(node)
    ? ts.getModifiers(node)
    : undefined
  return !!modifiers?.some((m) => m.kind === ts.SyntaxKind.AbstractKeyword)
}

function getTypeString(
  typeNode: ts.TypeNode | undefined,
  typeChecker: ts.TypeChecker,
  node: ts.Node,
): string | undefined {
  if (!typeNode) return undefined

  try {
    const type = typeChecker.getTypeFromTypeNode(typeNode)
    return typeChecker.typeToString(type, node, ts.TypeFormatFlags.NoTruncation)
  } catch {
    return typeNode.getText()
  }
}

function getLineNumber(node: ts.Node, sourceFile: ts.SourceFile): number {
  const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart())
  return line + 1 // Convert 0-based to 1-based
}

function getEndLineNumber(node: ts.Node, sourceFile: ts.SourceFile): number {
  const { line } = sourceFile.getLineAndCharacterOfPosition(node.getEnd())
  return line + 1 // Convert 0-based to 1-based
}

function analyzeClass(
  node: ts.ClassDeclaration,
  typeChecker: ts.TypeChecker,
  sourceFile: ts.SourceFile,
): ClassInfo | null {
  if (!node.name) return null

  const classInfo: ClassInfo = {
    name: node.name.text,
    isExported: isExported(node),
    isAbstract: isAbstract(node),
    implements: [],
    members: [],
    startLine: getLineNumber(node, sourceFile),
    endLine: getEndLineNumber(node, sourceFile),
  }

  // Get extends clause
  if (node.heritageClauses) {
    for (const clause of node.heritageClauses) {
      if (
        clause.token === ts.SyntaxKind.ExtendsKeyword &&
        clause.types.length > 0
      ) {
        classInfo.extends = clause.types[0].getText()
      } else if (clause.token === ts.SyntaxKind.ImplementsKeyword) {
        classInfo.implements = clause.types.map((t) => t.getText())
      }
    }
  }

  // Analyze members
  node.members.forEach((member) => {
    if (ts.isPropertyDeclaration(member) || ts.isPropertySignature(member)) {
      const propertySymbol = typeChecker.getSymbolAtLocation(member.name!)
      const type = propertySymbol
        ? typeChecker.getTypeOfSymbolAtLocation(propertySymbol, member)
        : undefined

      classInfo.members.push({
        name: member.name?.getText() || 'unknown',
        kind: 'property',
        visibility: getVisibility(member),
        isStatic: isStatic(member),
        isAbstract: false,
        type: type ? typeChecker.typeToString(type) : undefined,
        line: getLineNumber(member, sourceFile),
      })
    } else if (ts.isMethodDeclaration(member) || ts.isMethodSignature(member)) {
      const methodInfo: MemberInfo = {
        name: member.name?.getText() || 'unknown',
        kind: 'method',
        visibility: getVisibility(member),
        isStatic: isStatic(member),
        isAbstract: isAbstract(member),
        line: getLineNumber(member, sourceFile),
      }

      // Add parameters
      if (member.parameters) {
        methodInfo.parameters = member.parameters.map((param) => ({
          name: param.name?.getText() || 'unknown',
          type: param.type
            ? getTypeString(param.type, typeChecker, param)
            : undefined,
          isOptional: !!param.questionToken,
        }))
      }

      // Add return type
      if (member.type) {
        methodInfo.returnType = getTypeString(member.type, typeChecker, member)
      }

      classInfo.members.push(methodInfo)
    } else if (ts.isGetAccessorDeclaration(member)) {
      classInfo.members.push({
        name: member.name?.getText() || 'unknown',
        kind: 'getter',
        visibility: getVisibility(member),
        isStatic: isStatic(member),
        isAbstract: false,
        line: getLineNumber(member, sourceFile),
      })
    } else if (ts.isSetAccessorDeclaration(member)) {
      classInfo.members.push({
        name: member.name?.getText() || 'unknown',
        kind: 'setter',
        visibility: getVisibility(member),
        isStatic: isStatic(member),
        isAbstract: false,
        line: getLineNumber(member, sourceFile),
      })
    }
  })

  return classInfo
}

function analyzeFunction(
  node: ts.FunctionDeclaration,
  typeChecker: ts.TypeChecker,
  sourceFile: ts.SourceFile,
): FunctionInfo | null {
  if (!node.name) return null

  const parameters: ParameterInfo[] = node.parameters.map((param) => ({
    name: param.name.getText(),
    type: param.type
      ? getTypeString(param.type, typeChecker, param)
      : undefined,
    isOptional: !!param.questionToken,
  }))

  const modifiers = ts.canHaveModifiers(node)
    ? ts.getModifiers(node)
    : undefined

  return {
    name: node.name.text,
    isExported: isExported(node),
    isAsync: !!modifiers?.some((m) => m.kind === ts.SyntaxKind.AsyncKeyword),
    parameters,
    returnType: node.type
      ? getTypeString(node.type, typeChecker, node)
      : undefined,
    startLine: getLineNumber(node, sourceFile),
    endLine: getEndLineNumber(node, sourceFile),
  }
}

function analyzeVariable(
  node: ts.VariableStatement,
  typeChecker: ts.TypeChecker,
  sourceFile: ts.SourceFile,
): VariableInfo[] {
  const variables: VariableInfo[] = []
  const isExportedVar = isExported(node)
  const isConst = node.declarationList.flags & ts.NodeFlags.Const

  node.declarationList.declarations.forEach((decl) => {
    if (ts.isIdentifier(decl.name)) {
      const symbol = typeChecker.getSymbolAtLocation(decl.name)
      const type = symbol
        ? typeChecker.getTypeOfSymbolAtLocation(symbol, decl)
        : undefined

      variables.push({
        name: decl.name.text,
        isExported: isExportedVar,
        isConst: !!isConst,
        type: type ? typeChecker.typeToString(type) : undefined,
        line: getLineNumber(decl, sourceFile),
      })
    }
  })

  return variables
}

function analyzeImport(
  node: ts.ImportDeclaration,
  sourceFile: ts.SourceFile,
): ImportInfo | null {
  const moduleSpecifier = node.moduleSpecifier
  if (!ts.isStringLiteral(moduleSpecifier)) return null

  const importInfo: ImportInfo = {
    module: moduleSpecifier.text,
    imports: [],
    isDefaultImport: false,
    isNamespaceImport: false,
    line: getLineNumber(node, sourceFile),
  }

  if (node.importClause) {
    // Default import
    if (node.importClause.name) {
      importInfo.isDefaultImport = true
      importInfo.imports.push(node.importClause.name.text)
    }

    // Named imports or namespace import
    if (node.importClause.namedBindings) {
      if (ts.isNamespaceImport(node.importClause.namedBindings)) {
        importInfo.isNamespaceImport = true
        importInfo.imports.push(node.importClause.namedBindings.name.text)
      } else if (ts.isNamedImports(node.importClause.namedBindings)) {
        node.importClause.namedBindings.elements.forEach((element) => {
          importInfo.imports.push(element.name.text)
        })
      }
    }
  }

  return importInfo
}

function analyzeInterface(
  node: ts.InterfaceDeclaration,
  typeChecker: ts.TypeChecker,
  sourceFile: ts.SourceFile,
): InterfaceInfo {
  const interfaceInfo: InterfaceInfo = {
    name: node.name.text,
    isExported: isExported(node),
    extends: [],
    members: [],
    startLine: getLineNumber(node, sourceFile),
    endLine: getEndLineNumber(node, sourceFile),
  }

  // Get extends clauses
  if (node.heritageClauses) {
    node.heritageClauses.forEach((clause) => {
      if (clause.token === ts.SyntaxKind.ExtendsKeyword) {
        clause.types.forEach((type) => {
          interfaceInfo.extends.push(type.getText())
        })
      }
    })
  }

  // Analyze members
  node.members.forEach((member) => {
    if (ts.isPropertySignature(member) && member.name) {
      const memberInfo: InterfaceMemberInfo = {
        name: member.name.getText(),
        isOptional: !!member.questionToken,
        line: getLineNumber(member, sourceFile),
      }

      if (member.type) {
        memberInfo.type = getTypeString(member.type, typeChecker, member)
      }

      interfaceInfo.members.push(memberInfo)
    }
  })

  return interfaceInfo
}

function analyzeTypeAlias(
  node: ts.TypeAliasDeclaration,
  typeChecker: ts.TypeChecker,
  sourceFile: ts.SourceFile,
): TypeAliasInfo {
  return {
    name: node.name.text,
    isExported: isExported(node),
    type: node.type ? node.type.getText() : 'unknown',
    line: getLineNumber(node, sourceFile),
  }
}

function analyzeNamespace(
  node: ts.ModuleDeclaration,
  sourceFile: ts.SourceFile,
): NamespaceInfo | null {
  if (!node.name || !ts.isIdentifier(node.name)) return null

  return {
    name: node.name.text,
    isExported: isExported(node),
    startLine: getLineNumber(node, sourceFile),
    endLine: getEndLineNumber(node, sourceFile),
  }
}

function analyzeFile(filePath: string): Summary {
  const program = ts.createProgram([filePath], {
    target: ts.ScriptTarget.ESNext,
    module: ts.ModuleKind.CommonJS,
    allowJs: true,
    checkJs: false,
    jsx: ts.JsxEmit.React,
  })

  const sourceFile = program.getSourceFile(filePath)
  const typeChecker = program.getTypeChecker()

  if (!sourceFile) {
    throw new Error(`Failed to parse file: ${filePath}`)
  }

  const summary: Summary = {
    filePath: path.resolve(filePath),
    imports: [],
    classes: [],
    functions: [],
    reactHooks: [],
    interfaces: [],
    types: [],
    namespaces: [],
    variables: [],
  }

  let depth = 0

  function visit(node: ts.Node) {
    // Track depth to identify top-level declarations
    depth++

    if (ts.isImportDeclaration(node)) {
      const importInfo = analyzeImport(node, sourceFile)
      if (importInfo) {
        summary.imports.push(importInfo)
      }
    } else if (ts.isClassDeclaration(node)) {
      const classInfo = analyzeClass(node, typeChecker, sourceFile)
      if (classInfo) {
        summary.classes.push(classInfo)
      }
    } else if (ts.isFunctionDeclaration(node)) {
      const funcInfo = analyzeFunction(node, typeChecker, sourceFile)
      if (funcInfo) {
        // Check if it's a React Hook (exported function starting with 'use')
        if (funcInfo.isExported && funcInfo.name.startsWith('use')) {
          summary.reactHooks.push(funcInfo)
        } else {
          summary.functions.push(funcInfo)
        }
      }
    } else if (ts.isInterfaceDeclaration(node)) {
      const interfaceInfo = analyzeInterface(node, typeChecker, sourceFile)
      summary.interfaces.push(interfaceInfo)
    } else if (ts.isTypeAliasDeclaration(node)) {
      const typeInfo = analyzeTypeAlias(node, typeChecker, sourceFile)
      summary.types.push(typeInfo)
    } else if (ts.isModuleDeclaration(node)) {
      const namespaceInfo = analyzeNamespace(node, sourceFile)
      if (namespaceInfo) {
        summary.namespaces.push(namespaceInfo)
      }
    } else if (ts.isVariableStatement(node) && depth <= 2) {
      // Only collect module-level and top-level variables
      const varInfos = analyzeVariable(node, typeChecker, sourceFile)
      summary.variables.push(...varInfos)
    }

    ts.forEachChild(node, visit)

    depth--
  }

  visit(sourceFile)

  return summary
}

function formatSummary(summary: Summary): string {
  const lines: string[] = []

  lines.push(`=== TypeScript File Summary ===`)
  lines.push(`File: ${summary.filePath}`)
  lines.push('')

  if (summary.imports.length > 0) {
    lines.push(`Imports (${summary.imports.length}):`)
    summary.imports.forEach((imp) => {
      if (imp.isDefaultImport) {
        lines.push(
          `  ${imp.imports[0]} from '${imp.module}' (line ${imp.line})`,
        )
      } else if (imp.isNamespaceImport) {
        lines.push(
          `  * as ${imp.imports[0]} from '${imp.module}' (line ${imp.line})`,
        )
      } else if (imp.imports.length > 0) {
        lines.push(
          `  { ${imp.imports.join(', ')} } from '${imp.module}' (line ${imp.line})`,
        )
      } else {
        lines.push(`  '${imp.module}' (line ${imp.line})`)
      }
    })
    lines.push('')
  }

  if (summary.classes.length > 0) {
    lines.push(`Classes (${summary.classes.length}):`)
    summary.classes.forEach((cls) => {
      const modifiers: string[] = []
      if (cls.isExported) modifiers.push('export')
      if (cls.isAbstract) modifiers.push('abstract')

      lines.push(
        `  ${modifiers.join(' ')} class ${cls.name}${cls.extends ? ` extends ${cls.extends}` : ''}${cls.implements.length > 0 ? ` implements ${cls.implements.join(', ')}` : ''} (lines ${cls.startLine}-${cls.endLine})`,
      )

      cls.members.forEach((member) => {
        const memberModifiers: string[] = []
        if (member.visibility !== 'public')
          memberModifiers.push(member.visibility)
        if (member.isStatic) memberModifiers.push('static')
        if (member.isAbstract) memberModifiers.push('abstract')

        const prefix =
          memberModifiers.length > 0 ? `${memberModifiers.join(' ')} ` : ''
        const typeStr = member.type ? `: ${member.type}` : ''

        if (member.kind === 'method' && member.parameters) {
          const params = member.parameters
            .map(
              (p) =>
                `${p.name}${p.isOptional ? '?' : ''}${p.type ? `: ${p.type}` : ''}`,
            )
            .join(', ')
          const returnType = member.returnType ? `: ${member.returnType}` : ''
          lines.push(
            `    ${prefix}${member.name}(${params})${returnType} (${member.kind}, line ${member.line})`,
          )
        } else {
          lines.push(
            `    ${prefix}${member.name}${member.kind === 'method' ? '()' : ''}${typeStr} (${member.kind}, line ${member.line})`,
          )
        }
      })
    })
    lines.push('')
  }

  if (summary.reactHooks.length > 0) {
    lines.push(`React Hooks (${summary.reactHooks.length}):`)
    summary.reactHooks.forEach((func) => {
      const modifiers: string[] = []
      if (func.isExported) modifiers.push('export')
      if (func.isAsync) modifiers.push('async')

      const params = func.parameters
        .map(
          (p) =>
            `${p.name}${p.isOptional ? '?' : ''}${p.type ? `: ${p.type}` : ''}`,
        )
        .join(', ')

      const returnType = func.returnType ? `: ${func.returnType}` : ''

      lines.push(
        `  ${modifiers.join(' ')} function ${func.name}(${params})${returnType} (lines ${func.startLine}-${func.endLine})`,
      )
    })
    lines.push('')
  }

  if (summary.functions.length > 0) {
    lines.push(`Functions (${summary.functions.length}):`)
    summary.functions.forEach((func) => {
      const modifiers: string[] = []
      if (func.isExported) modifiers.push('export')
      if (func.isAsync) modifiers.push('async')

      const params = func.parameters
        .map(
          (p) =>
            `${p.name}${p.isOptional ? '?' : ''}${p.type ? `: ${p.type}` : ''}`,
        )
        .join(', ')

      const returnType = func.returnType ? `: ${func.returnType}` : ''

      lines.push(
        `  ${modifiers.join(' ')} function ${func.name}(${params})${returnType} (lines ${func.startLine}-${func.endLine})`,
      )
    })
    lines.push('')
  }

  if (summary.variables.length > 0) {
    lines.push(`Variables (${summary.variables.length}):`)
    summary.variables.forEach((variable) => {
      const modifiers: string[] = []
      if (variable.isExported) modifiers.push('export')
      if (variable.isConst) modifiers.push('const')

      const typeStr = variable.type ? `: ${variable.type}` : ''

      lines.push(
        `  ${modifiers.join(' ')} ${variable.name}${typeStr} (line ${variable.line})`,
      )
    })
    lines.push('')
  }

  if (summary.interfaces.length > 0) {
    lines.push(`Interfaces (${summary.interfaces.length}):`)
    summary.interfaces.forEach((iface) => {
      const modifiers: string[] = []
      if (iface.isExported) modifiers.push('export')

      const extendsStr =
        iface.extends.length > 0 ? ` extends ${iface.extends.join(', ')}` : ''
      lines.push(
        `  ${modifiers.join(' ')} interface ${iface.name}${extendsStr} (lines ${iface.startLine}-${iface.endLine})`,
      )

      iface.members.forEach((member) => {
        const typeStr = member.type ? `: ${member.type}` : ''
        const optional = member.isOptional ? '?' : ''
        lines.push(
          `    ${member.name}${optional}${typeStr} (line ${member.line})`,
        )
      })
    })
    lines.push('')
  }

  if (summary.types.length > 0) {
    lines.push(`Type Aliases (${summary.types.length}):`)
    summary.types.forEach((type) => {
      const modifiers: string[] = []
      if (type.isExported) modifiers.push('export')

      lines.push(
        `  ${modifiers.join(' ')} type ${type.name} = ${type.type} (line ${type.line})`,
      )
    })
    lines.push('')
  }

  if (summary.namespaces.length > 0) {
    lines.push(`Namespaces (${summary.namespaces.length}):`)
    summary.namespaces.forEach((ns) => {
      const modifiers: string[] = []
      if (ns.isExported) modifiers.push('export')

      lines.push(
        `  ${modifiers.join(' ')} namespace ${ns.name} (lines ${ns.startLine}-${ns.endLine})`,
      )
    })
    lines.push('')
  }

  return lines.join('\n')
}

// Main execution
if (process.argv.length < 3) {
  console.error(
    'Usage: ts-summarizer.ts <typescript-file> [<typescript-file> ...]',
  )
  process.exit(1)
}

const filePaths = process.argv.slice(2)

// Check if all files exist
const missingFiles = filePaths.filter((filePath) => !fs.existsSync(filePath))
if (missingFiles.length > 0) {
  console.error(`File(s) not found: ${missingFiles.join(', ')}`)
  process.exit(1)
}

// Analyze each file
filePaths.forEach((filePath, index) => {
  if (index > 0) {
    console.log('\n' + '='.repeat(80) + '\n')
  }

  try {
    const summary = analyzeFile(filePath)
    console.log(formatSummary(summary))
  } catch (error) {
    console.error(`Error analyzing file ${filePath}: ${error}`)
  }
})
