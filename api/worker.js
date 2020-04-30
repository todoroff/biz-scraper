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
  "didn",
  "t",
  "s",
  "thread",
  "ll",
  "embed",
  "doesn",
  "lot",
  "man",
]);

function wordCloud(strings) {
  // for each post take repeating words within the post only once
  // concat everything into 1 big string
  let text = strings
    .map((t) => Array.from(new Set(t.split(" "))).join(" "))
    .join(" ")
    .toLowerCase();
  text = texts.stripHtml(text);
  const frequency = wf.freq(text, true, false);
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
    .slice(0, 300)
    .map((w) => {
      return { word: w, count: frequency[w] };
    });
}

workerpool.worker({
  wordCloud,
});
