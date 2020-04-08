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
 * @param {Object} currentThreads - Object with current threads
 * @param {Array.<sring>} newThreadsIds - List of new threads' IDs
 * @return {Object}  Object of current threads
 */

function getThreadsImageDetails(newThreadsIds, currentThreads) {
  let imageDetails = [];

  for (const id of newThreadsIds) {
    const thread = currentThreads[id];
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
 * Given previous and current threads, calculate the stats,
 * and save to database
 *
 * @async
 * @function proc
 * @return {Promise.<Object>}  Object with stats and new threads' images
 */

async function proc(prevThreads, currentThreads) {
  const newReplies = getNewRepliesCount(prevThreads, currentThreads);
  const newThreadIds = getNewThreadIds(prevThreads, currentThreads);
  let newImagesDetails = [];
  if (newThreadIds.length > 0) {
    newImagesDetails = getThreadsImageDetails(newThreadIds, currentThreads);
  }

  await new PostStatistic({
    newThreads: newThreadIds.length,
    newReplies: newReplies.totalNewReplies,
  }).save();

  return { newThreadIds, newReplies, newImagesDetails };
}

module.exports = {
  getCurrentThreads,
  proc,
};
