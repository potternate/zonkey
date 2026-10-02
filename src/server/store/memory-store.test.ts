import { MemoryStore } from "./memory-store";
import { describeStoreContract } from "./store-contract";

describeStoreContract("memory", () => new MemoryStore());
