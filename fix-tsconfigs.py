#!/usr/bin/env python3
import json, os, shutil, sys

CLIENT = os.path.expanduser("~/Stable/client")

FILES = {
    "tsconfig.json": {
        "compilerOptions": {
            "ignoreDeprecations": "6.0",
            "target": "ESNext",
            "module": "ESNext",
            "moduleResolution": "bundler",
            "jsx": "react-jsx",
            "lib": ["DOM", "DOM.Iterable", "ESNext"],
            "strict": True,
            "baseUrl": ".",
            "paths": {
                "@/*":       ["src/*"],
                "@shared/*": ["../shared/*"]
            },
            "esModuleInterop": True,
            "allowSyntheticDefaultImports": True,
            "forceConsistentCasingInFileNames": True,
            "skipLibCheck": True,
            "resolveJsonModule": True,
            "isolatedModules": True,
            "noEmit": True,
            "types": ["node"],
            "noImplicitAny": False
        },
        "include": ["src", "config"],
        "exclude": [
            "src/setup.ts",
            "src/components/beat-intro (1).tsx",
            "src/index.ts",
            "src/audio/fx/vst-processor.worklet.ts",
            "src/audio/recorder/recorder-worklet.ts",
            "src/worklets/instrument-processor.worklet.ts"
        ]
    },
    "tsconfig.node.json": {
        "compilerOptions": {
            "target": "ESNext",
            "module": "ESNext",
            "moduleResolution": "bundler",
            "allowSyntheticDefaultImports": True,
            "esModuleInterop": True,
            "strict": True,
            "skipLibCheck": True,
            "noEmit": True,
            "types": ["node"]
        },
        "include": ["vite.config.ts", "config/**/*.ts"]
    },
    "tsconfig.worklet.json": {
        "compilerOptions": {
            "target": "ESNext",
            "module": "ESNext",
            "moduleResolution": "bundler",
            "lib": ["WebWorker", "ESNext"],
            "strict": True,
            "skipLibCheck": True,
            "noEmit": True,
            "isolatedModules": True
        },
        "include": [
            "src/audio/fx/vst-processor.worklet.ts",
            "src/audio/recorder/recorder-worklet.ts",
            "src/worklets/instrument-processor.worklet.ts"
        ]
    }
}

backed_up = []

def rollback():
    print("\n[ROLLBACK] Restoring all backups...", file=sys.stderr)
    for (orig, bak) in backed_up:
        if os.path.exists(bak):
            shutil.copy2(bak, orig)
            print(f"  restored: {orig}", file=sys.stderr)

def die(msg):
    print(f"[FATAL] {msg}", file=sys.stderr)
    rollback()
    sys.exit(1)

if not os.path.isdir(CLIENT):
    die(f"Client directory not found: {CLIENT}")

for filename, content in FILES.items():
    orig = os.path.join(CLIENT, filename)
    bak  = orig + ".bak"

    try:
        if os.path.exists(orig):
            shutil.copy2(orig, bak)
        else:
            with open(bak, "w", encoding="utf-8") as f:
                pass
        backed_up.append((orig, bak))
        print(f"[BAK]   {bak}")
    except OSError as e:
        die(f"Backup failed for {filename}: {e}")

    try:
        text = json.dumps(content, indent=2) + "\n"
        with open(orig, "w", encoding="utf-8") as f:
            f.write(text)
        print(f"[WRITE] {orig}")
    except OSError as e:
        die(f"Write failed for {filename}: {e}")

    try:
        with open(orig, "r", encoding="utf-8") as f:
            parsed = json.load(f)
        if "compilerOptions" not in parsed:
            die(f"Verification failed: compilerOptions missing in {filename}")
        if "include" not in parsed:
            die(f"Verification failed: include missing in {filename}")
        if not parsed["include"]:
            die(f"Verification failed: include is empty in {filename}")
        print(f"[OK]    {filename} — JSON valid, structure verified")
    except json.JSONDecodeError as e:
        die(f"Post-write JSON parse failed for {filename}: {e}")

print("\n[DONE] All three tsconfig files patched and verified.")
