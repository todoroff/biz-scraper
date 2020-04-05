const {
  transformPages,
  fetchPages,
  calculateNewPosts,
  getNewThreadIds,
} = require("./threads");
const utils = require("./utils");
const path = require("path");
const winston = require("winston");

const logger = winston.createLogger({
  level: "info",
  format: winston.format.json(),
  transports: [
    new winston.transports.File({
      filename: path.resolve("logs", "error.log"),
      level: "error",
    }),
    new winston.transports.File({ filename: path.resolve("logs", "combined.log") }),
  ],
});

if (process.env.NODE_ENV !== "production") {
  logger.add(
    new winston.transports.Console({
      format: winston.format.simple(),
    })
  );
}

async function runCycle(prevThreads, miliseconds) {
  const currentThreads = transformPages(await fetchPages(miliseconds));
  console.log("New Posts: " + calculateNewPosts(prevThreads, currentThreads));
  console.log("New threads: " + getNewThreadIds(prevThreads, currentThreads).length);
  console.log(getNewThreadIds(prevThreads, currentThreads));
  return { ...currentThreads };
}

async function runCycle(prevThreads, miliseconds) {
  const currentThreads = transformPages(await fetchPages(miliseconds));
  console.log("New Posts: " + calculateNewPosts(prevThreads, currentThreads));
  console.log("New threads: " + getNewThreadIds(prevThreads, currentThreads).length);
  console.log(getNewThreadIds(prevThreads, currentThreads));
  return { ...currentThreads };
}

/**
 * Cycle generator
 *
 * @async
 * @generator
 * @function start
 * @param {number} miliseconds - How often to run a cycle in ms
 * @return {Object} Iterator
 */

async function* start(miliseconds) {
  const initThreads = transformPages(await fetchPages(miliseconds));
  var prevThreads = initThreads;
  var lastCycleStart = Date.now();

  while (true) {
    await utils.wait(miliseconds - (Date.now() - lastCycleStart));
    lastCycleStart = Date.now();
    try {
      prevThreads = await runCycle(prevThreads, miliseconds);
    } catch (e) {
      logger.error({ message: e.message, stack: e.stack });
    }

    yield;
  }
}

async function main(miliseconds, retryTimeOut) {
  try {
    for await (cycle of start(miliseconds)) {
    }
  } catch (e) {
    logger.error({ message: e.message, stack: e.stack });
    logger.info(`Retry in ${retryTimeOut}ms`);
    await utils.wait(retryTimeOut);
    return main(miliseconds, retryTimeOut);
  }
}

main(10000, 5000);
