import sys
path = "client/src/features/loopstation/hooks/useLoopStation505.ts"
src = open(path).read()

OLD_CB = (
    "  }, []);\n"
    "\n"
    "  const setDelay = useCallback((time: string, feedback: number) => {"
)
NEW_CB = (
    "  }, []);\n"
    "  const setFilterType = useCallback((type: BiquadFilterType) => {\n"
    "    getLoopEngine().setFilterType(type);\n"
    "    setFX(prev => ({ ...prev, filterType: type }));\n"
    "  }, []);\n"
    "\n"
    "  const setDelay = useCallback((time: string, feedback: number) => {"
)
count = src.count(OLD_CB)
if count != 1:
    sys.exit(f"ERROR: anchor matched {count} times")
src = src.replace(OLD_CB, NEW_CB, 1)

OLD_RET = "    setFilter,\n    setFilterType,\n    setDelay,"
NEW_RET = "    setFilter,\n    setFilterType,\n    setDelay,"
# Return already has setFilterType from patch5, skip if already present
if OLD_RET in src:
    print("Return already patched, skipping.")
else:
    old2 = "    setFilter,\n    setDelay,"
    count2 = src.count(old2)
    if count2 != 1:
        sys.exit(f"ERROR: return anchor matched {count2} times")
    src = src.replace(old2, "    setFilter,\n    setFilterType,\n    setDelay,", 1)

open(path, "w").write(src)
print("Hook setFilterType patched.")
