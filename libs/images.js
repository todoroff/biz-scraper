"use strict";
/**
 * Fetch and process images.
 * @module images
 */
const axios = require("axios");
const path = require("path");
const fs = require("fs");
const imagemin = require("imagemin");
const sharp = require("sharp");

const promisify = require("util").promisify;
const utils = require("../utils/misc");
const imageminMozjpeg = require("imagemin-mozjpeg");
const imageminPngquant = require("imagemin-pngquant");
const imghash = require("imghash");
const leven = require("leven");
const Redis = require("ioredis");
const redis = new Redis();
const ImageEntry = require("../models/ImageEntry");
const ImageEncounter = require("../models/ImageEncounter");
const ObjectId = require("mongoose").Types.ObjectId;

const unlink = promisify(fs.unlink);
const readFile = promisify(fs.readFile);
const pipeline = promisify(require("stream").pipeline);
const DOWNLOAD_DIR = path.resolve(__dirname, "../", process.env.DOWNLOAD_DIR);

/**
 * Download images
 *
 * @async
 * @function download
 * @param {string} url - Image URL
 * @param {string} fileName - Image filename
 * @returns {Promise}
 */

async function download(url, fileName) {
  const downloadPath = path.resolve(DOWNLOAD_DIR, fileName);
  const writer = fs.createWriteStream(downloadPath);

  const response = await axios({
    url,
    method: "GET",
    responseType: "stream",
  });

  await pipeline(response.data, writer);
}

/**
 * Optimize images - minify, resize, move, and delete originals
 *
 * @async
 * @function optimize
 * @param {string} fileName - Image filename
 * @returns {Promise}
 */

async function optimize(fileName) {
  const dir = DOWNLOAD_DIR;
  const optimizedDir = path.join(dir, "optimized");
  const filePath = path.resolve(DOWNLOAD_DIR, fileName);

  // minify
  await imagemin([filePath], {
    destination: dir,
    plugins: [
      imageminMozjpeg({ quality: 50 }),
      imageminPngquant({ quality: [0.1, 0.3], strip: true }),
    ],
  });

  // resize
  await sharp(filePath)
    .resize({ width: 800, withoutEnlargement: true })
    .toFile(path.join(optimizedDir, fileName));

  // delete original
  await unlink(filePath);
}

/**
 * Save non-duplicate images to DB & filesystem, and keep
 * track when and how many times a certain image has been posted.
 *
 * @async
 * @function save
 * @param {string} fileName - Image filename
 * @returns {Promise}
 */

async function save(fileName) {
  const filePath = path.resolve(DOWNLOAD_DIR, "optimized", fileName);
  const image = await readFile(filePath);
  const hash = await imghash.hash(image, 8, "binary");
  var matchingHash;

  var stream = redis.scanStream();
  stream.on("data", async function (resultKeys) {
    // Pause the stream from scanning more keys until we've migrated the current keys.
    stream.pause();
    for (const key of resultKeys) {
      if (leven(hash, key) < 5) {
        matchingHash = key;
        return stream.destroy();
      }
    }
    stream.resume();
  });

  // if there's a match update DB accordingly,
  // and delete duplicate from filesystem
  stream.on("close", async function () {
    try {
      const entryId = await redis.get(matchingHash);
      await new ImageEncounter({ entryId }).save();
      await ImageEntry.updateOne(
        { _id: ObjectId(entryId) },
        {
          $inc: { totalEncounters: 1 },
        }
      ).exec();
      await unlink(filePath);
    } catch (e) {
      utils.handleError(e);
    }
  });

  // if no match save to db
  stream.on("end", async function () {
    try {
      const entry = await new ImageEntry({ hash, fileName }).save();
      await new ImageEncounter({ entryId: entry.id }).save();
      await redis.set(hash, entry.id);
    } catch (e) {
      utils.handleError(e);
    }
  });
}

/**
 * Remove images older than 30 days
 *
 * @async
 * @function cleanUp
 * @returns {Promise.<Array.<Object>>} List of deleted image entries
 */

async function cleanUp() {
  const date = new Date();
  const daysAgo = 30;
  const deletionDate = new Date(date.setDate(date.getDate() - daysAgo));

  const mongoEntries = await ImageEntry.find().where("date").lt(deletionDate).exec();

  for (const entry of mongoEntries) {
    try {
      await redis.del(entry.hash);
      await ImageEntry.deleteOne({ _id: ObjectId(entry._id) });
      await ImageEncounter.deleteOne({ entryId: ObjectId(entry._id) });
      await unlink(path.resolve(DOWNLOAD_DIR, "optimized", entry.fileName));
    } catch (e) {
      handleError(e);
    }
  }
  return mongoEntries;
}

/**
 * Download, optimize, and save images to database
 *
 * @async
 * @function proc
 * @param {Array.<Object>} images - Array of objects with image url & filename
 * @returns {Promise}
 */

async function proc(images) {
  try {
    for (const i of images) {
      await download(i.url, i.fileName);
      await optimize(i.fileName);
      await save(i.fileName);
    }
  } catch (e) {
    utils.handleError(e);
  }
}

module.exports = {
  proc,
  cleanUp,
};
