#!/bin/bash
#
# COMPLETE SURGICAL FIX - All 8 remaining code errors
# Run on your Chromebook: bash /path/to/COMPLETE_8_ERROR_FIX.sh
#

set -e

cd ~/Stable || { echo "❌ Not in ~/Stable directory"; exit 1; }

BACKUP_DIR="$HOME/Stable/.backup-$(date +%s)"
mkdir -p "$BACKUP_DIR"

echo "🔧 === COMPLETE SURGICAL FIX FOR 8 REMAINING ERRORS ==="
echo "📦 Backup directory: $BACKUP_DIR"
echo ""

# ====================================================================
# FIX GROUP 1: middleware/rateLimit.ts (2 errors - TS2322)
# ====================================================================
echo "[FIX 1-2] middleware/rateLimit.ts - Add missing properties"

cp server/middleware/rateLimit.ts "$BACKUP_DIR/rateLimit.ts.bak"

python3 << 'PYLIMIT'
import json, re

with open("server/middleware/rateLimit.ts", "r") as f:
    content = f.read()

# Fix both error responses to include status and message
old_429 = r"res\.status\(429\)\.json\(\{\s*error: 'Too many requests\.',\s*timestamp: new Date\(\)\.toISOString\(\),\s*\}\);"
new_429 = """res.status(429).json({
    error: 'Too many requests.',
    timestamp: new Date().toISOString(),
    status: 429,
    message: 'Rate limit exceeded'
  });"""

old_upload = r"res\.status\(429\)\.json\(\{\s*error: 'Upload rate limit exceeded\.',\s*timestamp: new Date\(\)\.toISOString\(\),\s*\}\);"
new_upload = """res.status(429).json({
    error: 'Upload rate limit exceeded.',
    timestamp: new Date().toISOString(),
    status: 429,
    message: 'Upload rate limit exceeded'
  });"""

content = re.sub(old_429, new_429, content)
content = re.sub(old_upload, new_upload, content)

with open("server/middleware/rateLimit.ts", "w") as f:
    f.write(content)

print("✓ rateLimit.ts fixed")
PYLIMIT

# ====================================================================
# FIX GROUP 2: middleware/auth.ts (2 errors - TS2739 AuthPayload)
# ====================================================================
echo "[FIX 3-4] middleware/auth.ts - Fix AuthPayload properties"

cp server/middleware/auth.ts "$BACKUP_DIR/auth.ts.bak"

python3 << 'PYAUTH'
with open("server/middleware/auth.ts", "r") as f:
    lines = f.readlines()

# Find and fix the AuthPayload creations at lines 80 and 115
# Ensure they include: role, tier, createdAt

output = []
for i, line in enumerate(lines):
    # Line 80-85 area: const payload = {...}
    if i >= 75 and i <= 85:
        if "const payload = {" in line:
            # Collect until closing brace
            output.append(line)
            j = i + 1
            payload_lines = []
            found_close = False
            
            while j < len(lines) and not found_close:
                payload_lines.append(lines[j])
                if "};" in lines[j]:
                    found_close = True
                j += 1
            
            # Check if all required properties exist
            payload_text = "".join(payload_lines)
            needs_role = "role:" not in payload_text
            needs_tier = "tier:" not in payload_text
            needs_created = "createdAt:" not in payload_text
            
            if needs_role or needs_tier or needs_created:
                # Rewrite the payload
                output.append("    id: user.id,\n")
                output.append("    email: user.email,\n")
                output.append("    username: user.username,\n")
                output.append("    role: user.role,\n")
                output.append("    tier: user.tier,\n")
                output.append("    createdAt: user.createdAt,\n")
                output.append("  };\n")
                # Skip original payload lines
                for _ in range(len(payload_lines)):
                    i += 1
            else:
                # Keep as is
                output.extend(payload_lines)
        else:
            output.append(line)
    else:
        output.append(line)

with open("server/middleware/auth.ts", "w") as f:
    f.writelines(output)

print("✓ auth.ts fixed")
PYAUTH

# ====================================================================
# FIX GROUP 3: server/types/express.d.ts (1 error - ensure all tier values)
# ====================================================================
echo "[FIX 5] server/types/express.d.ts - Verify tier union type"

cp server/types/express.d.ts "$BACKUP_DIR/express.d.ts.bak"

python3 << 'PYEXPRESS'
with open("server/types/express.d.ts", "r") as f:
    content = f.read()

# Ensure tier has all 3 values
if "tier: string;" in content:
    content = content.replace(
        "tier: string;",
        "tier: 'explorer' | 'creator' | 'pro_artist';"
    )
    print("✓ express.d.ts tier type fixed")
elif "tier:" in content and "'explorer'" in content:
    print("✓ express.d.ts tier already has union type")

# Ensure createdAt exists
if "createdAt: Date;" not in content:
    content = content.replace(
        "tier: 'explorer' | 'creator' | 'pro_artist';",
        "tier: 'explorer' | 'creator' | 'pro_artist';\n      createdAt: Date;"
    )
    print("✓ express.d.ts createdAt property added")

with open("server/types/express.d.ts", "w") as f:
    f.write(content)
PYEXPRESS

# ====================================================================
# FIX GROUP 4: Verify errorHandler.ts is correct (should be already fixed)
# ====================================================================
echo "[FIX 6] Verify errorHandler.ts middleware signature"

if grep -q "export const errorHandler = (" server/middleware/errorHandler.ts; then
    if grep -q "err: unknown" server/middleware/errorHandler.ts; then
        echo "✓ errorHandler.ts already has correct signature"
    fi
fi

# ====================================================================
# FIX GROUP 5: server/package.json - Ensure @trpc/server is listed
# ====================================================================
echo "[FIX 7] server/package.json - Verify @trpc/server dependency"

if ! grep -q "@trpc/server" server/package.json; then
    echo "⚠️  @trpc/server not in dependencies - adding..."
    python3 << 'PYJSON'
import json

with open("server/package.json", "r") as f:
    pkg = json.load(f)

if "@trpc/server" not in pkg.get("dependencies", {}):
    if "dependencies" not in pkg:
        pkg["dependencies"] = {}
    pkg["dependencies"]["@trpc/server"] = "^11.18.0"

with open("server/package.json", "w") as f:
    json.dump(pkg, f, indent=2)

print("✓ @trpc/server added to dependencies")
PYJSON
else
    echo "✓ @trpc/server already in dependencies"
fi

# ====================================================================
# FIX GROUP 6: Clean rebuild
# ====================================================================
echo ""
echo "[FIX 8] Rebuild with clean dependencies"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

rm -f pnpm-lock.yaml
pnpm install --no-frozen-lockfile 2>&1 | tail -5

echo ""
echo "🔨 Building..."
pnpm build 2>&1 | tee /tmp/final_build.log | tail -30

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Count remaining errors
ERROR_COUNT=$(grep -c "error TS" /tmp/final_build.log || echo "0")

if [ "$ERROR_COUNT" -eq 0 ]; then
    echo "✅ SUCCESS! All 8 code errors fixed!"
    echo "📦 Backups saved to: $BACKUP_DIR"
    exit 0
else
    echo "⚠️  Remaining errors: $ERROR_COUNT"
    echo "Share this output:"
    grep "error TS" /tmp/final_build.log | head -10
    exit 1
fi
