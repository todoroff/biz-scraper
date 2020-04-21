"use strict";
/**
 * Processing texts.
 * @module texts
 */

const utils = require("../utils/misc");
const TextEntry = require("../models/TextEntry");

/**
 * Given previous and current threads, calculate the stats,
 * and save to database. Return
 *
 * @async
 * @param {Array.<Object>} textList - Array of objects with image url & filename
 * @returns {Promise}
 */

async function proc(textList) {
  try {
    for (const t of textList) {
      await new TextEntry({
        content: t.content,
        threadId: t.threadId,
      }).save();
    }
  } catch (e) {
    utils.handleError(e);
  }
}

module.exports = {
  proc,
};
