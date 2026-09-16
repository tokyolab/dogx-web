export const MAX_USERNAME_CHARACTERS = 64;

export function isValidUsername(username: string) {
  // Reject forbidden characters explicitly, including a trailing newline.
  return (
    username.length > 0 &&
    username.length <= MAX_USERNAME_CHARACTERS &&
    !/[^A-Za-z0-9-]/.test(username) &&
    !username.startsWith('-') &&
    !username.endsWith('-') &&
    !username.includes('--')
  );
}
