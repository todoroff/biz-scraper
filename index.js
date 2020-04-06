const {
  transformPages,
  fetchPages,
  calculateNewPosts,
  getNewThreadIds,
  fetchThreadDetails,
} = require("./threads");
const utils = require("./utils");
const logger = require("./logger");

/**
 * Run a single cycle:
 * - fetch threads
 * - calculate new posts
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
  const newThreads = getNewThreadIds(prevThreads, currentThreads);
  console.log("New threads: " + newThreads.length);
  console.log(newThreads);
  if (newThreads.length > 0) {
    for (thread of newThreads) {
      console.log(await fetchThreadDetails(thread));
    }
  }

  return { ...currentThreads };
}

/**
 * Cycle generator
 * Initialize values and start running cycles
 *
 * @async
 * @generator
 * @function start
 * @param {number} miliseconds - How often to run a cycle in ms
 * @return {Object} Iterator
 */

async function* start(miliseconds) {
  // init values
  const initThreads = transformPages(await fetchPages(miliseconds));
  var prevThreads = initThreads;
  var lastCycleStart = Date.now();

  while (true) {
    await utils.wait(miliseconds - (Date.now() - lastCycleStart));
    lastCycleStart = Date.now();
    try {
      let currentThreads = await runCycle(prevThreads, miliseconds);
      prevThreads = currentThreads;
    } catch (e) {
      utils.handleError(e);
      // reset lastCycleStart, so we wait only 5000 instead of given miliseconds
      // before the next cycle is run
      lastCycleStart = Date.now() - (miliseconds - 5000);
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
    utils.handleError(e);
    logger.info(`Retry in ${retryTimeOut}ms`);
    await utils.wait(retryTimeOut);
    return main(miliseconds, retryTimeOut);
  }
}

main(10000, 5000);
