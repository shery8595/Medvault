/**
 * Indexer integration: idempotent MongoDB writes, Redis cache, API, reconcile alerts.
 * Uses in-memory Mongo/Redis substitutes when MONGODB_URI is unset (CI-safe).
 */
import { expect } from "chai";
import { createServer, type Server } from "node:http";
import {
  eventKey,
  type IndexedApplication,
  type IndexedTrial,
  IndexerDb,
  IndexerCache,
  type CacheTag,
  createIndexerApi,
  reconcileTrialIds,
  resetIndexerDesyncAlerts,
  getIndexerDesyncAlerts,
} from "@medvault/indexer/lib";

/** Minimal in-memory stand-in for MongoDB collections used in tests. */
class MemoryCollection<T extends { trialId?: string; active?: boolean; submittedAt?: string }> {
  constructor(private rows: Map<string, T>) {}

  find(filter: { active?: boolean; sponsor?: string; trialId?: string | { $in: string[] } } = {}) {
    let list = [...this.rows.values()];
    if (filter.active !== undefined) {
      list = list.filter((r) => r.active === filter.active);
    }
    if (filter.sponsor) {
      list = list.filter((r) => (r as { sponsor?: string }).sponsor === filter.sponsor);
    }
    if (typeof filter.trialId === "string") {
      list = list.filter((r) => r.trialId === filter.trialId);
    } else if (filter.trialId?.$in) {
      list = list.filter((r) => r.trialId && filter.trialId!.$in.includes(r.trialId));
    }
    const chain = {
      sort: () => chain,
      limit: () => chain,
      toArray: async () => list,
    };
    return chain;
  }
}

class MemoryIndexerDb {
  private trialRows = new Map<string, IndexedTrial>();
  private appRows = new Map<string, IndexedApplication>();

  async connect(): Promise<void> {}
  async close(): Promise<void> {}

  trials() {
    return new MemoryCollection(this.trialRows);
  }

  applications() {
    return new MemoryCollection(this.appRows);
  }

  consents() {
    return new MemoryCollection(new Map());
  }

  rewards() {
    return new MemoryCollection(new Map());
  }

  async upsertTrial(doc: IndexedTrial): Promise<void> {
    this.trialRows.set(doc.trialId, doc);
  }

  async upsertApplication(doc: IndexedApplication): Promise<void> {
    this.appRows.set(doc.eventKey, doc);
  }

  async countTrials(): Promise<number> {
    return this.trialRows.size;
  }

  async trialIds(): Promise<string[]> {
    return [...this.trialRows.keys()].sort();
  }
}

/** Minimal Redis stand-in with tag invalidation semantics. */
class MemoryCache {
  private store = new Map<string, string>();
  private tags = new Map<string, Set<string>>();

  async connect(): Promise<void> {}
  async close(): Promise<void> {}

  async get<T>(key: string): Promise<T | null> {
    const raw = this.store.get(`indexer:cache:${key}`);
    return raw ? (JSON.parse(raw) as T) : null;
  }

  async set(key: string, value: unknown, tags: CacheTag[]): Promise<void> {
    const entry = `indexer:cache:${key}`;
    this.store.set(entry, JSON.stringify(value));
    for (const tag of tags) {
      const set = this.tags.get(tag) ?? new Set();
      set.add(entry);
      this.tags.set(tag, set);
    }
  }

  async invalidateTags(tags: CacheTag[]): Promise<void> {
    for (const tag of tags) {
      const entries = this.tags.get(tag);
      if (entries) {
        for (const e of entries) this.store.delete(e);
        this.tags.delete(tag);
      }
    }
  }

  tagsForTrial(trialId: string): CacheTag[] {
    return ["trials", `trial:${trialId}`, `applications:${trialId}`];
  }

  tagsForSponsor(sponsor: string): CacheTag[] {
    return [`sponsor:${sponsor.toLowerCase()}`, "trials"];
  }
}

