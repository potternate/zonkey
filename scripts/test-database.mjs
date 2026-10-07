import { createHmac } from "node:crypto";
import { execFileSync } from "node:child_process";

const containers = execFileSync("docker", ["ps", "--format", "{{.Names}}"], { encoding: "utf8" })
  .trim().split("\n");
const db = process.env.SUPABASE_TEST_DB_CONTAINER ?? containers.find((name) => name.startsWith("supabase_db_"));
if (!db) throw new Error("Start local Supabase first.");
const suffix = db.slice("supabase_db_".length);
const rest = JSON.parse(execFileSync("docker", ["inspect", `supabase_rest_${suffix}`], { encoding: "utf8" }))[0];
const jwt = rest.Config.Env.find((entry) => entry.startsWith("PGRST_JWT_SECRET="))?.slice("PGRST_JWT_SECRET=".length);
if (!jwt) throw new Error("Local REST JWT signing key not found.");
const signingKey = jwt.startsWith("{") ? JSON.parse(jwt).keys.find((key) => key.kty === "oct") : null;
const key = signingKey ? Buffer.from(signingKey.k, "base64url") : jwt;
const now = Math.floor(Date.now() / 1000);
function token(role) {
  const payload = [JSON.stringify({ alg: "HS256", typ: "JWT" }), JSON.stringify({ role, iss: "supabase", iat: now, exp: now + 3600 })]
    .map((value) => Buffer.from(value).toString("base64url")).join(".");
  return `${payload}.${createHmac("sha256", key).update(payload).digest("base64url")}`;
}
execFileSync("npm", ["test", "--", "--no-file-parallelism", ...process.argv.slice(2)], {
  stdio: "inherit",
  env: {
    ...process.env,
    SUPABASE_TEST_URL: process.env.SUPABASE_TEST_URL ?? "http://127.0.0.1:54321",
    SUPABASE_TEST_DB_CONTAINER: db,
    SUPABASE_TEST_SERVICE_ROLE_KEY: token("service_role"),
    SUPABASE_TEST_ANON_KEY: token("anon"),
    SUPABASE_TEST_AUTHENTICATED_KEY: token("authenticated"),
  },
});
