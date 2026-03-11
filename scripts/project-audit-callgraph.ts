import { Project, SyntaxKind } from "ts-morph";
import fs from "fs";
import path from "path";

const REPO_ROOT = path.resolve(__dirname, "..");
const AUDIT_PATHS = ["client/src", "server", "shared", "packages"];
const report: any = {
    unusedImports: [],
    orphanedFiles: [],
    highComplexity: [],
    unreferencedExports: [],
    callGraph: {}
};

// Initialize project
const project = new Project({
    tsConfigFilePath: path.join(REPO_ROOT, "tsconfig.json"),
});

// Add all source files
AUDIT_PATHS.forEach(p => {
    const fullPath = path.join(REPO_ROOT, p);
    if (fs.existsSync(fullPath)) {
        project.addSourceFilesAtPaths(path.join(fullPath, "**/*.{ts,tsx}"));
    }
});

// Track used files and identifiers
const usedFiles = new Set<string>();
const usedSymbols = new Set<string>();

project.getSourceFiles().forEach(file => {
    const filePath = file.getFilePath();
    // Track imports
    file.getImportDeclarations().forEach(imp => {
        const resolved = imp.getModuleSpecifierSourceFile();
        if (resolved) usedFiles.add(resolved.getFilePath());
    });

    // Track function calls
    file.getDescendantsOfKind(SyntaxKind.CallExpression).forEach(call => {
        const identifier = call.getExpression();
        if (identifier.getKind() === SyntaxKind.Identifier) {
            usedSymbols.add(identifier.getText());
            const fnName = identifier.getText();
            report.callGraph[fnName] = report.callGraph[fnName] || [];
            report.callGraph[fnName].push(filePath);
        }
    });

    // Detect unused imports
    file.getImportDeclarations().forEach(imp => {
        imp.getNamedImports().forEach(named => {
            const name = named.getName();
            const refs = named.findReferences();
            if (refs.length === 0) report.unusedImports.push({ file: filePath, name });
        });
    });

    // Cyclomatic complexity
    file.getFunctions().forEach(fn => {
        let complexity = 1;
        fn.forEachDescendant(node => {
            if ([
                SyntaxKind.IfStatement,
                SyntaxKind.ForStatement,
                SyntaxKind.ForOfStatement,
                SyntaxKind.ForInStatement,
                SyntaxKind.WhileStatement,
                SyntaxKind.CaseClause,
                SyntaxKind.CatchClause,
                SyntaxKind.ConditionalExpression,
                SyntaxKind.BinaryExpression
            ].includes(node.getKind())) complexity++;
        });
        if (complexity > 10) {
            report.highComplexity.push({ file: filePath, name: fn.getName() || "<anonymous>", complexity });
        }
    });

    // Track exported symbols
    file.getExportedDeclarations().forEach((decls, name) => {
        if (!usedSymbols.has(name)) {
            report.unreferencedExports.push({ file: filePath, name });
        }
    });
});

// Orphaned files detection
project.getSourceFiles().forEach(file => {
    if (!usedFiles.has(file.getFilePath())) report.orphanedFiles.push(file.getFilePath());
});

// Write report
const reportPath = path.join(REPO_ROOT, "audit-callgraph-report.json");
fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
console.log("✅ Call graph audit complete. See audit-callgraph-report.json for details.");
console.log(JSON.stringify(report, null, 2));
