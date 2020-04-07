"use strict";

require("dotenv").config();
const {
  transformPages,
  fetchPages,
  calculateNewReplies,
  getNewThreadIds,
  fetchThreadDetails,
} = require("./threads");
const utils = require("./utils");
const logger = require("./logger");
const mongoose = require("mongoose");
const connectDb = require("./connectDb");
const images = require("./images");

const PostStatistic = require("./models/PostStatistic");

/**
 * Collect /biz/ data and save to DB
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
  var result = {};
  const currentThreads = transformPages(await fetchPages());
  const newReplies = calculateNewReplies(prevThreads, currentThreads);
  const newThreads = getNewThreadIds(prevThreads, currentThreads);
  let newThreadImages = [];
  if (newThreads.length > 0) {
    for (const thread of newThreads) {
      const threadDetails = (await fetchThreadDetails(thread)).posts[0];
      const ext = threadDetails.ext;
      if ([".jpg", ".png"].includes(ext)) {
        const fullFileName = threadDetails.tim + ext;
        const mediaUrl = `https://i.4cdn.org/pol/${fullFileName}`;
        newThreadImages.push({ url: mediaUrl, fileName: fullFileName, ext });
      }
    }
    if (newThreadImages.length > 0) {
      images.proc(newThreadImages);
    }
  }

  const postStat = await new PostStatistic({
    newThreads: newThreads.length,
    newReplies,
  }).save();

  Object.assign(
    result,
    { currentThreads: { ...currentThreads } },
    { stats: postStat }
  );

  console.log("New Replies: " + newReplies);
  console.log("New threads: " + newThreads.length);
  console.log(newThreads);

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
  const initThreads = transformPages(await fetchPages());
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
 * @function start
 * @return {Object} Iterator
 */

async function start(retryTimeOut = 5000) {
  try {
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
