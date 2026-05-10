import re
import sys
from datetime import datetime

FNAME = "SECURITY.md"
RE_REVISIT = re.compile(r"Revisit trigger:\s*(\d{4}-\d{2}-\d{2})", re.IGNORECASE)
today = datetime.now().date()

with open(FNAME) as f:
    for i, line in enumerate(f):
        m = RE_REVISIT.search(line)
        if m:
            due = datetime.strptime(m.group(1), "%Y-%m-%d").date()
            if due <= today:
                print(f"::error file={FNAME},line={i+1}::Security finding overdue for review (revisit trigger {due})")
                sys.exit(1)
print("No overdue security reviews. ✅")