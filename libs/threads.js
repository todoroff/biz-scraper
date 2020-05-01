"use strict";
/**
 * Fetching and analyzing threads.
 * @module threads
 */

const axios = require("axios");
const utils = require("../utils/misc");
const PostStatistic = require("../models/PostStatistic");
/**
 * Fetch all pages from /biz/.
 *
 * @async
 * @function fetchPages
 * @param {number} ms - Miliseconds ago to use in "If-Modified-Since" header
 * @return {Promise<Object[]>}  A  list of pages
 */

async function fetchPages(ms = process.env.CYCLE_TIME) {
  const config = {
    headers: {
      "If-Modified-Since": new Date(Date.now() - ms).toUTCString(),
    },
  };
  var pages = (await axios.get("https://a.4cdn.org/biz/catalog.json", config)).data;
  return pages;
}

/**
 * Turn a list of pages into an object of threads with thread ID as key.
 *
 * @function transformPages
 * @param {Object[]} pageList - A list of page objects.
 * @return {Object} An object of threads
 */

function transformPages(pageList) {
  const result = pageList.reduce((acc, page) => {
    const threads = page.threads.reduce((acc2, thread) => {
      return Object.assign(acc2, {
        [thread.no]: {
          ...thread,
          last_replies: undefined,
        },
      });
    }, {});
    return Object.assign(acc, threads);
  }, {});

  return result;
}

/**
 * Given a previous object of threads, and a new object of threads,
 * get the IDs of new threads (if any).
 *
 * @function getNewThreadIds
 * @param {Object} prevThreads - Threads from previous fetch.
 * @param {Object} currentThreads - Threads from current fetch.
 * @return {Array} IDs of the new threads.
 */

function getNewThreadIds(prevThreads, currentThreads) {
  const newThreadIds = Object.keys(currentThreads).filter(
    (threadId) => prevThreads[threadId] === undefined
  );
  return newThreadIds;
}

/**
 * Given a previous object of threads, and a new object of threads,
 * calculate the number of new replies for each thread and as a total.
 *
 * @function getNewRepliesCount
 * @param {Object} prevThreads - Threads from previous fetch.
 * @param {Object} currentThreads - Threads from current fetch.
 * @return {Object} Object with total number of new replies and list of new replies per thread ID
 */

function getNewRepliesCount(prevThreads, currentThreads) {
  const newReplies = Object.keys(currentThreads).reduce(
    (acc, threadId) => {
      if (prevThreads[threadId] !== undefined) {
        const newRepliesCount =
          currentThreads[threadId].replies - prevThreads[threadId].replies;
        return Object.assign(acc, {
          perThread: [...acc.perThread, { [threadId]: newRepliesCount }],
          totalNewReplies: acc.totalNewReplies + newRepliesCount,
        });
      } else {
        return Object.assign(acc, {
          perThread: [
            ...acc.perThread,
            { [threadId]: currentThreads[threadId].replies },
          ],
          totalNewReplies: acc.totalNewReplies + currentThreads[threadId].replies,
        });
      }
    },
    { totalNewReplies: 0, perThread: [] }
  );
  return newReplies;
}

/**
 * Fetch details for a specific thread.
 *
 * @async
 * @function fetchThreadDetails
 * @param {number} threadId - Thread ID
 * @return {Promise<Object>}  Thread details
 */

async function fetchThreadDetails(threadId) {
  var details = (await axios.get(`https://a.4cdn.org/biz/thread/${threadId}.json`))
    .data;
  return details;
}

/**
 * Get object with current threads.
 *
 * @async
 * @function getCurrentThreads
 * @return {Promise.<Object>}  Object of current threads
 */

async function getCurrentThreads() {
  return transformPages(await fetchPages());
}

/**
 * Get the URL and filename of .png and .jpg images
 * for each thread of the provided list of thread IDs.
 *
 * @function getThreadsImageDetails
 * @param {Object} threads - Object of threads
 * @param {Array.<sring>} threadIds - List of thread IDs
 * @return {Array.<Object>}  List of image details objects
 */

function getThreadsImageDetails(threadIds, threads) {
  let imageDetails = [];

  for (const id of threadIds) {
    const thread = threads[id];
    const ext = thread.ext;
    if ([".jpg", ".png"].includes(ext)) {
      const fullFileName = thread.tim + ext;
      const mediaUrl = `https://i.4cdn.org/biz/${fullFileName}`;
      imageDetails.push({ url: mediaUrl, fileName: fullFileName });
    }
  }
  return imageDetails;
}

/**
 * Get the text title & content
 * for each thread of the provided list of thread IDs.
 *
 * @function getThreadsTexts
 * @param {Object} threads - Threads object
 * @param {Array.<sring>} threadIds - List of new threads' IDs
 * @return {Array.<Object>}  List of text details objects incl. threadId, content, title
 */

function getThreadsTexts(threadIds, threads) {
  let threadsTexts = [];

  for (const id of threadIds) {
    const thread = threads[id];
    threadsTexts.push({ threadId: id, content: thread.com, title: thread.sub });
  }

  return threadsTexts;
}

/**
 * Get the 5 threads with the highest rpm,
 * that have been active in the last 30 minutes
 *
 * @function getActiveThreads
 * @param {Object} currentThreads Object with current threads
 * @return {Array.<Object>}  Sorted list of thread objects with added rpm (replies-per-minute) parameter
 */

function getActiveThreads(currentThreads) {
  const now = Date.now();
  const activeThreads = Object.keys(currentThreads)
    .map((id) => currentThreads[id])
    .filter((thread) => thread.last_modified > (now - 1000 * 60 * 30) / 1000)
    .filter((thread) => thread.replies > 5)
    .sort((a, b) => {
      if (a.replies / (now / 1000 - a.time) > b.replies / (now / 1000 - b.time))
        return -1;
      if (a.replies / (now / 1000 - a.time) < b.replies / (now / 1000 - b.time))
        return 1;
      return 0;
    })
    .slice(0, 5)
    .map((thread) => ({
      ...thread,
      rpm: thread.replies / (now / 1000 / 60 - thread.time / 60),
    }));
  return activeThreads;
}

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
  getCurrentThreads,
  proc,
  getActiveThreads,
  getNewThreadIds,
  getThreadsImageDetails,
  getThreadsTexts,
};
