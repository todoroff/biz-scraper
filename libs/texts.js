"use strict";
/**
 * Processing texts.
 * @module texts
 */

const utils = require("../utils/misc");

/**
 * Given previous and current threads, calculate the stats,
 * and save to database. Return
 *
 * @async
 * @function proc
 * @return {Promise.<Object>}  Object with stats
 */

async function proc(prevThreads, currentThreads) {
  try {
    const newReplies = getNewRepliesCount(prevThreads, currentThreads);
    const newThreadIds = getNewThreadIds(prevThreads, currentThreads);

    await new PostStatistic({
      newThreads: newThreadIds.length,
      newReplies: newReplies.totalNewReplies,
    }).save();
  } catch (e) {
    utils.handleError(e);
  }
}

module.exports = {
  proc,
};
