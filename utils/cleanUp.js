"use strict";

const logger = require("./logger");
const images = require("../libs/images");

/**
 * Cleanup old unnecessary data/files
 *
 * @async
 * @function cleanUp
 */

async function cleanUp() {
  logger.info("Begin cleanup");
  try {
    await images.cleanUp();
    logger.info("Finished cleanup");
  } catch (e) {
    utils.handleError(e);
    logger.info("Error during cleanup");
  }
}

module.exports = cleanUp;
