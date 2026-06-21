
# The schema.ts file is corrupted. We need to fix it properly using Python.
# The issues:
# 1. Lines 296-297 have garbage: "viewer" comment and ]); inside sessionMetrics table
# 2. teamRoleEnum definition is missing but referenced by userInstances and permissions
# 3. The sed insert didn't work because the line numbers shifted

# Let's create a Python script to fix this reliably

fix_script = '''
import re

with open('server/db/schema.ts', 'r') as f:
    content = f.read()

# Find and remove the garbage pattern from sessionMetrics table
# The pattern is:
#   createdAt:        timestamp("created_at").notNull().defaultNow(),
#   "viewer",       // Read-only dashboards
# ]);

garbage_pattern = r'''  createdAt:        timestamp("created_at").notNull().defaultNow(),
  "viewer",       // Read-only dashboards
\]\);'''

replacement = '''  createdAt:        timestamp("created_at").notNull().defaultNow(),
});'''

content = re.sub(garbage_pattern, replacement, content)

# Now add teamRoleEnum before userInstances
enum_def = '''// Team role enum for user instances and permissions
export const teamRoleEnum = pgEnum("team_role", [
  "owner",        // Full admin, Penguin Machine only
  "admin",        // Can manage team members, all instances
  "developer",    // Code, deploy, read logs
  "analyst",      // Read dashboards, logs, metrics
  "viewer",       // Read-only dashboards
]);

'''

# Insert before userInstances
content = content.replace('export const userInstances = pgTable("user_instances", {', 
                          enum_def + 'export const userInstances = pgTable("user_instances", {')

with open('server/db/schema.ts', 'w') as f:
    f.write(content)

print("Fixed schema.ts")
'''

with open('/mnt/agents/output/fix_schema.py', 'w') as f:
    f.write(fix_script)

print("Fix script created: /mnt/agents/output/fix_schema.py")
print()
print("Run it with:")
print("  cd ~/Stable && python3 /mnt/agents/output/fix_schema.py")
print()
print("Then verify:")
print("  sed -n '290,320p' server/db/schema.ts")
