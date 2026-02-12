import { NextResponse } from "next/server";

export const runtime = "nodejs";

const NOVA_AUTH_URL = "https://nova-sdk.com";
const NOVA_MCP_URL = "https://nova-mcp.fastmcp.app";
const GROUP_NAME = "sentinel-hackathon-test";

let tokenCache: { token: string; expiresAt: number } | null = null;

async function getSessionToken(): Promise<string> {
    const accountId = process.env.NEXT_PUBLIC_NOVA_ACCOUNT_ID;
    const apiKey = process.env.NEXT_PUBLIC_NOVA_API_KEY;

    if (!accountId || !apiKey) {
        throw new Error("NOVA Config missing");
    }

    if (tokenCache && tokenCache.expiresAt > Date.now() + 5 * 60 * 1000) {
        return tokenCache.token;
    }

    const res = await fetch(`${NOVA_AUTH_URL}/api/auth/session-token`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "X-API-Key": apiKey,
        },
        body: JSON.stringify({ account_id: accountId }),
    });

    if (!res.ok) {
        const errBody = await res.text();
        throw new Error(`Auth failed (${res.status}): ${errBody}`);
    }

    const { token, expires_in } = await res.json();
    if (!token) throw new Error("No token in auth response");

    const match = (expires_in || "24h").match(/^(\d+)([hmd])$/);
    const expiresMs = match
        ? parseInt(match[1]) * (match[2] === "h" ? 3600000 : match[2] === "m" ? 60000 : 86400000)
        : 23 * 3600000;

    tokenCache = { token, expiresAt: Date.now() + expiresMs };
    return token;
}

async function callMcpTool(toolName: string, args: Record<string, string>) {
    const token = await getSessionToken();
    const accountId = process.env.NEXT_PUBLIC_NOVA_ACCOUNT_ID!;

    const res = await fetch(`${NOVA_MCP_URL}/tools/${toolName}`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
            "X-Account-Id": accountId,
        },
        body: JSON.stringify(args),
    });

    if (!res.ok) {
        const errBody = await res.text();
        throw new Error(`MCP ${toolName} (${res.status}): ${errBody}`);
    }

    return res.json();
}

async function callMcpEndpoint(endpoint: string, body: Record<string, string>) {
    const token = await getSessionToken();
    const accountId = process.env.NEXT_PUBLIC_NOVA_ACCOUNT_ID!;

    const res = await fetch(`${NOVA_MCP_URL}${endpoint}`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
            "X-Account-Id": accountId,
        },
        body: JSON.stringify(body),
    });

    if (!res.ok) {
        const errBody = await res.text();
        throw new Error(`MCP endpoint ${endpoint} (${res.status}): ${errBody}`);
    }

    return res.json();
}

async function encryptData(data: Buffer, keyB64: string): Promise<string> {
    const crypto = await import("crypto");
    const keyBytes = Buffer.from(keyB64, "base64");
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv("aes-256-gcm", keyBytes, iv);
    const encrypted = Buffer.concat([cipher.update(data), cipher.final()]);
    const authTag = cipher.getAuthTag();
    return Buffer.concat([iv, encrypted, authTag]).toString("base64");
}

async function computeSha256(data: Buffer): Promise<string> {
    const crypto = await import("crypto");
    return crypto.createHash("sha256").update(data).digest("hex");
}

export async function POST(request: Request) {
    const steps: string[] = [];

    try {
        const body = await request.json();
        const { data } = body;
        steps.push("1_parsed_body");

        if (!data || typeof data !== "string") {
            return NextResponse.json({ error: "Missing data field", steps }, { status: 400 });
        }

        const rawBuffer = Buffer.from(data, "utf-8");
        steps.push("2_buffer_created");

        // Step 1: Register group
        try {
            await callMcpTool("register_group", { group_id: GROUP_NAME });
            steps.push("3_group_registered");
        } catch {
            steps.push("3_group_exists_ok");
        }

        // Step 2: prepare_upload
        const prepareResult = await callMcpTool("prepare_upload", {
            group_id: GROUP_NAME,
            filename: `sentinel_${Date.now()}.enc`,
        });
        steps.push("4_prepare_upload_ok");

        const { upload_id, key } = prepareResult;
        if (!upload_id || !key) {
            return NextResponse.json(
                { error: "prepare_upload returned no upload_id or key", prepareResult, steps },
                { status: 500 }
            );
        }
        steps.push("5_got_upload_id_and_key");

        // Step 3: Encrypt
        const encryptedB64 = await encryptData(rawBuffer, key);
        steps.push("6_encrypted");

        // Step 4: Hash
        const fileHash = await computeSha256(rawBuffer);
        steps.push("7_hashed");

        // Step 5: Finalize
        const finalizeResult = await callMcpEndpoint("/api/finalize-upload", {
            upload_id,
            encrypted_data: encryptedB64,
            file_hash: fileHash,
        });
        steps.push("8_finalized");

        if (!finalizeResult?.cid) {
            return NextResponse.json(
                { error: "finalize_upload returned no CID", finalizeResult, steps },
                { status: 500 }
            );
        }

        steps.push("9_done");
        return NextResponse.json({ cid: finalizeResult.cid, steps });
    } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        return NextResponse.json({ error: message, steps }, { status: 500 });
    }
}
