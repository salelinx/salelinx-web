// End-to-end check of report-telemetry and the health tables on a local Supabase (Docker).
// Never touches the live project. Run: npm run test:telemetry

import { execFileSync, spawn } from "node:child_process";
import { createHmac } from "node:crypto";
import assert from "node:assert/strict";

const sh = (cmd, args) => execFileSync(cmd, args, { encoding: "utf8" });
const status = () => {
  try {
    return JSON.parse(sh("supabase", ["status", "-o", "json"]));
  } catch {
    return null;
  }
};

let env = status();
const startedHere = !env?.API_URL;
if (startedHere) {
  console.log("Starting local Supabase with every migration...");
  sh("supabase", [
    "start",
    "-x",
    "studio,imgproxy,vector,logflare,supavisor,realtime,storage-api,mailpit",
  ]);
  env = status();
}
const { API_URL, DB_URL, ANON_KEY, SERVICE_ROLE_KEY, JWT_SECRET } = env;
const sql = (q) => sh("psql", [DB_URL, "-qAtc", q]).trim();

// Live grants new functions to service_role by default; local does not.
sql(
  "grant execute on function record_endpoint_health(jsonb), record_crash_health(jsonb), record_endpoint_health_report(int,int,int,text) to service_role",
);

const serve = spawn("supabase", ["functions", "serve", "--no-verify-jwt"], {
  stdio: "ignore",
});
const failures = [];
const check = async (name, fn) => {
  try {
    await fn();
    console.log(`ok    ${name}`);
  } catch (err) {
    failures.push(name);
    console.log(`FAIL  ${name}\n      ${err.message.split("\n")[0]}`);
  }
};

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
const jwt = (claims) => {
  const body = `${b64({ alg: "HS256", typ: "JWT" })}.${b64({ aud: "authenticated", role: "authenticated", exp: Math.floor(Date.now() / 1000) + 600, ...claims })}`;
  return `${body}.${createHmac("sha256", JWT_SECRET).update(body).digest("base64url")}`;
};
const rpc = (fn, token, args = {}) =>
  fetch(`${API_URL}/rest/v1/rpc/${fn}`, {
    method: "POST",
    headers: {
      apikey: ANON_KEY,
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(args),
  });
const report = (body, token) =>
  fetch(`${API_URL}/functions/v1/report-telemetry`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token && { Authorization: `Bearer ${token}` }),
    },
    body: JSON.stringify(body),
  });

