export const ETHEREUM_SEPOLIA_CHAIN_ID = 11155111;
export const HARDHAT_CHAIN_ID = 31337;

export const TRIAL_DURATION_SEC = 7 * 24 * 60 * 60;
export const MAX_TRIAL_DURATION_SEC = 365 * 24 * 60 * 60 * 5;

export const DEFAULT_TRIAL_PARAMS = {
    name: "MedVault Test Trial",
    phase: "Phase II",
    location: "Remote",
    compensation: "1000 USDC",
    minAge: 18,
    maxAge: 65,
    requiresDiabetes: false,
    minHb: 120,
    genderReq: 0,
    minHeight: 0,
    maxWeight: 0,
    requiresNonSmoker: false,
    requiresNormalBP: false,
    duration: TRIAL_DURATION_SEC,
} as const;

export const WETH_GATEWAY_SEPOLIA = "0x20040a64612555042335926d72B4E5F667a67fA1";
export const AWETH_SEPOLIA = "0xf5f17EbE81E516Dc7cB38D61908EC252F150CE60";
export const AAVE_POOL_SEPOLIA = "0xBfC91D59fdAA134A4ED45f7B584cAf96D7792Eff";

export const CET_MIN_DEPOSIT_WEI = 1_000_000_000_000n;
