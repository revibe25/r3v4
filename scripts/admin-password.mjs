import "dotenv/config";
import pg from "pg";
import bcrypt from "bcrypt";
import readline from "node:readline";
import { execFileSync } from "node:child_process";

const { Client } = pg;

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("DATABASE_URL is not set.");
  process.exit(1);
}

function ask(prompt, hidden = false) {
  if (!hidden) {
    return new Promise((resolve, reject) => {
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
      });

      rl.question(prompt, (answer) => {
        rl.close();
        resolve(answer);
      });

      rl.on("error", reject);
    });
  }

  if (!process.stdin.isTTY || typeof process.stdin.setRawMode !== "function") {
    throw new Error(
      "Password entry requires an interactive terminal. Run `pnpm admin:password` directly from a terminal."
    );
  }

  return new Promise((resolve, reject) => {
    let value = "";

    const cleanup = () => {
      try {
        process.stdin.setRawMode(false);
      } catch {}
      process.stdin.pause();
      process.stdin.removeListener("data", onData);
      process.stdout.write("\n");
    };

    const onData = (chunk) => {
      const data = String(chunk);

      for (const char of data) {
        if (char === "\u0003") {
          cleanup();
          reject(new Error("Cancelled."));
          return;
        }

        if (char === "\r" || char === "\n") {
          cleanup();
          resolve(value);
          return;
        }

        if (char === "\u007f" || char === "\b") {
          value = value.slice(0, -1);
          continue;
        }

        value += char;
      }
    };

    try {
      process.stdout.write(prompt);
      process.stdin.resume();
      process.stdin.setRawMode(true);
      process.stdin.on("data", onData);
    } catch (err) {
      cleanup();
      reject(err);
    }
  });
}

const client = new Client({ connectionString: DATABASE_URL });

try {
  await client.connect();
  await client.query("BEGIN");

  const existing = await client.query(`
    SELECT id, username, email, tier, is_admin
    FROM users
    WHERE is_admin = true
    FOR UPDATE
  `);

  if (existing.rows.length > 1) {
    throw new Error(
      `Found ${existing.rows.length} admin accounts. ` +
      "Refusing to change a password until there is exactly one owner admin."
    );
  }

  let admin = existing.rows[0];

  if (!admin) {
    const target = await client.query(
      `
      SELECT id, username, email, is_admin
      FROM users
      WHERE username = $1 OR email = $2
      FOR UPDATE
      `,
      ["r3v4_admin", "admin@r3vibe.com"]
    );

    if (target.rows.length > 0) {
      throw new Error(
        "r3v4_admin/admin@r3vibe.com already exists but is not marked is_admin=true. " +
        "Refusing to elevate it automatically."
      );
    }

    const create = await ask(
      "No owner admin exists. Create r3v4_admin now? [y/N]: "
    );

    if (create.trim().toLowerCase() !== "y") {
      throw new Error("Cancelled.");
    }

    const username = "r3v4_admin";
    const email = "admin@r3vibe.com";

    const password = await ask("New admin password: ", true);
    const confirm = await ask("Confirm new admin password: ", true);

    if (!password) throw new Error("Password cannot be empty.");
    if (password !== confirm) throw new Error("Passwords do not match.");

    if (password.length < 12) {
      throw new Error("Password must be at least 12 characters.");
    }

    const hash = await bcrypt.hash(password, 12);

    const created = await client.query(
      `
      INSERT INTO users
        (username, email, password, tier, is_admin, updated_at)
      VALUES
        ($1, $2, $3, 'pro_artist', true, now())
      RETURNING id, username, email, tier, is_admin
      `,
      [username, email, hash]
    );

    admin = created.rows[0];

    await client.query("COMMIT");

    console.log("");
    console.log("Owner admin created successfully.");
    console.log(`Username: ${admin.username}`);
    console.log(`Email:    ${admin.email}`);
    console.log("Password: set privately.");
    process.exit(0);
  }

  console.log(
    `Changing password for owner admin: ${admin.username} (${admin.email ?? "no email"})`
  );

  const password = await ask("New admin password: ", true);
  const confirm = await ask("Confirm new admin password: ", true);

  if (!password) throw new Error("Password cannot be empty.");
  if (password !== confirm) throw new Error("Passwords do not match.");

  if (password.length < 12) {
    throw new Error("Password must be at least 12 characters.");
  }

  const hash = await bcrypt.hash(password, 12);

  await client.query(
    `
    UPDATE users
    SET password = $1,
        updated_at = now()
    WHERE id = $2
      AND is_admin = true
    `,
    [hash, admin.id]
  );

  await client.query("COMMIT");

  console.log("");
  console.log("Admin password changed successfully.");
  console.log(`Username: ${admin.username}`);
  console.log("The plaintext password was not stored.");
} catch (err) {
  try {
    await client.query("ROLLBACK");
  } catch {}

  console.error("");
  console.error(
    err instanceof Error ? err.message : "Admin password operation failed."
  );
  process.exit(1);
} finally {
  await client.end();
}
