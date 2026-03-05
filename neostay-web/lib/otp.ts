import { createHash, createHmac, timingSafeEqual } from "crypto";

export const OTP_STATE_COOKIE = "neostay_otp_state";
export const OTP_TTL_MS = 10 * 60 * 1000; // 10 minutes

interface OtpPayload {
  phone: string;
  codeHash: string;
  expiresAt: number;
}

function getOtpSecret(): string {
  const secret = process.env.OTP_SIGNING_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) {
    throw new Error("OTP_SIGNING_SECRET manquant (ou SUPABASE_SERVICE_ROLE_KEY indisponible)");
  }
  return secret;
}

function hashCode(code: string, secret: string): string {
  return createHash("sha256").update(`${code}:${secret}`).digest("hex");
}

function signPayload(encodedPayload: string, secret: string): string {
  return createHmac("sha256", secret).update(encodedPayload).digest("hex");
}

function safeEqual(a: string, b: string): boolean {
  const aBuffer = Buffer.from(a);
  const bBuffer = Buffer.from(b);
  if (aBuffer.length !== bBuffer.length) return false;
  return timingSafeEqual(aBuffer, bBuffer);
}

export function generateOtpCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export function createOtpStateToken(phone: string, code: string): string {
  const secret = getOtpSecret();
  const payload: OtpPayload = {
    phone,
    codeHash: hashCode(code, secret),
    expiresAt: Date.now() + OTP_TTL_MS,
  };
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = signPayload(encodedPayload, secret);
  return `${encodedPayload}.${signature}`;
}

export function verifyOtpStateToken(
  token: string,
  code: string,
): { valid: boolean; phone?: string; reason?: string } {
  const secret = getOtpSecret();
  const parts = token.split(".");

  if (parts.length !== 2) {
    return { valid: false, reason: "Token OTP invalide" };
  }

  const [encodedPayload, signature] = parts;
  const expectedSignature = signPayload(encodedPayload, secret);

  if (!safeEqual(signature, expectedSignature)) {
    return { valid: false, reason: "Token OTP non valide" };
  }

  let payload: OtpPayload;
  try {
    payload = JSON.parse(
      Buffer.from(encodedPayload, "base64url").toString("utf8"),
    ) as OtpPayload;
  } catch {
    return { valid: false, reason: "Payload OTP invalide" };
  }

  if (!payload.phone || !payload.codeHash || !payload.expiresAt) {
    return { valid: false, reason: "Payload OTP incomplet" };
  }

  if (Date.now() > payload.expiresAt) {
    return { valid: false, reason: "Le code a expiré" };
  }

  const providedCodeHash = hashCode(code, secret);
  if (!safeEqual(payload.codeHash, providedCodeHash)) {
    return { valid: false, reason: "Code incorrect" };
  }

  return { valid: true, phone: payload.phone };
}
