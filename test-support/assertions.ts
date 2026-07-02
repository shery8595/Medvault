import { expect } from "chai";

function fragmentToCustomErrorName(fragment: string): string {
    return fragment
        .replace(/[^a-zA-Z0-9 ]/g, "")
        .split(/\s+/)
        .filter(Boolean)
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join("");
}

export async function expectRevert(
    promise: Promise<unknown>,
    fragment?: string | RegExp
): Promise<void> {
    try {
        await promise;
        expect.fail("Expected transaction to revert");
    } catch (err: unknown) {
        const message =
            err && typeof err === "object" && "message" in err
                ? String((err as { message: string }).message)
                : String(err);
        if (fragment) {
            if (typeof fragment === "string") {
                const customError = fragmentToCustomErrorName(fragment);
                expect(
                    message.includes(fragment) ||
                        message.includes(customError) ||
                        message.toLowerCase().includes(fragment.toLowerCase())
                ).to.equal(true);
            } else {
                expect(message).to.match(fragment);
            }
        }
    }
}
