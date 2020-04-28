"use strict";
const workerpool = require("workerpool");
const texts = require("../libs/texts");
const wf = require("word-freq");

const ignore = new Set([
  "gur",
  "https",
  "http",
  "www",
  "don",
  "pastebin",
  "day",
  "people",
  "data",
  "live",
  "good",
  "time",
  "buy",
  "org",
  "net",
  "guys",
  "youtube",
  "post",
  "ve",
  "gonna",
  "io",
  "biz",
]);
console.log(ignore.has("gur"));

function wordCloud(strings) {
  let text = strings.join(" ").toLowerCase();
  text = texts.stripHtml(text);
  const frequency = wf.freq(text, true, false);
  console.log(frequency["gur"]);
  return Object.keys(frequency)
    .filter((w) => !ignore.has(w) && isNaN(Number(w)))
    .sort(function (a, b) {
      if (Number(frequency[a]) < Number(frequency[b])) {
        return 1;
      }
      if (Number(frequency[a]) > Number(frequency[b])) {
        return -1;
      }
      return 0;
    })
    .slice(0, 50)
    .reduce((acc, w) => {
      return Object.assign(acc, { [w]: frequency[w] });
    }, {});
}

workerpool.worker({
  wordCloud,
});
