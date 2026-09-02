#!/bin/bash

# Close problematic Dependabot PRs due to configuration consolidation
# These PRs were created by conflicting npm update configurations

GITHUB_TOKEN="${GITHUB_TOKEN}"
OWNER="revibe25"
REPO="r3v4"
PROBLEMATIC_PRS=(38 44 45 46 47 48 49 50)

if [ -z "$GITHUB_TOKEN" ]; then
  echo "Error: GITHUB_TOKEN environment variable is not set"
  exit 1
fi

COMMENT="Closing due to Dependabot configuration consolidation. The previous configuration had conflicting npm update rules that caused pnpm-lock.yaml corruption. 

The configuration has been updated to use a single unified root npm config. Dependabot will create a new consolidated PR on the next scheduled run (Monday 6:00 AM Chicago time).

This PR is no longer needed."

for pr_number in "${PROBLEMATIC_PRS[@]}"; do
  echo "Closing PR #$pr_number..."
  
  # Post comment
  curl -s -X POST \
    -H "Authorization: Bearer $GITHUB_TOKEN" \
    -H "Accept: application/vnd.github+json" \
    "https://api.github.com/repos/$OWNER/$REPO/issues/$pr_number/comments" \
    -d "{\"body\":\"$COMMENT\"}" > /dev/null
  
  # Close the PR
  curl -s -X PATCH \
    -H "Authorization: Bearer $GITHUB_TOKEN" \
    -H "Accept: application/vnd.github+json" \
    "https://api.github.com/repos/$OWNER/$REPO/pulls/$pr_number" \
    -d '{"state":"closed"}' > /dev/null
  
  echo "✓ PR #$pr_number closed"
done

echo "✓ All problematic Dependabot PRs have been closed"
