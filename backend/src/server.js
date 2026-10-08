import { config } from './config.js';
import { createApp } from './app.js';
import { JsonUserRepository } from './repositories/jsonUserRepository.js';

const userRepository = new JsonUserRepository(config.dataFile);
const app = createApp({ userRepository, corsOrigin: config.corsOrigin });

// Express passes listen errors, such as a port already in use, to this callback.
app.listen(config.port, (err) => {
  if (err) {
    console.error(`Cannot start server on port ${config.port}: ${err.message}`);
    process.exit(1);
    return;
  }

  console.log(`Server listening on http://localhost:${config.port}`);
});
