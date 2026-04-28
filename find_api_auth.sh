#!/bin/bash
# find_api_auth.sh - Locate all auth middleware/guards for time-savings metrics endpoints

echo "== Searching for '/metrics/time-savings' route definitions =="
grep -Einr --include="*.ts" --include="*.js" 'metrics|time-?savings|internal' ./server ./src ./app 2>/dev/null

echo
echo "== Searching for auth middleware/guards/decorators in handlers =="
grep -Einr --include="*.ts" --include="*.js" 'require.auth|requireAuth|authMiddleware|isAuthenticated|protect|guard|passport|jwt|session' ./server ./src ./app 2>/dev/null | grep -Ei 'function|export|const|let|class|use|router|controller|middleware|guard|auth'

echo
echo "== Searching for @UseGuards, @Auth, JwtGuard, or similar decorators =="
grep -Ern --include="*.ts" --include="*.js" '@UseGuards|@Auth|JwtGuard|@Passport|@Roles|@Session' ./server ./src ./app 2>/dev/null

echo
echo "== Searching for router-level authentication (Express-style) =="
grep -Ern --include="*.ts" --include="*.js" \
  'router\.(use|get|post|put|patch|delete)[[:space:]]*\([[:space:]]*["'"'"']/[a-zA-Z0-9/_-]+["'"'"'],[[:space:]]*[a-zA-Z0-9_]+' ./server ./src ./app 2>/dev/null

echo
echo "== Searching for custom middleware on /metrics/time-savings (with code context) =="
grep -Einr --include="*.ts" --include="*.js" 'metrics|time-savings' ./server/routes ./src/routes ./app/routes 2>/dev/null | while IFS=: read -r file lineno rest; do
  [ -f "$file" ] || continue
  echo
  echo "----- $file (around line $lineno) -----"
  start=$((lineno-5)); [ $start -lt 1 ] && start=1
  end=$((lineno+5))
  sed -n "${start},${end}p" "$file"
  echo "---------------------------------------"
done