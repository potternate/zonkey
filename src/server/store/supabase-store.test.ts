import { describe, it } from "vitest";
import { describeStoreContract } from "./store-contract";
import { SupabaseStore } from "./supabase-store";

const url = process.env.SUPABASE_TEST_URL;
const key = process.env.SUPABASE_TEST_SERVICE_ROLE_KEY;

if (url && key) {
  describeStoreContract("supabase", () => new SupabaseStore(url, key));
} else {
  describe.skip("supabase store contract (set SUPABASE_TEST_URL and SUPABASE_TEST_SERVICE_ROLE_KEY)", () => {
    it("skipped", () => {});
  });
}
