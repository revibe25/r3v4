#!/bin/bash
# R3/NATIVE Auth Deployment — Run this in your Crostini terminal
# This deploys the corrected auth HTML to your actual r3v4 project structure

set -e

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  R3/NATIVE Auth Deployment to r3v4"
echo "  Chromebook Crostini Edition"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# STEP 1: Copy the HTML file from Downloads or home to your project
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

echo "📋 STEP 1: Locating the HTML file..."
echo ""

# Try multiple locations where you might have saved it
if [ -f "$HOME/R3_Native_Auth_Corrected.html" ]; then
    HTML_SOURCE="$HOME/R3_Native_Auth_Corrected.html"
    echo "✓ Found: $HTML_SOURCE"
elif [ -f "$HOME/Downloads/R3_Native_Auth_Corrected.html" ]; then
    HTML_SOURCE="$HOME/Downloads/R3_Native_Auth_Corrected.html"
    echo "✓ Found: $HTML_SOURCE"
elif [ -f "/tmp/R3_Native_Auth_Corrected.html" ]; then
    HTML_SOURCE="/tmp/R3_Native_Auth_Corrected.html"
    echo "✓ Found: $HTML_SOURCE"
elif [ -f "/home/claude/R3_Native_Auth_Corrected.html" ]; then
    HTML_SOURCE="/home/claude/R3_Native_Auth_Corrected.html"
    echo "✓ Found: $HTML_SOURCE"
else
    echo "❌ ERROR: Could not find R3_Native_Auth_Corrected.html"
    echo ""
    echo "   The file should be one of:"
    echo "   • ~/R3_Native_Auth_Corrected.html"
    echo "   • ~/Downloads/R3_Native_Auth_Corrected.html"
    echo "   • /tmp/R3_Native_Auth_Corrected.html"
    echo ""
    echo "   If you don't have it, download it from Claude and save it to one of these locations."
    exit 1
fi

echo ""

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# STEP 2: Determine the correct public directory
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

echo "📂 STEP 2: Locating your r3v4 project public directory..."
echo ""

# Your project is at /home/cloud/Projects/r3v4
PROJECT_ROOT="$HOME/Projects/r3v4"

if [ ! -d "$PROJECT_ROOT" ]; then
    echo "❌ ERROR: Project not found at $PROJECT_ROOT"
    exit 1
fi

echo "✓ Project root: $PROJECT_ROOT"

# Based on your ls output, public/ is at root level, not under client/
# But let's check all possibilities
if [ -d "$PROJECT_ROOT/public" ]; then
    PUBLIC_DIR="$PROJECT_ROOT/public"
    echo "✓ Found public dir: $PUBLIC_DIR"
elif [ -d "$PROJECT_ROOT/client/public" ]; then
    PUBLIC_DIR="$PROJECT_ROOT/client/public"
    echo "✓ Found public dir: $PUBLIC_DIR"
else
    echo "⚠ WARNING: No public/ directory found!"
    echo "   Creating: $PROJECT_ROOT/public"
    mkdir -p "$PROJECT_ROOT/public"
    PUBLIC_DIR="$PROJECT_ROOT/public"
fi

echo ""

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# STEP 3: Backup existing auth.html if it exists
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

echo "🔄 STEP 3: Backing up existing files (if any)..."
echo ""

if [ -f "$PUBLIC_DIR/auth.html" ]; then
    BACKUP_FILE="$PUBLIC_DIR/auth.html.backup-$(date +%s)"
    cp "$PUBLIC_DIR/auth.html" "$BACKUP_FILE"
    echo "✓ Backed up: $BACKUP_FILE"
else
    echo "✓ No existing auth.html to back up"
fi

echo ""

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# STEP 4: Copy the corrected HTML
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

echo "📥 STEP 4: Deploying R3_Native_Auth_Corrected.html..."
echo ""

cp "$HTML_SOURCE" "$PUBLIC_DIR/auth.html"

if [ ! -f "$PUBLIC_DIR/auth.html" ]; then
    echo "❌ ERROR: Deploy failed!"
    exit 1
fi

FILE_SIZE=$(du -h "$PUBLIC_DIR/auth.html" | cut -f1)
echo "✓ Deployed: $PUBLIC_DIR/auth.html ($FILE_SIZE)"

echo ""

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# STEP 5: Verify the deployment
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

echo "✅ STEP 5: Verifying deployment..."
echo ""

# Check file exists and has content
if [ -s "$PUBLIC_DIR/auth.html" ]; then
    echo "✓ File exists and has content"
else
    echo "⚠ WARNING: File is empty or missing"
    exit 1
fi

# Check for the signature
if grep -q "R3 / NATIVE — Sign-in interface" "$PUBLIC_DIR/auth.html"; then
    echo "✓ HTML signature verified"
else
    echo "⚠ WARNING: Could not verify HTML signature"
fi

echo ""

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# STEP 6: Print next steps
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  ✨ DEPLOYMENT COMPLETE"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

echo "📍 File location: $PUBLIC_DIR/auth.html"
echo ""

echo "🚀 NEXT STEPS:"
echo ""

echo "1️⃣  Start your dev server:"
echo "   cd $PROJECT_ROOT"
echo "   pnpm dev"
echo ""

echo "2️⃣  Open the auth page in browser:"
echo "   http://localhost:5173/auth.html"
echo ""

echo "3️⃣  Test the login flow:"
echo "   • Credential: ernesto (or any valid email/username)"
echo "   • Password: test123456"
echo "   • Click SUBMIT"
echo "   • Should redirect to /instrument"
echo ""

echo "4️⃣  Verify token storage:"
echo "   • Open browser DevTools (F12)"
echo "   • Go to Application → Local Storage"
echo "   • Look for key: r3_token"
echo "   • Value should be a JWT (three segments separated by dots)"
echo ""

echo "5️⃣  Wire into your React Router (if not already):"
echo "   In client/src/App.tsx or your route config:"
echo "   import R3AuthPage from './pages/auth';"
echo "   <Route path=\"/auth\" element={<R3AuthPage />} />"
echo ""

echo "❓ TROUBLESHOOTING:"
echo ""

echo "If you see 'offline' or network errors:"
echo "  → Make sure your server is running (pnpm dev)"
echo "  → Check that /auth endpoint exists on your server"
echo "  → Check browser console for CORS errors"
echo ""

echo "If login doesn't redirect:"
echo "  → Check localStorage['r3_token'] is being set"
echo "  → Verify the /auth endpoint returns { token, user }"
echo "  → Check your server is responding (curl http://localhost:5173/health)"
echo ""

echo "If the page looks broken:"
echo "  → Clear browser cache (Ctrl+Shift+Del)"
echo "  → Hard refresh (Ctrl+F5)"
echo "  → Check that auth.html was copied correctly:"
echo "     cat $PUBLIC_DIR/auth.html | head -5"
echo ""

echo "✅ Done!"
echo ""