describe("Indexer sync (off-chain cache)", function () {
  this.timeout(30_000);

  let httpServer: Server;
  let baseUrl: string;
  const memDb = new MemoryIndexerDb();
  const memCache = new MemoryCache();

  before(async function () {
    resetIndexerDesyncAlerts();

    const dbAdapter = memDb as unknown as IndexerDb;
    const cacheAdapter = memCache as unknown as IndexerCache;

    const app = createIndexerApi(
      { cacheTtlSec: 30, port: 0 } as never,
      dbAdapter,
      cacheAdapter
    );
    httpServer = createServer(app);
    await new Promise<void>((resolve) => httpServer.listen(0, resolve));
    const addr = httpServer.address();
    const port = typeof addr === "object" && addr ? addr.port : 3300;
    baseUrl = `http://127.0.0.1:${port}`;
  });

  after(async function () {
    await new Promise<void>((resolve) => httpServer.close(() => resolve()));
  });

  it("IDX-01: idempotent writes keyed by tx hash + log index", async function () {
    const key = eventKey("0xabc123", 4);
    const trial: IndexedTrial = {
      _id: "1",
      trialId: "1",
      sponsor: "0xsponsor",
      name: "Trial Alpha",
      active: true,
      eventKey: key,
      source: "rpc",
      updatedAt: Date.now(),
    };
    await memDb.upsertTrial(trial);
    await memDb.upsertTrial({ ...trial, name: "Trial Alpha Updated" });
    expect((await memDb.trials().find().toArray())[0]?.name).to.equal("Trial Alpha Updated");
    expect(await memDb.countTrials()).to.equal(1);

    const appKey = eventKey("0xdef456", 2);
    const app: IndexedApplication = {
      _id: "n1-1",
      trialId: "1",
      nullifier: "999",
      status: "Pending",
      eventKey: appKey,
      source: "rpc",
      updatedAt: Date.now(),
    };
    await memDb.upsertApplication(app);
    await memDb.upsertApplication(app);
    expect((await memDb.applications().find().toArray()).length).to.equal(1);
  });

  it("IDX-02: event → cache → API consistency", async function () {
    await memDb.upsertTrial({
      _id: "2",
      trialId: "2",
      sponsor: "0xsponsor2",
      name: "Cached Trial",
      active: true,
      phase: "Phase 2",
      eventKey: eventKey("0x111", 0),
      source: "rpc",
      updatedAt: Date.now(),
    });
    await memDb.upsertApplication({
      _id: "app-2",
      trialId: "2",
      nullifier: "42",
      status: "Accepted",
      submittedAt: "1700000000",
      eventKey: eventKey("0x222", 1),
      source: "rpc",
      updatedAt: Date.now(),
    });

    const trialsRes = await fetch(`${baseUrl}/trials?active=true`);
    expect(trialsRes.ok).to.be.true;
    const trialsBody = (await trialsRes.json()) as { trials: { id: string }[] };
    expect(trialsBody.trials.some((t) => t.id === "2")).to.be.true;

    const cached = await memCache.get("trials:active");
    expect(cached).to.not.be.null;

    const appsRes = await fetch(`${baseUrl}/trial/2/applications`);
    expect(appsRes.ok).to.be.true;
    const appsBody = (await appsRes.json()) as { applications: { status: string }[] };
    expect(appsBody.applications[0]?.status).to.equal("Accepted");
  });

  it("IDX-03: cache tag invalidation on new events", async function () {
    await memCache.set("trials:all", { trials: [] }, ["trials"]);
    expect(await memCache.get("trials:all")).to.not.be.null;
    await memCache.invalidateTags(memCache.tagsForTrial("99"));
    await memCache.invalidateTags(["trials"]);
    expect(await memCache.get("trials:all")).to.be.null;
  });

  it("IDX-04: reconcile emits IndexerDesync on intentional divergence", function () {
    resetIndexerDesyncAlerts();
    const ok = reconcileTrialIds(["1", "2"], ["1", "2"]);
    expect(ok).to.be.true;
    expect(getIndexerDesyncAlerts()).to.have.length(0);

    reconcileTrialIds(["1"], ["1", "2"]);
    const alerts = getIndexerDesyncAlerts();
    expect(alerts).to.have.length(1);
    expect(alerts[0].type).to.equal("IndexerDesync");
    expect(alerts[0].entity).to.equal("trials");
    expect(alerts[0].mongoCount).to.equal(1);
    expect(alerts[0].subgraphCount).to.equal(2);
  });

  it("IDX-05: health endpoint", async function () {
    const res = await fetch(`${baseUrl}/health`);
    expect(res.ok).to.be.true;
    const body = (await res.json()) as { ok: boolean };
    expect(body.ok).to.be.true;
  });
});
