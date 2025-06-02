import fs from 'node:fs/promises';

export async function checkPathExists(path: string): Promise<boolean> {
  try {
    await fs.access(path);
    return true; // Path exists and is accessible
  } catch (error) {
    return false; // Path does not exist or is not accessible
  }
}
