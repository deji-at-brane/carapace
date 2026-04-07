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
    
    // VERIFIED: OpenClaw requires the deviceId to be a stable fingerprint of the public key
    // We use the hex-encoded public key as the primary identifier (aligned with Hermes v3)
    const deviceId = Array.from(publicKey as Uint8Array)
      .map((b: number) => b.toString(16).padStart(2, '0'))
      .join('');

    const publicKeyBase64 = btoa(String.fromCharCode(...publicKey));
    const urlSafePublic = this.toUrlSafe(publicKeyBase64);
    
    return {
      deviceId, 
      publicKey: urlSafePublic,
      secretKey: keypair.secretKey,
      keypair,
      rawPublicKey: publicKey
    };
  }

  /**
   * Helper to hash a Uint8Array with SHA-256 and return Hex.
   */
  private static async sha256Hex(data: Uint8Array): Promise<string> {
    const hashBuffer = await crypto.subtle.digest('SHA-256', data.buffer as ArrayBuffer);
    return Array.from(new Uint8Array(hashBuffer))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }

  private static publicKeyToBase64(publicKey: Uint8Array) {
    return btoa(String.fromCharCode(...publicKey));
  }

  /**
   * Generates a signed challenge response for the Gateway Handshake.
   */
  static async signChallenge(nonce: string, ts: number, token: string = '') {
    const identity = this.getIdentity();
    const deviceId = await this.sha256Hex(identity.rawPublicKey);
    
    const platform = 'macos';
    const deviceFamily = 'desktop';
    const clientId = 'openclaw-macos'; // Standard Gateway Constant
    const clientMode = 'cli';
    const signedAt = ts.toString();
    
    // The standard Hermes v3 signing payload (Generic Alignment)
    const payload = [
      'v3',
      deviceId,
      clientId,       // Corrected to use the whitelist constant
      clientMode,     // Corrected to use the whitelist constant
      'operator',     // role
      '',             // scopes (usually empty for initial pairing)
      signedAt,       // timestamp
      token,          // token matching the session authorization
      nonce,          // nonce
      platform,
      deviceFamily
    ].join('|');

    console.log("[IDENTITY] Signing payload:", payload);
    
    const encoder = new TextEncoder();
    const message = encoder.encode(payload);
    const signatureRaw = nacl.sign.detached(message, identity.secretKey);
    const signatureBase64 = btoa(String.fromCharCode(...signatureRaw));

    return {
      id: deviceId,
      publicKey: this.publicKeyToBase64(identity.rawPublicKey),
      signature: signatureBase64,
      signedAt: ts, // Corrected from 'ts' to 'signedAt' per Gateway validation error
      nonce: nonce
    };
  }
}
