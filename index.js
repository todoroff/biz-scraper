require("dotenv").config();
const {
  transformPages,
  fetchPages,
  calculateNewPosts,
  getNewThreadIds,
  fetchThreadDetails,
} = require("./threads");
const utils = require("./utils");
const logger = require("./logger");
const mongoose = require("mongoose");
require("./connectDb")();

/**
 * collectData:
 * - fetch threads
 * - calculate new posts
 *
 * @async
 * @generator
 * @function collectData
 * @param {Object} prevThreads - Object with threads from previous cycle
 * @return {Promise.<Object>} Object with threads from current cycle
 */

async function collectData(prevThreads) {
  const currentThreads = transformPages(await fetchPages());
  console.log("New Posts: " + calculateNewPosts(prevThreads, currentThreads));
  const newThreads = getNewThreadIds(prevThreads, currentThreads);
  console.log("New threads: " + newThreads.length);
  console.log(newThreads);
  if (newThreads.length > 0) {
    for (thread of newThreads) {
      console.log((await fetchThreadDetails(thread)).posts[0].tim);
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
 * @function nextCycle
 * @return {Object} Iterator
 */

async function* nextCycle() {
  // init values
  const initThreads = transformPages(await fetchPages());
  var prevThreads = initThreads;
  var lastCycleStart = Date.now();

  while (true) {
    await utils.wait(process.env.CYCLE_TIME - (Date.now() - lastCycleStart));
    lastCycleStart = Date.now();
    try {
      let currentThreads = await collectData(prevThreads);
      prevThreads = currentThreads;
    } catch (e) {
      utils.handleError(e);
      // reset lastCycleStart, so we wait only 5000 instead of given miliseconds
      // before the next cycle is run
      lastCycleStart = Date.now() - (process.env.CYCLE_TIME - 5000);
    }

    yield;
  }
}

/**
 * Cycle runner
 * Start running the cycle
 *
 * @async
 * @generator
 * @function start
 * @return {Object} Iterator
 */

async function start(retryTimeOut = 5000) {
  try {
    for await (cycle of nextCycle()) {
    }
  } catch (e) {
    utils.handleError(e);
    logger.info({ message: `Retry in ${retryTimeOut}ms` });
    await utils.wait(retryTimeOut);
    return start(retryTimeOut);
  }
}

/**
 * Main process
 *
 * @async
 * @function main
 * @param {number} retryTimeOut - Wait time in ms before retrying after an error
 */

async function main() {
  logger.info({ message: "Start process" });
  start();

  process.on("SIGINT", function () {
    mongoose.connection.close(function () {
      logger.info({ message: "Disconnect DB" });
      logger.info({ message: "End process" });
      process.exit(0);
    });
  });
}

main();