try {
  const admin = {
    apikey: SERVICE_ROLE_KEY,
    Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
    "Content-Type": "application/json",
  };
  const email = `telemetry-${Date.now()}@example.test`;
  const user = await (
    await fetch(`${API_URL}/auth/v1/admin/users`, {
      method: "POST",
      headers: admin,
      body: JSON.stringify({
        email,
        password: "test-pass-123",
        email_confirm: true,
      }),
    })
  ).json();
  const session = await (
    await fetch(`${API_URL}/auth/v1/token?grant_type=password`, {
      method: "POST",
      headers: { apikey: ANON_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({ email, password: "test-pass-123" }),
    })
  ).json();
  const token = session.access_token;
  assert.ok(token, "could not sign in the test user");

  for (let i = 0; i < 60; i++) {
    const r = await report({}, token).catch(() => null);
    if (r && r.status < 500) break;
    await new Promise((ok) => setTimeout(ok, 1000));
  }

  const v = `9.${Date.now() % 100000}`;
  const prev = `${v.split(".")[0]}.0`;
  const day = new Date();
  day.setUTCHours(0, 0, 0, 0);
  const a = (action, platform, outcome, code, count, extra = {}) => ({
    action,
    platform,
    outcome,
    code,
    count,
    extension_version: v,
    bucket_hour: day.toISOString(),
    ...extra,
  });
  const actions = [
    a("sendEbayMessage", "ebay", "ok", "", 30),
    a("sendEbayMessage", "ebay", "failed", "reauth", 20),
    a("sendEbayMessage", "ebay", "ok", "", 99, { extension_version: prev }),
    a("sendEbayMessage", "ebay", "failed", "reauth", 1, {
      extension_version: prev,
    }),
    a("job_vintedRelist_item", "vinted", "empty", "", 3),
    a("getW", "", "ok", "", 1, {
      bucket_hour: "2030-01-01T00:00:00.000Z",
      user_id: "x",
    }),
    a("bad action; drop", "ebay", "ok", "", 1),
    a("getX", "amazon", "ok", "", 1),
    a("getY", "", "failed", "has a message in it", 1),
    a("getZ", "", "ok", "", 0),
  ];
  const entry = {
    endpoint_key: "vinted:GET /api/v2/items",
    platform: "vinted",
    outcome: "ok",
    status_code: 200,
    count: 1,
    extension_version: v,
    bucket_hour: new Date().toISOString(),
  };

  await check("report without a login is refused", async () => {
    assert.equal((await report({ entries: [entry] })).status, 401);
  });
  await check(
    "report stores valid actions and drops invalid ones",
    async () => {
      const r = await (
        await report({ entries: [entry], crashes: [], actions }, token)
      ).json();
      assert.deepEqual(r, {
        inserted: 1,
        crashesInserted: 0,
        actionsInserted: 6,
      });
      assert.equal(
        sql(
          `select count(*) from action_health where action in ('getX','getY','getZ') or action like 'bad%'`,
        ),
        "0",
      );
    },
  );
  await check(
    "a stray user_id is not stored and future dates are clamped",
    async () => {
      assert.ok(
        !sql(
          "select string_agg(column_name, ',') from information_schema.columns where table_name='action_health'",
        ).includes("user"),
      );
      assert.equal(
        sql(
          `select bucket_hour <= now() from action_health where action='getW' and extension_version='${v}'`,
        ),
        "t",
      );
    },
  );
  await check(
    "a report from an older build without actions still works",
    async () => {
      const r = await (await report({ entries: [entry] }, token)).json();
      assert.deepEqual(r, {
        inserted: 1,
        crashesInserted: 0,
        actionsInserted: 0,
      });
    },
  );

  sql(
    `insert into admin_users(user_id) values ('${user.id}') on conflict do nothing`,
  );
  await check("an MFA admin reads per-version results", async () => {
    const r = await rpc(
      "admin_action_health",
      jwt({ sub: user.id, aal: "aal2" }),
    );
    assert.equal(r.status, 200);
    const rows = (await r.json()).filter(
      (x) =>
        x.action === "sendEbayMessage" &&
        [v, prev].includes(x.extension_version),
    );
    const now = rows.find((x) => x.extension_version === v);
    assert.deepEqual([now.ok, now.failed, now.top_code], [30, 20, "reauth"]);
    assert.equal(rows.find((x) => x.extension_version === prev).ok, 99);
  });
  await check("an admin without MFA is refused", async () => {
    assert.notEqual(
      (await rpc("admin_action_health", jwt({ sub: user.id, aal: "aal1" })))
        .status,
      200,
    );
  });
  await check("signed-out visitors are refused", async () => {
    assert.notEqual((await rpc("admin_action_health", ANON_KEY)).status, 200);
  });
  await check("users cannot write or prune the table themselves", async () => {
    assert.notEqual(
      (await rpc("record_action_health", token, { p_batch: [] })).status,
      200,
    );
    assert.notEqual((await rpc("prune_action_health", token)).status, 200);
  });
  await check("rows older than 90 days are pruned", async () => {
    sql(
      `insert into action_health(action,platform,outcome,code,count,extension_version,bucket_hour) values ('oldRow','','ok','',1,'${v}',now()-interval '91 days')`,
    );
    sql("select public.prune_action_health()");
    assert.equal(
      sql(`select count(*) from action_health where action='oldRow'`),
      "0",
    );
  });
} finally {
  serve.kill();
  if (startedHere) sh("supabase", ["stop", "--no-backup"]);
}

console.log(
  failures.length
    ? `\n${failures.length} failed`
    : "\nAll telemetry checks passed",
);
process.exit(failures.length ? 1 : 0);
