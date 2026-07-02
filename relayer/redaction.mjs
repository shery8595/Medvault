/**
 * Relayer log redaction — no PHI or full ciphertext handles in stdout.
 * Mirrors ai-service/src/redaction.ts discipline for off-chain services.
 */

const EMAIL = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g;
const PHONE = /(?:\+?1[-.\s]?)?(?:\(?\d{3}\)?[-.\s]?){2}\d{4}\b/g;
const SSN = /\b\d{3}-\d{2}-\d{4}\b/g;
const LONG_HEX = /\b0x[a-fA-F0-9]{40,}\b/g;
const BASE64_BLOB = /\b[A-Za-z0-9+/]{80,}={0,2}\b/g;

/**
 * @param {unknown} value
 * @returns {string}
 */
export function redactForLog(value) {
    if (value == null) return String(value);
    let text = typeof value === "string" ? value : JSON.stringify(value);
    text = text.replace(EMAIL, "[REDACTED_EMAIL]");
    text = text.replace(PHONE, "[REDACTED_PHONE]");
    text = text.replace(SSN, "[REDACTED_SSN]");
    text = text.replace(BASE64_BLOB, "[REDACTED_BLOB]");
    text = text.replace(LONG_HEX, (m) => `${m.slice(0, 10)}…${m.slice(-4)}`);
    return text;
}

/**
 * @param {string} label
 * @param {unknown} detail
 */
export function safeLog(label, detail) {
    if (detail === undefined) {
        console.log(redactForLog(label));
        return;
    }
    console.log(redactForLog(label), redactForLog(detail));
}

/**
 * @param {string} label
 * @param {unknown} detail
 */
export function safeError(label, detail) {
    if (detail === undefined) {
        console.error(redactForLog(label));
        return;
    }
    console.error(redactForLog(label), redactForLog(detail));
}
