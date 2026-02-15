/**
 * Client-side AES-256-GCM encryption utilities.
 * Uses the Web Crypto API (browser-native, no dependencies).
 *
 * Architecture:
 * - Secret is encrypted IN THE BROWSER before leaving the client.
 * - The server/NOVA only ever sees ciphertext (garbage).
 * - The AES key + IV are stored in the smart contract's secure_payload field.
 * - The contract's reveal_payload() access control determines who can decrypt.
 */

/**
 * Encrypt a plaintext string using AES-256-GCM.
 * Returns base64-encoded ciphertext, key, and IV.
 */
export async function encryptSecret(plaintext: string): Promise<{
    ciphertext: string;
    key: string;
    iv: string;
}> {
    const encoder = new TextEncoder();
    const data = encoder.encode(plaintext);

    // Generate a random 256-bit AES key
    const cryptoKey = await crypto.subtle.generateKey(
        { name: "AES-GCM", length: 256 },
        true, // extractable
        ["encrypt", "decrypt"]
    );

    // Generate a random 12-byte IV (recommended for AES-GCM)
    const iv = crypto.getRandomValues(new Uint8Array(12));

    // Encrypt
    const encrypted = await crypto.subtle.encrypt(
        { name: "AES-GCM", iv },
        cryptoKey,
        data
    );

    // Export the key as raw bytes
    const rawKey = await crypto.subtle.exportKey("raw", cryptoKey);

    return {
        ciphertext: arrayBufferToBase64(encrypted),
        key: arrayBufferToBase64(rawKey),
        iv: arrayBufferToBase64(iv.buffer as ArrayBuffer),
    };
}

/**
 * Decrypt a base64-encoded ciphertext using AES-256-GCM.
 * Requires the base64-encoded key and IV from encryption.
 */
export async function decryptSecret(
    ciphertextB64: string,
    keyB64: string,
    ivB64: string
): Promise<string> {
    const ciphertext = base64ToArrayBuffer(ciphertextB64);
    const rawKey = base64ToArrayBuffer(keyB64);
    const iv = base64ToArrayBuffer(ivB64);

    // Import the raw key
    const cryptoKey = await crypto.subtle.importKey(
        "raw",
        rawKey,
        { name: "AES-GCM", length: 256 },
        false,
        ["decrypt"]
    );

    // Decrypt
    const decrypted = await crypto.subtle.decrypt(
        { name: "AES-GCM", iv },
        cryptoKey,
        ciphertext
    );

    const decoder = new TextDecoder();
    return decoder.decode(decrypted);
}

/**
 * Pack the NOVA CID + encryption metadata into a single string
 * for storage in the smart contract's secure_payload field.
 *
 * Format: "E2E:NOVA:<cid>|KEY:<key>|IV:<iv>"
 * The "E2E:" prefix signals that client-side encryption was used.
 */
export function packE2EPayload(cid: string, key: string, iv: string): string {
    return `E2E:NOVA:${cid}|KEY:${key}|IV:${iv}`;
}

/**
 * Unpack an E2E payload string back into its components.
 * Returns null if the payload is not in E2E format.
 */
export function unpackE2EPayload(payload: string): {
    cid: string;
    key: string;
    iv: string;
} | null {
    if (!payload.startsWith("E2E:NOVA:")) return null;

    const stripped = payload.replace("E2E:NOVA:", "");
    const parts = stripped.split("|");

    const cidPart = parts[0]; // raw CID (no prefix)
    const keyPart = parts.find(p => p.startsWith("KEY:"))?.replace("KEY:", "");
    const ivPart = parts.find(p => p.startsWith("IV:"))?.replace("IV:", "");

    if (!cidPart || !keyPart || !ivPart) return null;

    if (!cidPart || !keyPart || !ivPart) return null;

    return { cid: cidPart, key: keyPart, iv: ivPart };
}

/**
 * Pack the encrypted secret + metadata into a single string
 * for storage in the smart contract's secure_payload field.
 *
 * Format: "E2E:LOCAL:<ciphertext>|KEY:<key>|IV:<iv>"
 * The "E2E:LOCAL:" prefix signals that the data is stored directly in the contract.
 */
export function packE2ELocalPayload(ciphertext: string, key: string, iv: string): string {
    return `E2E:LOCAL:${ciphertext}|KEY:${key}|IV:${iv}`;
}

/**
 * Unpack an E2E:LOCAL payload string back into its components.
 * Returns null if the payload is not in E2E:LOCAL format.
 */
export function unpackE2ELocalPayload(payload: string): {
    ciphertext: string;
    key: string;
    iv: string;
} | null {
    if (!payload.startsWith("E2E:LOCAL:")) return null;

    const stripped = payload.replace("E2E:LOCAL:", "");
    const parts = stripped.split("|");

    const ciphertextPart = parts[0]; // raw ciphertext (no prefix)
    const keyPart = parts.find(p => p.startsWith("KEY:"))?.replace("KEY:", "");
    const ivPart = parts.find(p => p.startsWith("IV:"))?.replace("IV:", "");

    if (!ciphertextPart || !keyPart || !ivPart) return null;

    return { ciphertext: ciphertextPart, key: keyPart, iv: ivPart };
}

// ─── Helper functions ───

function arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = "";
    for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
}
