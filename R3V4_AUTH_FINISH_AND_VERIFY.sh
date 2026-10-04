#!/usr/bin/env bash
set -Eeuo pipefail

# R3V4 AUTH FINISH + VERIFY
#
# Purpose:
#   Finish the auth integration from the 2026-09-23 checkpoint without
#   replacing the canonical R3V4 auth architecture with the generic scaffold.
#
# Safety model:
#   - Read current state first.
#   - Refuse ambiguous edits.
#   - Timestamp backups before any mutation.
#   - Only patch exact, verified anchors.
#   - Never touch secrets.
#   - Never remove the root-level auth scaffolds automatically.
#
# Usage:
#   bash R3V4_AUTH_FINISH_AND_VERIFY.sh
#
# Optional:
#   APPLY=1 bash R3V4_AUTH_FINISH_AND_VERIFY.sh
#
# APPLY=1 performs the surgical code reconciliation. Without APPLY=1 the
# script performs the complete read-only audit and prints the exact changes
# it would make.

ROOT="$(git rev-parse --show-toplevel 2>/dev/null || true)"
if [[ -z "$ROOT" ]]; then
  echo "ERROR: not inside a git repository" >&2
  exit 1
fi
cd "$ROOT"

STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP_DIR="$ROOT/.auth-finish-backup-$STAMP"
REPORT="$ROOT/R3V4_AUTH_FINISH_REPORT-$STAMP.md"
APPLY="${APPLY:-0}"

red=$'\033[0;31m'; green=$'\033[0;32m'; yellow=$'\033[1;33m'; cyan=$'\033[0;36m'; reset=$'\033[0m'

say()  { printf '%s\n' "$*"; }
ok()   { printf '%b✓%b %s\n' "$green" "$reset" "$*"; }
warn() { printf '%b!%b %s\n' "$yellow" "$reset" "$*"; }
fail() { printf '%b✗%b %s\n' "$red" "$reset" "$*" >&2; exit 1; }

for f in \
  server/middleware/auth.ts \
  server/routes.ts \
  server/routes/auth.ts \
  server/trpc.ts \
  index.ts \
  client/src/App.tsx \
  client/src/hooks/authStore.ts \
  client/src/components/ProtectedRoute.tsx \
  client/src/pages/login.tsx; do
  [[ -f "$f" ]] || fail "Required canonical file missing: $f"
done

{
  echo "# R3V4 Auth Finish + Verify Report"
  echo
  echo "Generated: $(date --iso-8601=seconds)"
  echo "Repository: $ROOT"
  echo "Apply mode: $APPLY"
  echo
} > "$REPORT"

say "============================================================"
say "R3V4 AUTH FINISH + VERIFY"
say "============================================================"
say "ROOT:   $ROOT"
say "MODE:   $([[ "$APPLY" == 1 ]] && echo APPLY || echo READ-ONLY)"
say "REPORT: $REPORT"
say

say "===== 1. REPOSITORY STATE ====="
git status --short --branch | tee -a "$REPORT"
say
say "===== 2. TODAY'S AUTH FILES ====="
find . -type f \
  ! -path './.git/*' ! -path './node_modules/*' \
  \( -path './server/middleware/auth.ts*' \
     -o -path './server/routes/auth.ts' \
     -o -path './client/public/auth.html' \
     -o -name 'authService.ts' \
     -o -name 'useAuth.ts' \
     -o -name 'ProtectedRoute.tsx' \
     -o -name 'AuthDebugger.tsx' \
     -o -name 'App.tsx.example' \
  \) \
  -printf '%TY-%Tm-%Td %TH:%TM:%TS %p\n' | sort -r | tee -a "$REPORT"
say

AUTH="server/middleware/auth.ts"
ROUTES="server/routes.ts"
INDEX="index.ts"
TRPC="server/trpc.ts"
AUTHSTORE="client/src/hooks/authStore.ts"
LOGIN="client/src/pages/login.tsx"
APP="client/src/App.tsx"

