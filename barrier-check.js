#!/usr/bin/env node
const { Project } = require("ts-morph");
const fs = require("fs");
const path = require("path");

const PROJECT_ROOT = process.cwd();
const ROUTE_GLOBS = [
  "server/routers/**/*.ts",
  "server/routes/**/*.ts"
];
const BARRIER_NAMES = ["requireAuth", "protectedProcedure", "loopStationAuth"];

function findBarrierInText(text) {
  return BARRIER_NAMES.some(name => text.includes(name));
}

function checkBarriers() {
  const project = new Project({ tsConfigFilePath: "tsconfig.json" });
  let errors = [];
  for (const pattern of ROUTE_GLOBS) {
    for (const file of project.getFileSystem().globSync([pattern], { cwd: PROJECT_ROOT })) {
      const full = path.resolve(PROJECT_ROOT, file);
      const src = fs.readFileSync(full, "utf8");
      if (findBarrierInText(src)) continue;
      // Now, deeper: Find if any exported router/route has NO barrier
      const sourceFile = project.addSourceFileAtPath(full);
      let unguarded = [];
      sourceFile.forEachChild(node => {
        if (node.getKindName() === "VariableStatement") {
          const decls = node.getDeclarations();
          for (const decl of decls) {
            const isRouter = decl.getType().getText().includes("Router");
            if (!isRouter) continue;
            const txt = decl.getText();
            if (!findBarrierInText(txt)) {
              unguarded.push(decl.getName());
            }
          }
        }
      });
      if (unguarded.length) {
        errors.push({ file, unguarded });
      }
    }
  }
  if (errors.length) {
    errors.forEach(e => {
      console.error(
        `ERROR: ${e.file} exported unguarded route(s): ${e.unguarded.join(", ")}`
      );
    });
    process.exit(1);
  } else {
    console.log("PASS: All routes/routers have expected barrier guards.");
    process.exit(0);
  }
}

checkBarriers();