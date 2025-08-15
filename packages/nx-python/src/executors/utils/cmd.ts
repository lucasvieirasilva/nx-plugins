import type { SpawnSyncOptions } from 'child_process';
import { spawn } from 'child_process';

export type SpawnPromiseResult = {
  success: boolean;
  code: number | null;
  output: string;
};

export const spawnPromise = function (
  command: string,
  cwd: string,
  envVars?: Record<string, string | undefined>,
  output = true,
): Promise<SpawnPromiseResult> {
  return new Promise((resolve, reject) => {
    console.log(`Running command: ${command}`);
    const env: Record<string, string> = {
      ...process.env,
      ...(envVars ?? {}),
      ...(output ? { FORCE_COLOR: 'true' } : {}),
    };

    const args: SpawnSyncOptions = {
      cwd,
      shell: true,
      stdio: output ? ['inherit', 'pipe', 'pipe'] : 'inherit',
      env,
    };

    const child = spawn(command, args);
    let outputStr = '';

    if (output) {
      child.stdout?.on('data', (data) => {
        process.stdout.write(data);
        outputStr += data;
      });

      child.stderr?.on('data', (data) => {
        process.stderr.write(data);
        outputStr += data;
      });
    }

    child.on('close', (code) => {
      const result = {
        success: code === 0,
        code,
        output: outputStr,
      };

      if (code === 0) {
        resolve(result);
      } else {
        reject(result);
      }
    });
  });
};
