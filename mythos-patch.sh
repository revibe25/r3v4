#!/usr/bin/env bash
# mythos-patch.sh
# Mythic PRD/CLAUDE/Skills.md drift eliminator — see https://github.com/Berryboy93/r3v4

set -euo pipefail
IFS=$'\n\t'

DRY_RUN=1
[ "${1-}" = "--apply" ] && DRY_RUN=0

BACKUP_DIR=".mythos_backup_$(date +%Y%m%d_%H%M%S)"

function header() {
  echo
  echo "================================================="
  echo "MYTHOS PATCH – $1"
  echo "================================================="
}

function backup() {
  [ "$DRY_RUN" = "0" ] && [ -f "$1" ] && mkdir -p "$BACKUP_DIR" && cp "$1" "$BACKUP_DIR/"
}

function safe_patch() {
  # Usage: safe_patch <filename> 'sed_script'
  local file="$1"
  local script="$2"
  if [ ! -f "$file" ]; then echo "  SKIP: $file (not found)"; return; fi
  if [ "$DRY_RUN" = "1" ]; then
    echo "    --- $file: (dry run diff) ---"
    diff -u "$file" <(sed "$script" "$file") || true
  else
    backup "$file"
    local tmpfile
    tmpfile="$(mktemp)"
    sed "$script" "$file" > "$tmpfile"
    mv "$tmpfile" "$file"
    echo "    --- $file: PATCHED (backup in $BACKUP_DIR/) ---"
  fi
}

header "1. Zustand auth-store.ts (isHydrated guard, idempotent hydration)"
AUTH_STORE=client/src/stores/auth-store.ts
if grep -q "isHydrated" "$AUTH_STORE" 2>/dev/null; then
  echo "  Already patched."
else
  safe_patch "$AUTH_STORE" '/^type AuthState / a\
  isHydrated: boolean
/^export const useAuthStore /,/)$/ {
  /user: null,/ a\
    isHydrated: false,
  /hydrateFromToken: async/ {
    n; a\
    // prevent double hydration\
    if (get().isHydrated) return
  }
  s/set({ user: null })/set({ user: null, isHydrated: true })/g
  s/set({ user })/set({ user, isHydrated: true })/g
}'
fi

header "2. ProtectedRoute.tsx (move hydrateFromToken to effect, block until hydrated)"
PROTECTED=client/src/components/ProtectedRoute.tsx
if grep -q 'isHydrated' "$PROTECTED" 2>/dev/null; then
  echo "  Already patched."
else
  safe_patch "$PROTECTED" '/const { user, hydrateFromToken / s/const { user, hydrateFromToken /const { user, isHydrated, hydrateFromToken /
