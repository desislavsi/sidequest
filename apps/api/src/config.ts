import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { config as loadEnv } from 'dotenv';

const root = fileURLToPath(new URL('../../../', import.meta.url));
loadEnv({ path: resolve(root, '.env') });

export type AppConfig = {
  port: number;
  webOrigin: string;
  localDataFile: string;
  ollamaBaseUrl: string;
  ollamaModel: string;
};

export const config: AppConfig = {
  port: Number(process.env.PORT ?? 3225),
  webOrigin: process.env.WEB_ORIGIN ?? 'http://127.0.0.1:5174',
  localDataFile: resolve(root, process.env.LOCAL_DATA_FILE ?? '.data/sidequest.json'),
  ollamaBaseUrl: process.env.OLLAMA_BASE_URL ?? 'http://127.0.0.1:11434',
  ollamaModel: process.env.OLLAMA_MODEL ?? 'gemma4:e4b',
};
