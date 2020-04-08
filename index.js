"use strict";

require("dotenv").config();
const threads = require("./libs/threads");
const utils = require("./utils/misc");
const logger = require("./utils/logger");
const mongoose = require("mongoose");
const connectDb = require("./utils/connectDb");
const images = require("./libs/images");

/**
 * Collect /biz/ data and save to DB
 *
 * @async
 * @function collectData
 * @param {Object} prevThreads - Object with threads from previous cycle
 * @return {Promise.<Object>} Object with threads from current cycle
 */

async function collectData(prevThreads) {
  var result = {};
  const currentThreads = await threads.getCurrentThreads();
  const data = await threads.proc(prevThreads, currentThreads);

  if (data.newImagesDetails.length > 0) {
    images.proc(data.newImagesDetails);
  }

  Object.assign(
    result,
    { currentThreads: { ...currentThreads } },
    { stats: { ...data } }
  );

  console.log("New Replies: ", data.newReplies);
  console.log("New threads: " + data.newThreadIds.length);
  console.log(data.newThreadIds);

  return result;
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
  const initThreads = await threads.getCurrentThreads();
  var prevThreads = initThreads;
  var lastCycleStart = Date.now();

  while (true) {
    await utils.wait(process.env.CYCLE_TIME - (Date.now() - lastCycleStart));
    lastCycleStart = Date.now();
    try {
      let currentThreads = (await collectData(prevThreads)).currentThreads;
      prevThreads = currentThreads;
    } catch (e) {
      utils.handleError(e);
      // reset lastCycleStart, so we wait only 5000 instead of default miliseconds
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
 * @function start
 * @return {Object} Iterator
 */

async function start(retryTimeOut = 5000) {
  try {
    //schedule cleanups
    logger.info("Schedule cleanups");
    setInterval(async () => {
      logger.info("Begin cleanup");
      try {
        await images.cleanUp();
        logger.info("Finished cleanup");
      } catch (e) {
        handleError(e);
        logger.info("Error during cleanup");
      }
    }, 1000 * 60 * 60 * 24);

    logger.info("Start cycle generator");
    //start cycle generator
    for await (const cycle of nextCycle()) {
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
  await connectDb();
  logger.info("MongoDB Connected");
  start();

  process.on("SIGINT", function () {
    mongoose.connection.close(function () {
      logger.info({ message: "Disconnected DB" });
      logger.info({ message: "End process" });
      process.exit(0);
    });
  });
}

main();
