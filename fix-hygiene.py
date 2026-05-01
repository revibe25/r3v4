import os, re, shutil, datetime
stamp = datetime.datetime.now().strftime('%Y%m%d_%H%M%S')

def backup(path):
    bpath = path + f".bak-{stamp}"
    shutil.copyfile(path, bpath)

def fix_type_imports(path):
    lines = open(path).readlines()
    new = []
    changed = False
    for l in lines:
        if l.strip().startswith("import {") and "type " not in l:
            # Possibly only types
            if re.search(r"(from\s+['\"][^\"]+\")", l):
                # Conservative: always fix
                new.append(l.replace("import {", "import type {"))
                changed = True
                continue
        new.append(l)
    if changed:
        backup(path)
        open(path, "w").writelines(new)

def fix_unused_vars(path, varnames):
    lines = open(path).readlines()
    changed = False
    for i, l in enumerate(lines):
        for v in varnames:
            reg = "\\b" + v + "\\b"
            if re.search(f"(const|let|var) {reg}", l):
                lines[i] = l.replace(f"{v}", f"_{v}", 1)
                changed = True
    if changed:
        backup(path)
        open(path, "w").writelines(lines)

# EXAMPLE usage for your project
fix_type_imports("shared/types/project.types.ts")
fix_type_imports("shared/dist/types/project.types.d.ts")
fix_unused_vars("shared/schema-daw-patch.ts", ["integer", "real"])
fix_unused_vars("shared/schema-subscription.ts", ["integer", "relations"])
