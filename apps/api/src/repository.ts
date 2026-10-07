import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { snapshotSchema, type Snapshot } from '@sidequest/contracts';

export const exampleProfiles: Snapshot['profiles'] = [
  { id: 'a256eb7b-32c8-4949-a839-0130e12bc380', name: 'Moni', age: 10, interests: ['Gaming', 'Football', 'Exploring'], totalXp: 2600 },
  { id: '9a762609-ad3c-4ff1-a3af-c778ad193304', name: 'Georgi', age: 7, interests: ['Animals', 'Building', 'Puzzles'], totalXp: 650 },
  { id: '7c8f4677-af48-45d6-9c93-4a40934d2845', name: 'Dad', age: 38, interests: ['Photography', 'Nature', 'Maps'], totalXp: 1300 },
];

export class FileRepository {
  private queue: Promise<unknown> = Promise.resolve();
  private constructor(private filePath: string, private data: Snapshot) {}

  static async create(filePath: string) {
    let data: Snapshot;
    try {
      data = snapshotSchema.parse(JSON.parse(await readFile(filePath, 'utf8')));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
      data = { profiles: structuredClone(exampleProfiles), activeMission: null, history: [] };
      await mkdir(dirname(filePath), { recursive: true });
      await writeFile(filePath, JSON.stringify(data, null, 2), 'utf8');
    }
    return new FileRepository(filePath, data);
  }

  snapshot(): Snapshot { return structuredClone(this.data); }

  update<T>(change: (draft: Snapshot) => T): Promise<T> {
    const operation = this.queue.then(async () => {
      const draft = this.snapshot();
      const result = change(draft);
      const valid = snapshotSchema.parse(draft);
      const temporaryPath = `${this.filePath}.${randomUUID()}.tmp`;
      await writeFile(temporaryPath, JSON.stringify(valid, null, 2), 'utf8');
      await rename(temporaryPath, this.filePath);
      this.data = valid;
      return result;
    });
    this.queue = operation.catch(() => undefined);
    return operation;
  }
}
