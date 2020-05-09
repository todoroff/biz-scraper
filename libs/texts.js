"use strict";
/**
 * Processing texts.
 * @module texts
 */

const utils = require("../utils/misc");
const htmlToText = require("html-to-text");
const TextEntry = require("../models/TextEntry");
// if (process.env.NODE_ENV === "production") {
//   require("@tensorflow/tfjs-node");
// }
const toxicityModel = require("@tensorflow-models/toxicity");

/**
 * Calculate the toxicity of a given text. Different toxicity
 * categories carry different weight. Take the highest value after
 * applying the weights.
 *
 * @async
 * @function calculateToxicity
 * @param {String} text
 * @returns {Promise.<Number>} A number between 0 and 1
 */

var calculateToxicity = (function calculateToxicityWrapper() {
  var model;
  async function caluclateToxicity(text) {
    // model memoization
    model = model || (await toxicityModel.load());

    const predictions = await model.classify(text);
    const result = Math.max(
      ...predictions.map((p) => {
        var discount;
        switch (p.label) {
          case "severe_toxicity":
            discount = 0.25;
            break;
          case "identity_attack":
          case "insult":
          case "threat":
          case "toxicity":
            discount = 1;
            break;
          case "obscene":
          case "sexual_explicit":
            discount = 1.25;
            break;
          default:
            discount = 1;
            break;
        }
        return p.results[0].probabilities[1] / discount;
      })
    );
    return result;
  }
  return caluclateToxicity;
})();

/**
 * Remove HTML tags from text
 *
 * @function stripHtml
 * @param {String} text
 * @returns {String} Parsed text
 */
function stripHtml(text) {
  const result = htmlToText.fromString(text, {
    wordwrap: false,
    ignoreHref: true,
  });
  return result;
}

/**
 * Given previous and current threads, calculate the stats,
 * and save to database. Return
 *
 * @async
 * @param {Array.<Object>} textList - Array of objects with thread ID and thread content & thread title
 * @returns {Promise}
 */

async function proc(textList) {
  try {
    for (const t of textList) {
      if (t.content || t.title) {
        const fullText = `${t.title && t.title + " "}${t.content && t.content}`;
        const toxicity = await calculateToxicity(stripHtml(fullText));
        await new TextEntry({
          title: t.title,
          content: t.content,
          threadId: t.threadId,
          toxicity: toxicity,
        }).save();
      }
    }
  } catch (e) {
    utils.handleError(e);
  }
}

module.exports = {
  proc,
  stripHtml,
};
