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
      try {
        secretKey = new Uint8Array(JSON.parse(stored));
        // Reset if this is a legacy identity
        if (secretKey.length !== 64) {
          localStorage.removeItem(this.STORAGE_KEY);
          return this.getIdentity(); 
        }
      } catch (e) {
        localStorage.removeItem(this.STORAGE_KEY);
        return this.getIdentity();
      }
    } else {
      console.log("[IDENTITY] Generating permanent terminal identity.");
      const keypair = nacl.sign.keyPair();
      secretKey = keypair.secretKey;
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(Array.from(secretKey)));
    }

    const keypair = nacl.sign.keyPair.fromSecretKey(secretKey);
    const publicKey = keypair.publicKey;
    
    // VERIFIED: OpenClaw v3 requires a SHA-256 fingerprint of the public key as the device identity.
    const publicKeyBase64 = btoa(String.fromCharCode(...publicKey));
    const urlSafePublic = this.toUrlSafe(publicKeyBase64);
    
    return {
      publicKey: urlSafePublic,
      secretKey: keypair.secretKey,
      keypair,
      rawPublicKey: publicKey
    };
  }

  /**
   * Helper to generate a Lowercase Hex SHA-256 Fingerprint.
   * VERIFIED: SKILL.md strictly requires Hex-encoded fingerprints for OpenClaw v3.
   */
  public static async sha256Fingerprint(data: Uint8Array): Promise<string> {
    const hashBuffer = await crypto.subtle.digest('SHA-256', data.slice().buffer);
    return Array.from(new Uint8Array(hashBuffer))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('')
      .toLowerCase();
  }

  /**
   * Legacy Hex helper (maintained for pulse logs if needed)
   */
  public static async sha256Hex(data: Uint8Array): Promise<string> {
    return this.sha256Fingerprint(data);
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
    const deviceId = await this.sha256Fingerprint(identity.rawPublicKey);
    
    const role = client.role || 'client'; // Default to 'client' for traditional pairing

    // v3 Standard Signature Payload (Must match protocol grounding)
    // format: v3|deviceId|clientId|clientMode|role|scopes|signedAtMs|token|nonce|platform|deviceFamily
    const payload = [
      'v3',
      deviceId,
      client.id,
      client.mode,
      role,
      '', // scopes (empty)
      ts.toString(),
      token,
      nonce,
      client.platform,
      'desktop' // deviceFamily
    ].join('|');
    
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
