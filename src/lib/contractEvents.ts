import { ethers } from "ethers";

/** Parse a single argument from a contract log in a transaction receipt. */
export function parseEventArg(
    receipt: ethers.TransactionReceipt,
    contractInterface: ethers.Interface,
    contractAddress: string,
    eventName: string,
    argName: string
): string {
    const target = contractAddress.toLowerCase();
    for (const log of receipt.logs) {
        if (!log.address || log.address.toLowerCase() !== target) continue;
        try {
            const parsed = contractInterface.parseLog({
                topics: log.topics as string[],
                data: log.data,
            });
            if (parsed?.name === eventName) {
                const val = parsed.args[argName];
                if (typeof val === "string") return val;
                if (typeof val === "bigint") return ethers.toBeHex(val, 32);
            }
        } catch {
            /* not this log */
        }
    }
    throw new Error(`Event ${eventName}.${argName} not found in receipt`);
}
