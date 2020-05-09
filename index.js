"use strict";

require("dotenv").config();
const { Worker } = require("worker_threads");
const threads = require("./libs/threads");
const utils = require("./utils/misc");
const logger = require("./utils/logger");
const mongoose = require("mongoose");
const connectDb = require("./utils/connectDb");
const images = require("./libs/images");
const texts = require("./libs/texts");
const fs = require("fs");
const path = require("path");
const cleanUp = require("./utils/cleanUp");
/**
 * Collect /biz/ data and save to DB
 *
 * @async
 * @function collectData
 * @param {Object} prevThreads - Object with threads from previous cycle
 * @return {Promise.<Object>} Object with threads from current cycle
 */

async function collectData(prevThreads) {
  const currentThreads = await threads.getCurrentThreads();
  const newThreadIds = threads.getNewThreadIds(prevThreads, currentThreads);

  const operations = [];
  operations.push(threads.proc(prevThreads, currentThreads));

  let newImagesDetails = [];
  let newTexts = [];
  if (newThreadIds.length > 0) {
    newImagesDetails = threads.getThreadsImageDetails(newThreadIds, currentThreads);
    newTexts = threads.getThreadsTexts(newThreadIds, currentThreads);
  }

  if (newImagesDetails.length > 0) {
    operations.push(images.proc(newImagesDetails));
  }

  if (newTexts.length > 0) {
    operations.push(texts.proc(newTexts));
  }
  try {
    await Promise.all(operations);
  } catch (e) {}

  logger.info(`Successful cycle: ${newThreadIds.length} new threads`);

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
  const initThreads = JSON.parse(
    await fs.promises.readFile(path.resolve(__dirname, "init-threads.json"))
  );
  var prevThreads = initThreads;
  var lastCycleStart = Date.now();

  while (true) {
    await utils.wait(process.env.CYCLE_TIME - (Date.now() - lastCycleStart));
    lastCycleStart = Date.now();
    try {
      let currentThreads = await collectData(prevThreads);
      yield currentThreads;
      prevThreads = currentThreads;
    } catch (e) {
      utils.handleError(e);
      // reset lastCycleStart, so we wait only 5000 instead of default miliseconds
      // before the next cycle is run
      lastCycleStart = Date.now() - (process.env.CYCLE_TIME - 5000);
    }
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
    logger.info("Start cycle generator");
    //start cycle generator
    for await (const currentThreads of nextCycle()) {
      const activeThreads = threads.getActiveThreads(currentThreads);
      apiServer.postMessage({ currentThreads, activeThreads });
      try {
        await fs.promises.writeFile(
          path.resolve(__dirname, "init-threads.json"),
          JSON.stringify(currentThreads)
        );
      } catch (e) {
        utils.handleError(e);
      }
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

  //run & schedule cleanups
  logger.info("Run & Schedule cleanups");
  cleanUp();
  setInterval(cleanUp, 1000 * 60 * 60 * 24);

  process.on("SIGINT", function () {
    mongoose.connection.close(function () {
      logger.info({ message: "Disconnected DB" });
      logger.info({ message: "End process" });
      process.exit(0);
    });
  });
}

var apiServer = new Worker("./api/server.js");
main();
