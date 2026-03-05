export const BF_COUNTRY_CODE = "+226";
export const BF_LOCAL_NUMBER_LENGTH = 8;

const BF_E164_REGEX = /^\+226\d{8}$/;

function cleanPhoneInput(value: string) {
  return value.replace(/[\s\-\.\(\)]/g, "");
}

export function normalizeBurkinaLocalNumber(value: string) {
  const digitsOnly = value.replace(/\D/g, "");
  const localPart = digitsOnly.startsWith("226") ? digitsOnly.slice(3) : digitsOnly;
  return localPart.slice(0, BF_LOCAL_NUMBER_LENGTH);
}

export function normalizeBurkinaPhone(value: string) {
  const cleaned = cleanPhoneInput(value);
  if (!cleaned) {
    return null;
  }

  let candidate = cleaned;

  if (/^\d{8}$/.test(candidate)) {
    candidate = `${BF_COUNTRY_CODE}${candidate}`;
  } else if (/^226\d{8}$/.test(candidate)) {
    candidate = `+${candidate}`;
  }

  if (!BF_E164_REGEX.test(candidate)) {
    return null;
  }

  return candidate;
}

export function isValidBurkinaPhone(value: string) {
  return normalizeBurkinaPhone(value) !== null;
}

export function formatBurkinaPhone(value: string) {
  const normalized = normalizeBurkinaPhone(value);
  if (!normalized) {
    return value;
  }

  const local = normalized.slice(BF_COUNTRY_CODE.length + 1);
  return `${BF_COUNTRY_CODE} ${local.slice(0, 2)} ${local.slice(2, 4)} ${local.slice(4, 6)} ${local.slice(6, 8)}`;
}

export function toWhatsAppPhone(value: string) {
  const normalized = normalizeBurkinaPhone(value);
  return normalized ? normalized.slice(1) : value.replace(/\D/g, "");
}
