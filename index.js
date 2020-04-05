const {
  transformPages,
  fetchPages,
  calculateNewPosts,
  getNewThreadIds,
} = require("./threads");
const utils = require("./utils");
const logger = require("./logger");

/**
 * Cycle generator
 *
 * @async
 * @generator
 * @function runCycle
 * @param {Object} prevThreads - Object with threads from previous cycle
 * @param {number} miliseconds - time in ms to pass to {@link module:threads~fetchPages fetchPages}
 * @return {Promise.<Object>} Object with threads from current cycle
 */

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

/**
 * Main process
 *
 * @async
 * @function main
 * @param {number} miliseconds - How often to run a cycle in ms
 * @param {number} retryTimeOut - Wait time in ms before retrying after an error
 */

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

main(60000, 5000);
