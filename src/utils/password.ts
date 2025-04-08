import bcrypt from "bcryptjs";

/**
 * Hash a password using bcrypt
 *
 * @param password The plain text password to hash
 * @returns The hashed password
 */
export const hashPassword = async (password: string): Promise<string> => {
  const saltRounds = 10;
  return bcrypt.hash(password, saltRounds);
};

/**
 * Compare a plain text password with a hashed password
 *
 * @param password The plain text password to check
 * @param hashedPassword The hashed password to compare against
 * @returns Boolean indicating if the passwords match
 */
export const comparePasswords = async (
  password: string,
  hashedPassword: string
): Promise<boolean> => {
  return bcrypt.compare(password, hashedPassword);
};
/**
 * Generate a secure random password
 *
 * @param length The length of the password to generate
 * @returns A random password
 */
export const generateRandomPassword = (length = 12): string => {
  const charset =
    "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()_-+=<>?";
  let password = "";

  for (let i = 0; i < length; i++) {
    const randomIndex = Math.floor(Math.random() * charset.length);
    password += charset[randomIndex];
  }

  return password;
};

export default {
  hashPassword,
  comparePasswords,
  generateRandomPassword,
};
