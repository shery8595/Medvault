import { ethers } from "ethers";
import type { BaseContract } from "ethers";

const LEGACY_DAL_ABI = [
    "function setAuthorizedLogger(address _logger, bool _status) external",
    "function isAuthorizedLogger(address) view returns (bool)",
];

const TIMELOCK_DAL_ABI = [
    "function scheduleAuthorizedLogger(address _logger, bool _status) external",
    "function applyAuthorizedLogger(address _logger) external",
    "function isAuthorizedLogger(address) view returns (bool)",
    "function loggerChangeEta(address) view returns (uint256)",
    "function pendingLoggerChanges(address) view returns (bool)",
    "function LOGGER_CHANGE_DELAY() view returns (uint256)",
];

async function usesTimelockDal(dalAddress: string, runner: BaseContract["runner"]): Promise<boolean> {
    const probe = new ethers.Contract(dalAddress, TIMELOCK_DAL_ABI, runner);
    try {
        await probe.LOGGER_CHANGE_DELAY.staticCall();
        return true;
    } catch {
        return false;
    }
}

/** Authorize or deauthorize a DataAccessLog logger (legacy instant or timelocked). */
export async function ensureDataAccessLogger(
    dataAccessLog: BaseContract,
    logger: string,
    status: boolean
): Promise<void> {
    const dalAddress = await dataAccessLog.getAddress();
    const runner = dataAccessLog.runner;
    if (!runner) throw new Error("DataAccessLog runner unavailable");

    const timelock = await usesTimelockDal(dalAddress, runner);

    if (!timelock) {
        const legacy = new ethers.Contract(dalAddress, LEGACY_DAL_ABI, runner);
        const current = await legacy.isAuthorizedLogger(logger);
        if (current === status) return;
        await (await legacy.setAuthorizedLogger(logger, status)).wait();
        return;
    }

    const dal = new ethers.Contract(dalAddress, TIMELOCK_DAL_ABI, runner);
    const current = await dal.isAuthorizedLogger(logger);
    if (current === status) return;

    const eta = await dal.loggerChangeEta(logger);
    const pending = await dal.pendingLoggerChanges(logger);
    const now = BigInt(Math.floor(Date.now() / 1000));

    if (eta > 0n && now >= eta && pending === status) {
        try {
            await (await dal.applyAuthorizedLogger(logger)).wait();
            return;
        } catch {
            /* fall through */
        }
    }

    await (await dal.scheduleAuthorizedLogger(logger, status)).wait();
    const newEta = await dal.loggerChangeEta(logger);
    if (newEta > 0n && now >= newEta) {
        await (await dal.applyAuthorizedLogger(logger)).wait();
        return;
    }

    const waitSecs = Number(newEta - now);
    const days = (waitSecs / 86400).toFixed(1);
    console.warn(
        `  DAL logger ${logger} → ${status}: scheduled; apply after ~${days}d (re-run finish script)`
    );
}
