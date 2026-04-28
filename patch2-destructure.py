import sys
path = "client/src/features/loopstation/LoopStation505.tsx"
src = open(path).read()
OLD = "    midiInputEnabled, midiInputs, toggleMidiInput,\n    scenes,"
NEW = "    midiInputEnabled, midiInputs, toggleMidiInput, toggleMidiClock,\n    scenes,"
count = src.count(OLD)
if count != 1:
    sys.exit(f"ERROR: anchor matched {count} times")
open(path, "w").write(src.replace(OLD, NEW, 1))
print("Destructure patched.")