say "===== 3. AUTH MIDDLEWARE ANALYSIS ====="
printf '%s\n' '--- exports / trpcAuth ---' | tee -a "$REPORT"
rg -n "export function optionalAuth|export function requireAuth|export function requireUser|export function trpcAuth|export const trpcAuth" "$AUTH" | tee -a "$REPORT" || true
printf '%s\n' '--- middleware mounts ---' | tee -a "$REPORT"
rg -n "app\.use\((optionalAuth|trpcAuth)\)" "$INDEX" "$ROUTES" 2>/dev/null | tee -a "$REPORT" || true

HAS_OPTIONAL=0
HAS_BAD_TRPCAUTH=0
HAS_GOOD_TRPCAUTH=0
rg -q 'export function optionalAuth\(' "$AUTH" && HAS_OPTIONAL=1
if rg -q $'export function trpcAuth\(req: Request\) \{[[:space:]]*\n[[:space:]]*return req\.user;[[:space:]]*\n\}' "$AUTH"; then
  HAS_BAD_TRPCAUTH=1
fi
if rg -q 'export function trpcAuth\(req: Request, _res: Response, next: NextFunction\)' "$AUTH"; then
  HAS_GOOD_TRPCAUTH=1
fi
if rg -q 'export const trpcAuth = optionalAuth;' "$AUTH"; then
  HAS_GOOD_TRPCAUTH=1
fi

[[ "$HAS_OPTIONAL" -eq 1 ]] || fail "optionalAuth() is missing from $AUTH"
if [[ "$HAS_BAD_TRPCAUTH" -eq 1 ]]; then
  warn "Canonical source contains the known broken trpcAuth helper (return req.user)."
elif [[ "$HAS_GOOD_TRPCAUTH" -eq 1 ]]; then
  ok "trpcAuth is already a callable Express middleware/alias."
else
  fail "trpcAuth form is ambiguous; refusing automatic modification. Inspect $AUTH"
fi