/function ProtectedRoute/,/^}/ {
  /hydrateFromToken()/d
  /{ children }: {/a\
  useEffect(() => {\
    hydrateFromToken()\
  }, []);\
\
  if (!isHydrated) {\
    return null;\
  }\
  if (!user) {\
    return <Navigate to=\"/login\" replace />;\
  }
}
'
fi

header "3. useSubscription.ts (gate API on user+isHydrated)"
USE_SUBS=client/src/hooks/useSubscription.ts
if [ -f "$USE_SUBS" ]; then
  if grep -q "isHydrated" "$USE_SUBS"; then
    echo "  Already patched."
  else
    safe_patch "$USE_SUBS" '
s/const { user }/const { user, isHydrated }/
s/useEffect(() => {/useEffect(() => {\
  if (!isHydrated || !user) return/
'
  fi
fi

header "4. useTimeSavings.ts (gate polling on sessionId + user + isActive + isHydrated)"
USE_MET=client/src/hooks/useTimeSavings.ts
if [ -f "$USE_MET" ]; then
  if grep -q "isHydrated" "$USE_MET"; then
    echo "  Already patched."
  else
    safe_patch "$USE_MET" '
s/const { user }/const { user, isHydrated }/
s/const { sessionId }/const { sessionId, isActive }/
/useEffect(() => {/a\
  if (!isHydrated || !user || !isActive || !sessionId) return
'
  fi
fi

header "5. tRPC client (ensure credentials: 'include')"
TRPC=client/src/lib/trpc.ts
if [ -f "$TRPC" ] && grep -q "credentials: 'include'" "$TRPC"; then
  echo "  Already patched."
elif [ -f "$TRPC" ]; then
  safe_patch "$TRPC" '/httpBatchLink({/{n
/  url: /a\
      fetch(url, options) {\
        return fetch(url, {\
          ...options,\
          credentials: '\''include'\'',\
        })\
      },
'
fi

header "6. main.tsx (preload hydration)"
MAIN=client/src/main.tsx
if [ -f "$MAIN" ] && grep -q 'hydrateFromToken' "$MAIN"; then
  echo "  Already patched."
elif [ -f "$MAIN" ]; then
  safe_patch "$MAIN" '/^import /a\
import { useAuthStore } from "./stores/auth-store"
1a\
useAuthStore.getState().hydrateFromToken()
'
fi

header "7. session-store.ts (Zustand session management)"
SESSION=client/src/stores/session-store.ts
if [ -f "$SESSION" ] && grep -q 'sessionId' "$SESSION"; then
  echo "  Already exists."
else
  cat > "$SESSION".mythos <<EOF
import create from "zustand"

export type SessionState = {
  sessionId: string | null
  isActive: boolean
  startSession: () => Promise<void>
  endSession: () => Promise<void>
}

export const useSessionStore = create<SessionState>((set, get) => ({
  sessionId: null,
  isActive: false,
  startSession: async () => {
    if (get().isActive) return
    const res = await fetch('/api/trpc/sessions.startSession', {
      method: 'POST',
      credentials: 'include',
    })
    const data = await res.json()
    set({
      sessionId: data.result.data.sessionId,
      isActive: true,
    })
  },
  endSession: async () => {
    const { sessionId } = get()
    if (!sessionId) return
    await fetch('/api/trpc/sessions.endSession', {
      method: 'POST',
      credentials: 'include',
      body: JSON.stringify({ sessionId }),
    })
    set({
      sessionId: null,
      isActive: false,
    })
  },
}))
EOF
  if [ "$DRY_RUN" = "1" ]; then
    diff /dev/null "$SESSION".mythos || true
  else
    backup "$SESSION"
    mv "$SESSION".mythos "$SESSION"
    echo "  session-store.ts created."
  fi
fi

header "8. session-metrics-store.ts (central metrics Zustand store)"
METRICS=client/src/stores/session-metrics-store.ts
cat > "$METRICS".mythos <<EOF
import create from "zustand"

export type SessionMetricsState = {
  metrics: {
    aiActionsCount: number
    acceptanceRate: number
    timeSavedMs: number
  } | null
  setMetrics: (metrics: SessionMetricsState['metrics']) => void
  reset: () => void
}

export const useSessionMetricsStore = create<SessionMetricsState>((set) => ({
  metrics: null,
  setMetrics: (metrics) => set({ metrics }),
  reset: () => set({ metrics: null }),
}))
EOF
if [ "$DRY_RUN" = "1" ]; then
  diff /dev/null "$METRICS".mythos || true
else
  mv "$METRICS".mythos "$METRICS"
  echo "  session-metrics-store.ts written."
fi

header "9. useSessionMetricsSync.ts (hook for polling metrics)"
SYNC=client/src/hooks/useSessionMetricsSync.ts
cat > "$SYNC".mythos <<EOF
import { useSessionStore } from '../stores/session-store'
import { useSessionMetricsStore } from '../stores/session-metrics-store'
import { useEffect } from 'react'

export function useSessionMetricsSync() {
  const { sessionId, isActive } = useSessionStore()
  const { setMetrics } = useSessionMetricsStore()
  useEffect(() => {
    if (!sessionId || !isActive) return
    let cancelled = false
    const tick = async () => {
      try {
        const res = await fetch('/api/trpc/sessionMetrics.getBySessionId', {
          method: 'POST',
          credentials: 'include',
          body: JSON.stringify({ sessionId }),
        })
        const json = await res.json()
        if (!cancelled) {
          setMetrics(json.result.data)
        }
      } catch {}
    }
    tick()
    const interval = setInterval(tick, 2000)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [sessionId, isActive])
}
EOF
if [ "$DRY_RUN" = "1" ]; then
  diff /dev/null "$SYNC".mythos || true
else
  mv "$SYNC".mythos "$SYNC"
  echo "  useSessionMetricsSync.ts written."
fi

header "10. Guidance for SessionChip.tsx and SessionSummaryPanel.tsx"
echo "  --> PATCHES for SessionChip/SessionSummaryPanel are safest applied by hand:"
echo "      - Both should read from useSessionMetricsStore() and useSessionStore() only"
echo "      - SessionChip: shows ● Live if isActive, displays metrics?.aiActionsCount"
echo "      - SummaryPanel: loading if !metrics or no actions, rounds percent, min saved"

header "11. Server: session-metrics.service.ts (add recordAIDecisionMetric)"
SVC=server/services/session-metrics.service.ts
if [ -f "$SVC" ] && grep -q 'recordAIDecisionMetric' "$SVC"; then
  echo "  Already present."
elif [ -f "$SVC" ]; then
  cat >> "$SVC".mythos <<EOF

export async function recordAIDecisionMetric({
  sessionId,
  outcome,
  timeSavedMsDelta = 0,
}: {
  sessionId: string
  outcome: 'accepted' | 'rejected' | 'ignored'
  timeSavedMsDelta?: number
}) {
  const existing = await db.query.sessionMetrics.findFirst({
    where: eq(sessionMetrics.sessionId, sessionId),
  })
  const aiActionsCount = (existing?.aiActionsCount ?? 0) + 1
  const acceptedCount = (existing?.acceptedCount ?? 0) + (outcome === 'accepted' ? 1 : 0)
  const acceptanceRate = aiActionsCount === 0 ? 0 : acceptedCount / aiActionsCount
  const timeSavedMs = (existing?.timeSavedMs ?? 0) + timeSavedMsDelta
  if (!existing) {
    await db.insert(sessionMetrics).values({
      sessionId,
      aiActionsCount: 1,
      acceptedCount,
      acceptanceRate,
      timeSavedMs,
    })
    return
  }
  await db
    .update(sessionMetrics)
    .set({
      aiActionsCount,
      acceptedCount,
      acceptanceRate,
      timeSavedMs,
    })
    .where(eq(sessionMetrics.sessionId, sessionId))
}
EOF
  if [ "$DRY_RUN" = "1" ]; then
    tail -n 25 "$SVC".mythos
  else
    backup "$SVC"
    cat "$SVC".mythos >> "$SVC"
    rm "$SVC".mythos
    echo "  recordAIDecisionMetric appended to $SVC"
  fi
fi

header "COMPLETE"
if [ "$DRY_RUN" = "1" ]; then
  echo
  echo "MYTHOS PATCH DRY RUN: No files changed."
  echo "Review diffs above. If correct, re-run:  bash $0 --apply"
else
  echo
  echo "MYTHOS PATCH APPLIED! All backup files in $BACKUP_DIR"
  echo "Next:"
  echo "  - Run: pnpm tsc --noEmit"
  echo "  - Run: pnpm test"
  echo "  - Manually review session-related UI to confirm PRD compliance."
fi
