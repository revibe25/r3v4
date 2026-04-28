import sys
path = "client/src/features/loopstation/hooks/useLoopStation505.ts"
src = open(path).read()
OLD = "    toggleMidiInput,\n    scenes,"
NEW = "    toggleMidiInput,\n    toggleMidiClock,\n    scenes,"
count = src.count(OLD)
if count != 1:
    sys.exit(f"ERROR: anchor matched {count} times")
open(path, "w").write(src.replace(OLD, NEW, 1))
print("Hook return patched.")
