import sys
from pathlib import Path

missing = []
for f in sys.argv[1:]:
    if not Path(f).exists():
        print(f"::error file={f}::Required document missing: {f}")
        missing.append(f)
if missing:
    sys.exit(1)
print("All referenced artifacts exist. ✅")