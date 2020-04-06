"use strict";
/**
 * Utility functions.
 * @module utils
 */
const logger = require("./logger");

/**
 * Promise to wait
 *
 * @function wait
 * @param {number} miliseconds - How long to resolve the promise in ms
 * @return {Promise}
 */

function wait(miliseconds) {
  return new Promise((resolve, reject) => {
    setTimeout(resolve, Math.max(miliseconds, 0));
  });
}

function handleError(e) {
  if (e.response && e.response.status == 304) {
    logger.warn({
      message: e.message,
      url: e.response.config.url,
      stack: e.stack,
    });
  } else {
    logger.error({ message: e.message, stack: e.stack });
  }
}

module.exports = {
  wait,
  handleError,
};
