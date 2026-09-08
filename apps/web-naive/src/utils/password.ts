const MIN_PASSWORD_CHARACTERS = 12;
const MAX_PASSWORD_BYTES = 72;

export function isPasswordWithinByteLimit(password: string) {
  // bcrypt limits UTF-8 bytes; JavaScript string.length counts UTF-16 units.
  return new TextEncoder().encode(password).length <= MAX_PASSWORD_BYTES;
}

export function isValidNewPassword(password: string) {
  return (
    [...password].length >= MIN_PASSWORD_CHARACTERS &&
    isPasswordWithinByteLimit(password)
  );
}
