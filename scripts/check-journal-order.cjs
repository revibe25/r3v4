// Fails when the newest migration's timestamp is not after every earlier one.
// The migrator skips anything at or before the newest recorded timestamp.
const fs = require('fs');
const entries = JSON.parse(fs.readFileSync('drizzle/migrations/meta/_journal.json', 'utf8')).entries;
const newest = entries[entries.length - 1];
const earlierMax = Math.max(...entries.slice(0, -1).map(e => e.when));
if (newest.when <= earlierMax) {
  console.error(`FAIL: ${newest.tag} (when=${newest.when}) is not after earlier max ${earlierMax}`);
  process.exit(1);
}
console.log(`OK: ${newest.tag} sorts after all earlier migrations`);
