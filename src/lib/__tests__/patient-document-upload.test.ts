import { describe, expect, it, vi, beforeEach } from "vitest";
import { ethers } from "ethers";
import {
  docCidHashField,
  aesKeyCtHashFromPayload,
  buildDocumentBindingFromFheChunks,
} from "../documentBindingHelpers";
import type { EncryptedPayload } from "../crypto-utils";

describe("documentBindingHelpers", () => {
  it("computes stable cid and payload hashes", () => {
    const cid = "QmTestCid123";
    const payload: EncryptedPayload = {
      v: 1,
      alg: "AES-256-GCM",
      iv: "aaaa",
      data: "bbbb",
    };
    const cidField = docCidHashField(cid);
    const ctHash = aesKeyCtHashFromPayload(payload);
    expect(cidField).toBeTypeOf("bigint");
    expect(ctHash).toMatch(/^0x[0-9a-f]{64}$/i);
    expect(docCidHashField(cid)).toBe(cidField);
  });

  it("builds document binding from FHE chunk handles", () => {
    const binding = buildDocumentBindingFromFheChunks(
      "QmHybrid",
      ethers.toBeHex(42n, 32),
      {
        inputProof: "0x" + "11".repeat(32),
        chunks: [
          { handle: "0x" + "01".repeat(32), inputProof: "0x" + "11".repeat(32) },
          { handle: "0x" + "02".repeat(32), inputProof: "0x" + "11".repeat(32) },
          { handle: "0x" + "03".repeat(32), inputProof: "0x" + "11".repeat(32) },
          { handle: "0x" + "04".repeat(32), inputProof: "0x" + "11".repeat(32) },
        ],
      }
    );
    expect(binding.hasDocument).toBe(true);
    expect(binding.aesKeyFheHandleHashes).toHaveLength(4);
    expect(binding.docCidHash).toBeTypeOf("bigint");
  });
});

describe("patientDocumentUpload (mocked pin)", () => {
  const store = new Map<string, string>();

  beforeEach(() => {
    vi.resetModules();
    store.clear();
    vi.stubGlobal("sessionStorage", {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => {
        store.set(k, v);
      },
      removeItem: (k: string) => {
        store.delete(k);
      },
      clear: () => store.clear(),
    });
  });

  it("prepareHybridDocumentUpload stores pending doc", async () => {
    vi.doMock("../ipfs", () => ({
      pinToIpfs: vi.fn(async () => "QmMockCid"),
    }));
    vi.doMock("../EncryptionService", async () => {
      const actual = await vi.importActual<typeof import("../EncryptionService")>(
        "../EncryptionService"
      );
      return {
        ...actual,
        generateKey: () => new Uint8Array(32).fill(7),
        encryptDocument: vi.fn(async () => ({
          v: 1,
          alg: "AES-256-GCM",
          iv: "iv",
          data: "data",
        })),
      };
    });
    const { prepareHybridDocumentUpload } = await import("../patientDocumentUpload");
    const { getPendingHybridDocument } = await import("../pendingHybridDocument");
    const file = new Uint8Array([1, 2, 3]);
    const prepared = await prepareHybridDocumentUpload(file, 99, "lab.pdf");
    expect(prepared.cid).toBe("QmMockCid");
    const pending = getPendingHybridDocument(99);
    expect(pending?.filename).toBe("lab.pdf");
    expect(pending?.cid).toBe("QmMockCid");
  });
});