say "===== 4. ORDER OF GLOBAL AUTH MOUNT ====="
INDEX_MOUNT_LINE="$(rg -n 'app\.use\(trpcAuth\);' "$INDEX" | head -n1 | cut -d: -f1 || true)"
TRPC_MOUNT_LINE="$(rg -n "app\.use\('/api/trpc'" "$INDEX" | head -n1 | cut -d: -f1 || true)"
REGISTER_LINE="$(rg -n 'await registerRoutes\(httpServer, app\);' "$INDEX" | head -n1 | cut -d: -f1 || true)"
[[ -n "$INDEX_MOUNT_LINE" ]] || fail "Global app.use(trpcAuth) not found in index.ts"
[[ -n "$TRPC_MOUNT_LINE" ]] || fail "tRPC mount not found in index.ts"
[[ -n "$REGISTER_LINE" ]] || fail "registerRoutes() call not found in index.ts"
if (( INDEX_MOUNT_LINE < TRPC_MOUNT_LINE && TRPC_MOUNT_LINE < REGISTER_LINE )); then
  ok "Global auth mount precedes tRPC and registerRoutes."
else
  fail "Global auth ordering is not proven safe (mount=$INDEX_MOUNT_LINE trpc=$TRPC_MOUNT_LINE routes=$REGISTER_LINE)"
fi

echo "Global auth mount line: $INDEX_MOUNT_LINE" >> "$REPORT"
echo "tRPC mount line: $TRPC_MOUNT_LINE" >> "$REPORT"
echo "registerRoutes line: $REGISTER_LINE" >> "$REPORT"

say "===== 5. DUPLICATE ROUTE-MODULE AUTH MOUNT ====="
ROUTES_AUTH_MOUNT_COUNT="$(rg -c 'app\.use\(trpcAuth\);' "$ROUTES" 2>/dev/null || true)"
if [[ -z "$ROUTES_AUTH_MOUNT_COUNT" ]]; then ROUTES_AUTH_MOUNT_COUNT=0; fi
printf 'server/routes.ts trpcAuth mounts: %s\n' "$ROUTES_AUTH_MOUNT_COUNT" | tee -a "$REPORT"

say "===== 6. CANONICAL CLIENT AUTH CONTRACT ====="
rg -n \
  "useAuthStore|/api/auth/login|initAuth|selectIsAuthed|setLocation\('/instrument'\)|Redirect to=\"/auth\"" \
  "$AUTHSTORE" "$LOGIN" "$APP" "$ROOT/client/src/components/ProtectedRoute.tsx" | tee -a "$REPORT" || true

say "===== 7. ACTUAL SERVER AUTH API ====="
rg -n 'router\.(post|get)\("/(register|login|logout|me|change-password|refresh)' \
  "$ROOT/server/routes/auth.ts" | tee -a "$REPORT" || true

say "===== 8. GENERIC AUTH SCAFFOLD DETECTION ====="
for f in authService.ts useAuth.ts ProtectedRoute.tsx AuthDebugger.tsx App.tsx.example; do
  if [[ -f "$f" ]]; then
    warn "Root-level scaffold remains present: $f"
    echo "- Root scaffold present: $f" >> "$REPORT"
  fi
done
if [[ -f client/public/auth.html ]]; then
  warn "client/public/auth.html is present. It remains a standalone prototype unless explicitly wired."
  echo "- client/public/auth.html present as standalone artifact" >> "$REPORT"
fi

say "===== 9. STALE GENERIC CONTRACT DETECTION ====="
STALE=0
if rg -n 'AuthProvider|react-router|React Router|/auth/refresh|r3_token_expiry|r3_refresh_token|REACT_APP_API_URL' \
  AUTH_TESTING_CHECKLIST.md INTEGRATION_GUIDE.md README_AUTH_INTEGRATION.md \
  2>/dev/null | tee -a "$REPORT"; then
  STALE=1
fi
if [[ "$STALE" -eq 1 ]]; then
  warn "Generic scaffold contract references remain in newly-created documentation."
fi

say "===== 10. GIT DIFF CHECK BEFORE PATCH ====="
git diff --check | tee -a "$REPORT"

if [[ "$APPLY" != 1 ]]; then
  say
  say "READ-ONLY COMPLETE"
  say
  if [[ "$HAS_BAD_TRPCAUTH" -eq 1 ]]; then
    say "Would patch: server/middleware/auth.ts trpcAuth -> optionalAuth alias"
  fi
  if (( ROUTES_AUTH_MOUNT_COUNT > 0 )); then
    say "Would remove: duplicate app.use(trpcAuth) from server/routes.ts"
  fi
  say "Would NOT replace canonical R3V4 authStore/login/ProtectedRoute."
  say "Would NOT delete root-level auth scaffolds automatically."
  say
  say "Run: APPLY=1 bash R3V4_AUTH_FINISH_AND_VERIFY.sh"
  say "Report: $REPORT"
  exit 0
fi

say "===== 11. BACKUP ====="
mkdir -p "$BACKUP_DIR"
for f in "$AUTH" "$ROUTES" "$INDEX" "$TRPC" "$AUTHSTORE" "$LOGIN" "$APP"; do
  cp -a "$f" "$BACKUP_DIR/$(echo "$f" | tr '/' '__')"
done
cp -a "$REPORT" "$BACKUP_DIR/"
ok "Backup created: $BACKUP_DIR"

git diff -- "$AUTH" "$ROUTES" "$INDEX" "$TRPC" "$AUTHSTORE" "$LOGIN" "$APP" > "$BACKUP_DIR/prepatch.git-diff" || true

say "===== 12. SURGICAL PATCH ====="
python3 - "$AUTH" "$ROUTES" <<'PY'
from pathlib import Path
import re, sys

auth_path = Path(sys.argv[1])
routes_path = Path(sys.argv[2])

auth = auth_path.read_text()
routes = routes_path.read_text()

bad = re.compile(r'''export function trpcAuth\(req: Request\)\s*\{\s*return req\.user;\s*\}''')
if bad.search(auth):
    replacement = 'export const trpcAuth = optionalAuth;'
    auth2, n = bad.subn(replacement, auth, count=1)
    if n != 1:
        raise SystemExit('ABORT: expected exactly one broken trpcAuth helper')
    auth_path.write_text(auth2)

# Remove only the duplicate global middleware mount in routes.ts.
# registerRoutes() is invoked after index.ts globally mounts auth.
mounts = list(re.finditer(r'^\s*app\.use\(trpcAuth\);\s*$', routes, flags=re.M))
if len(mounts) > 1:
    raise SystemExit('ABORT: more than one trpcAuth mount in server/routes.ts')
if len(mounts) == 1:
    routes = routes[:mounts[0].start()] + routes[mounts[0].end():]
    # Only change the import if it is the exact known two-name import.
    routes = routes.replace('import { trpcAuth, requireUser } from "./middleware/auth";',
                            'import { requireUser } from "./middleware/auth";', 1)
    routes = routes.replace("import { trpcAuth, requireUser } from './middleware/auth';",
                            "import { requireUser } from './middleware/auth';", 1)
    routes_path.write_text(routes)
PY

ok "Surgical middleware reconciliation applied."

say "===== 13. POST-PATCH STATIC ASSERTIONS ====="
rg -n 'export const trpcAuth = optionalAuth;' "$AUTH" | tee -a "$REPORT" >/dev/null
! rg -q '^\s*app\.use\(trpcAuth\);\s*$' "$ROUTES" || fail "Duplicate routes.ts trpcAuth mount still present"
rg -q '^\s*app\.use\(trpcAuth\);\s*$' "$INDEX" || fail "index.ts global trpcAuth mount missing"
rg -q 'app\.use\('\''/api/trpc' "$INDEX" || fail "tRPC mount missing"
rg -q 'await registerRoutes\(httpServer, app\);' "$INDEX" || fail "registerRoutes missing"
ok "Middleware assertions passed."

say "===== 14. CANONICAL AUTH PATH ASSERTIONS ====="
rg -q "'/api/auth/login'" "$AUTHSTORE" || fail "Canonical authStore login endpoint missing"
rg -q 'await useAuthStore\.getState\(\)\.login' "$LOGIN" || fail "Canonical login page no longer calls authStore"
rg -q "setLocation\('/instrument'\)" "$LOGIN" || fail "Canonical login redirect to /instrument missing"
rg -q '<Route path="/auth"' "$APP" || fail "Canonical /auth route missing"
rg -q 'ProtectedRoute' "$ROOT/client/src/components/ProtectedRoute.tsx" || fail "Canonical ProtectedRoute missing"
ok "Client auth contract assertions passed."

say "===== 15. DIFF QUALITY ====="
git diff --check | tee -a "$REPORT"

git diff --stat | tee -a "$REPORT"

git diff -- "$AUTH" "$ROUTES" | tee -a "$REPORT"

say "===== 16. TYPECHECK ====="
if pnpm typecheck 2>&1 | tee -a "$REPORT"; then
  ok "pnpm typecheck passed"
else
  warn "pnpm typecheck failed — preserving diagnostics in $REPORT"
fi

say "===== 17. VERIFY SCRIPT ====="
if pnpm verify 2>&1 | tee -a "$REPORT"; then
  ok "pnpm verify passed"
else
  warn "pnpm verify failed — preserving diagnostics in $REPORT"
fi

say "===== 18. BUILD ====="
if pnpm build 2>&1 | tee -a "$REPORT"; then
  ok "pnpm build passed"
else
  warn "pnpm build failed — preserving diagnostics in $REPORT"
fi

say "===== 19. FINAL STATE ====="
git status --short --branch | tee -a "$REPORT"

echo >> "$REPORT"
echo "## Decision" >> "$REPORT"
echo >> "$REPORT"
echo "The generic root-level auth package was not substituted for the canonical R3V4 auth stack." >> "$REPORT"
echo "The code reconciliation only makes trpcAuth callable as Express middleware/alias and removes the duplicate global mount from server/routes.ts." >> "$REPORT"
echo "Browser/runtime authentication remains a verification step and is not marked passed merely from static checks." >> "$REPORT"

git diff --check >/dev/null || warn "Final git diff --check reported whitespace errors"

say
say "============================================================"
say "AUTH FINISH SCRIPT COMPLETE"
say "============================================================"
say "Backup: $BACKUP_DIR"
say "Report: $REPORT"
say ""
say "IMPORTANT: review git diff before committing."
