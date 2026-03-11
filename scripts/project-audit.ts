import { Project, SyntaxKind } from "ts-morph";
import fs from "fs";
import path from "path";

const REPO_ROOT = path.resolve(__dirname, "..");
const AUDIT_PATHS = ["client/src", "server", "shared", "packages"];
const report: any = { unusedImports: [], orphanedFiles: [], highComplexity: [] };

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

// Collect used identifiers for orphan detection
const usedFiles = new Set<string>();

project.getSourceFiles().forEach(file => {
    const filePath = file.getFilePath();
    // Track imports
    file.getImportDeclarations().forEach(imp => {
        const resolved = imp.getModuleSpecifierSourceFile();
        if (resolved) usedFiles.add(resolved.getFilePath());
    });

    // Check for unused imports
    file.getImportDeclarations().forEach(imp => {
        imp.getNamedImports().forEach(named => {
            const name = named.getName();
            const refs = named.findReferences();
            if (refs.length === 0) {
                report.unusedImports.push({ file: filePath, name });
            }
        });
    });

    // Estimate cyclomatic complexity
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
                SyntaxKind.BinaryExpression // logical AND/OR
            ].includes(node.getKind())) complexity++;
        });
        if (complexity > 10) {
            report.highComplexity.push({ file: filePath, name: fn.getName() || "<anonymous>", complexity });
        }
    });
});

// Orphaned files detection
project.getSourceFiles().forEach(file => {
    if (!usedFiles.has(file.getFilePath())) {
        report.orphanedFiles.push(file.getFilePath());
    }
});

// Output results
const reportPath = path.join(REPO_ROOT, "audit-report.json");
fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
console.log("✅ Project audit complete. See audit-report.json for details.");
console.log(JSON.stringify(report, null, 2));
