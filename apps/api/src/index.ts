import { config } from './config.js';
import { createMastraMissionGenerator } from './missions.js';
import { FileRepository } from './repository.js';
import { buildServer } from './server.js';

const repository = await FileRepository.create(config.localDataFile);
const app = await buildServer(config, repository, createMastraMissionGenerator(config));
try {
  await app.listen({ host: '127.0.0.1', port: config.port });
  console.log(`SideQuest API listening on http://127.0.0.1:${config.port}`);
} catch (error) {
  app.log.error(error);
  process.exit(1);
}
