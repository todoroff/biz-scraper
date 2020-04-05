"use strict";
/**
 * Utility functions.
 * @module utils
 */

/**
 * Promise to wait
 *
 * @function wait
 * @param {number} miliseconds - How long to resolve the promise in ms
 * @return {Promise}
 */

function wait(miliseconds) {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      resolve();
    }, Math.max(miliseconds, 0));
  });
}

module.exports = {
  wait,
};
