"use strict";

require("../utils/connectDb")();
const { parentPort } = require("worker_threads");
const workerpool = require("workerpool");
const fs = require("fs");
const express = require("express");
const path = require("path");
const { RateLimiterMemory } = require("rate-limiter-flexible");
const logger = require("../utils/logger");
const utils = require("../utils/misc");
const wf = require("word-freq");
const texts = require("../libs/texts");
const PostStatistic = require("../models/PostStatistic");
const TextEntry = require("../models/TextEntry");

const pool = workerpool.pool(__dirname + "/worker.js");

//get posts per minute over the last 60 min
async function getPpm() {
  const res = await PostStatistic.aggregate([
    { $match: { date: { $gte: new Date(Date.now() - 1000 * 60 * 60) } } },
    {
      $group: {
        _id: null,
        total: {
          $sum: "$newPosts",
        },
        firstDate: {
          $first: "$date",
        },
        lastDate: {
          $last: "$date",
        },
      },
    },
  ]);
  const timeSpan =
    (res[0].lastDate.getTime() - res[0].firstDate.getTime()) / 1000 / 60 || 1;
  return res[0].total / timeSpan;
}

async function getBasedness(threadIds) {
  const res = await TextEntry.aggregate([
    { $match: { threadId: { $in: threadIds } } },
    {
      $group: {
        _id: null,
        basedSum: {
          $sum: "$toxicity",
        },
        totalThreads: {
          $sum: 1,
        },
      },
    },
  ]);
  const basedness = res && res.length ? res[0].basedSum / res[0].totalThreads : 0;
  return basedness;
}

async function get24hWordCloud() {
  const res = await TextEntry.aggregate([
    { $match: { date: { $gte: new Date(Date.now() - 1000 * 60 * 60 * 24) } } },
    {
      $group: {
        _id: null,
        text: {
          $push: "$content",
        },
      },
    },
  ]);

  const wordCloud =
    res && res.length ? await pool.exec("wordCloud", [res[0].text]) : null;
  return wordCloud;
}

var { latestData, wordCloud } = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, "latest-cache.json"))
);

const httpsOptions = {
  key: fs.readFileSync(path.resolve(process.env.KEY)),
  cert: fs.readFileSync(path.resolve(process.env.CERT)),
};
const app = express();
const server = require("https").createServer(httpsOptions, app);
const io = require("socket.io")(server);

parentPort.on("message", async (msg) => {
  try {
    const { currentThreads, activeThreads } = msg;
    const ppm = await getPpm();
    const basedness = await getBasedness(Object.keys(currentThreads).map(Number));
    wordCloud = await get24hWordCloud();
    latestData = { activeThreads, ppm, basedness };
    io.emit("latestData", latestData);
    await fs.promises.writeFile(
      path.resolve(__dirname, "latest-cache.json"),
      JSON.stringify({ latestData, wordCloud })
    );
  } catch (e) {
    utils.handleError(e);
  }
});

if (process.env.NODE_ENV !== "production") {
  app.use(
    "/media",
    express.static(
      path.resolve(__dirname, "../", process.env.DOWNLOAD_DIR, "optimized")
    )
  );

  app.get("/latest", (req, res) => {
    res.json(latestData);
  });
}

const rateLimiter = new RateLimiterMemory({
  points: 5, // 5 points
  duration: 1, // per second
});

io.use(async function (socket, next) {
  try {
    await rateLimiter.consume(socket.id);
    next();
  } catch (e) {
    socket.emit("disconnected", true);
    socket.disconnect(true);
  }
});

io.on("connection", async function (socket) {
  try {
    await rateLimiter.consume(socket.handshake.address);
  } catch (e) {
    socket.emit("disconnected", true);
    socket.disconnect(true);
  }

  socket.on("latestData", (payload, cb) => {
    cb(latestData);
  });
  socket.on("wordCloud", (payload, cb) => {
    cb(wordCloud);
  });
});

const port = process.env.PORT || 2096;

server.listen(port, function () {
  logger.info(`Started API Server on port ${port}`);
});
