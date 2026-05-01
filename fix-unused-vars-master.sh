#!/usr/bin/env bash
# fix-unused-vars-master.sh
# Master script: prefix variable names with _ in place for PRD/ASI unused variable hygiene.
# Files: shared/schema-daw-patch.ts, shared/schema-subscription.ts
# Variables: integer, real, relations

set -euo pipefail

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
REPORT="fix-unused-vars-report-${TIMESTAMP}.log"

echo "# fix-unused-vars-master.sh run at $TIMESTAMP" | tee "$REPORT"

# List of targets: file:var(s) (comma-separated if multiple)
declare -A FILE_VARS
FILE_VARS["shared/schema-daw-patch.ts"]="integer,real"
FILE_VARS["shared/schema-subscription.ts"]="integer,relations"

for FILE in "${!FILE_VARS[@]}"; do
  VARS_STRING="${FILE_VARS[$FILE]}"
  changed=0

  # Step 1. Backup first
  BACKUP="${FILE}.bak-${TIMESTAMP}"
  cp "$FILE" "$BACKUP"
  echo "Backed up $FILE to $BACKUP" | tee -a "$REPORT"

  # Step 2. For each target var, prefix with underscore if anchored as unused
  IFS=',' read -ra VARS <<< "$VARS_STRING"
  for var in "${VARS[@]}"; do
    # find usage: const|let|var variable =
    COUNT=$(grep -E "([[:space:]]|^)(const|let|var)[[:space:]]+${var}[[:space:]]*=" "$FILE" | wc -l)
    if [[ $COUNT -gt 0 ]]; then
      # Only prefix if not already _var
      sed -i -E "s/([[:space:]]|^)(const|let|var)[[:space:]]+${var}([[:space:]]*=)/\1\2 _${var}\3/g" "$FILE"
      echo "Patched $var → _${var} in $FILE" | tee -a "$REPORT"
      changed=1
    else
      echo "No direct match for '$var' in $FILE (already patched?)" | tee -a "$REPORT"
    fi
  done

  # Step 3. Confirm patch: show diff if changes
  if [[ $changed -eq 1 ]]; then
    echo "=== Diff for $FILE ===" | tee -a "$REPORT"
    diff -u "$BACKUP" "$FILE" | tee -a "$REPORT" || true
    echo "===" | tee -a "$REPORT"
  fi
done

echo | tee -a "$REPORT"
echo "# All candidate fixes applied. Now run:" | tee -a "$REPORT"
echo "pnpm lint" | tee -a "$REPORT"
echo "pnpm tsc --noEmit" | tee -a "$REPORT"
echo | tee -a "$REPORT"
echo "For any remaining errors, manually inspect the file(s) above." | tee -a "$REPORT"

exit 0
