"use strict";
/**
 * Fetching and analyzing threads.
 * @module threads
 */

const axios = require("axios");

/**
 * Fetch all pages from /biz/.
 *
 * @async
 * @function fetchPages
 * @param {number} ms - Miliseconds ago to use in "If-Modified-Since" header
 * @return {Promise<Object[]>}  A  list of pages
 */

async function fetchPages(ms) {
  const config = {
    headers: {
      "If-Modified-Since": new Date(Date.now() - ms).toUTCString(),
    },
  };
  try {
    var pages = (await axios.get("https://a.4cdn.org/biz/threads.json", config))
      .data;
  } catch (e) {
    throw new Error(
      `${e.response.status}: ${e.response.statusText} \n url: ${e.response.config.url}`
    );
  }
  return pages;
}

/**
 * Turn a list of pages in to an object of threads with thread ID as key.
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
 * get the IDs.
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
 * calculate the number of new replies.
 *
 * @function calculateNewReplies
 * @param {Object} prevThreads - Threads from previous fetch.
 * @param {Object} currentThreads - Threads from current fetch.
 * @return {number} Number of new replies
 */

function calculateNewReplies(prevThreads, currentThreads) {
  const newReplies = Object.keys(currentThreads).reduce((acc, threadId) => {
    if (prevThreads[threadId] !== undefined) {
      return acc + currentThreads[threadId].replies - prevThreads[threadId].replies;
    } else {
      return acc + currentThreads[threadId].replies;
    }
  }, 0);
  return newReplies;
}

/**
 * Given a previous object of threads, and a new object of threads,
 * calculate the number of new posts (threads + replies).
 *
 * @function calculateNewPosts
 * @param {Object} prevThreads - Threads from previous fetch.
 * @param {Object} currentThreads - Threads from current fetch.
 * @return {number} Number of new posts.
 */

function calculateNewPosts(prevThreads, currentThreads) {
  return (
    calculateNewReplies(prevThreads, currentThreads) +
    getNewThreadIds(prevThreads, currentThreads).length
  );
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
  try {
    var details = (await axios.get(`https://a.4cdn.org/biz/thread/${threadId}.json`))
      .data;
  } catch (e) {
    throw new Error(
      `${e.response.status}: ${e.response.statusText} \n url: ${e.response.config.url}`
    );
  }
  return details;
}

module.exports = {
  fetchPages,
  transformPages,
  getNewThreadIds,
  calculateNewReplies,
  calculateNewPosts,
  fetchThreadDetails,
};
