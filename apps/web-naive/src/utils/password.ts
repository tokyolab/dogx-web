const MIN_PASSWORD_CHARACTERS = 8;
export const MAX_PASSWORD_CHARACTERS = 32;
const MAX_PASSWORD_BYTES = 72;

export function isPasswordWithinByteLimit(password: string) {
  // Login must still accept existing passwords that predate the new policy.
  return new TextEncoder().encode(password).length <= MAX_PASSWORD_BYTES;
}

export function isAllowedPasswordInput(password: string) {
  // Allow empty/incomplete input while typing, but never silently strip chars.
  return !/[^A-Za-z0-9!@#$%^&*()_+\-=]/.test(password);
}

export function getNewPasswordChecks(password: string) {
  const categories = [/[A-Z]/, /[a-z]/, /[0-9]/, /[!@#$%^&*()_+\-=]/];
  return {
    length:
      password.length >= MIN_PASSWORD_CHARACTERS &&
      password.length <= MAX_PASSWORD_CHARACTERS,
    categories:
      categories.filter((category) => category.test(password)).length >= 3,
    characters: password.length > 0 && isAllowedPasswordInput(password),
  };
}

export function isValidNewPassword(password: string) {
  // The checklist and submission validation must use the same policy.
  return Object.values(getNewPasswordChecks(password)).every(Boolean);
}
