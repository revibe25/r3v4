import { Project } from "ts-morph";

const project = new Project({
  tsConfigFilePath: "tsconfig.json",
});

const files = project.getSourceFiles("client/src/**/*.{ts,tsx}");

let violations: string[] = [];

for (const file of files) {
  const text = file.getFullText();

  // ❌ Block raw hex colors
  const hexMatches = text.match(/#[0-9a-fA-F]{3,8}/g);
  if (hexMatches) {
    violations.push(
      `${file.getFilePath()} contains raw hex colors: ${hexMatches.join(", ")}`
    );
  }

  // ❌ Block direct CSS var usage outside theme/tokens
  const varMatches = text.match(/var\(--color-[^)]+\)/g);
  if (varMatches && !file.getFilePath().includes("design-tokens")) {
    violations.push(
      `${file.getFilePath()} contains raw CSS variables: ${varMatches.join(", ")}`
    );
  }

  // ❌ Block Tailwind raw color usage
  const tailwindMatches = text.match(
    /(bg-|text-|border-)(black|white|gray|red|green|blue)-\d+/g
  );

  if (tailwindMatches) {
    violations.push(
      `${file.getFilePath()} contains raw Tailwind colors: ${tailwindMatches.join(", ")}`
    );
  }
}

if (violations.length > 0) {
  console.error("\n❌ DESIGN TOKEN VIOLATIONS DETECTED:\n");
  violations.forEach(v => console.error(" - " + v));
  process.exit(1);
}

console.log("✅ Design token compiler passed")
