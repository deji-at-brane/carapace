import nacl from 'tweetnacl';

/**
 * Hermes Identity & Cryptography Manager
 * Manages the Ed25519 keypair for the Carapace Terminal.
 * Uses URL-Safe Base64 (RFC 4648) for compatibility with MiroFish gateways.
 */
export class IdentityManager {
  private static STORAGE_KEY = 'carapace_terminal_identity';

  private static toUrlSafe(base64: string) {
    return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }

  /**
   * Get or generate the terminal's identity keypair.
   */
  static getIdentity() {
    const stored = localStorage.getItem(this.STORAGE_KEY);
    let secretKey: Uint8Array;

    if (stored) {
      secretKey = new Uint8Array(JSON.parse(stored));
    } else {
      console.log("[IDENTITY] Generating permanent Ed25519 terminal identity.");
      const keypair = nacl.sign.keyPair();
      secretKey = keypair.secretKey;
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(Array.from(secretKey)));
    }

    const keypair = nacl.sign.keyPair.fromSecretKey(secretKey);
    const publicKey = keypair.publicKey;
    
    // VERIFIED: OpenClaw v3 requires a SHA-256 fingerprint of the public key as the device identity.
    // This is more stable than using raw keys directly across different protocol versions.
    const publicKeyBase64 = btoa(String.fromCharCode(...publicKey));
    const urlSafePublic = this.toUrlSafe(publicKeyBase64);
    
    return {
      // Note: Full deviceId calculation is moved to async signChallenge for SHA-256 compatibility
      publicKey: urlSafePublic,
      secretKey: keypair.secretKey,
      keypair,
      rawPublicKey: publicKey
    };
  }

  /**
   * Helper to hash a Uint8Array with SHA-256 and return Hex.
   */
  public static async sha256Hex(data: Uint8Array): Promise<string> {
    // Slicing Ensures we have a fresh 32-byte ArrayBuffer, not a view into a 64-byte secret key buffer
    const hashBuffer = await crypto.subtle.digest('SHA-256', data.slice().buffer);
    return Array.from(new Uint8Array(hashBuffer))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('')
      .toLowerCase();
  }

  private static publicKeyToBase64(publicKey: Uint8Array) {
    const b64 = btoa(String.fromCharCode(...publicKey));
    return this.toUrlSafe(b64);
  }

  /**
   * Generates a signed challenge response for the Gateway Handshake.
   */
  static async signChallenge(
    nonce: string, 
    ts: number, 
    token: string,
    client: { id: string, mode: string, platform: string, role?: string }
  ) {
    const identity = this.getIdentity();
    const deviceId = await this.sha256Hex(identity.rawPublicKey);
    
    const role = client.role || 'client'; // Default to 'client' for traditional pairing

    // v3 Standard Signature Payload (Must match the transmitted client object exactly)
    // format: v3|deviceId|clientId|clientMode|role|scopes|signedAt|token|nonce|platform|deviceFamily
    const payload = `v3|${deviceId}|${client.id}|${client.mode}|${role}||${ts}|${token}|${nonce}|${client.platform}|desktop`;
    
    console.log("[IDENTITY] Signing Proof:", payload);
    
    const encoder = new TextEncoder();
    const message = encoder.encode(payload);
    const signatureRaw = nacl.sign.detached(message, identity.secretKey);
    const signatureBase64 = this.toUrlSafe(btoa(String.fromCharCode(...signatureRaw)));
    
    return {
      id: deviceId, // Correct key 'id' as per SKILL.md
      publicKey: this.publicKeyToBase64(identity.rawPublicKey),
      signature: signatureBase64,
      signedAt: ts,
      nonce: nonce
    };
  }
}
