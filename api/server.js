"use strict";

require("../utils/connectDb")();
const { parentPort } = require("worker_threads");
const fs = require("fs");
const express = require("express");
const path = require("path");
const { RateLimiterMemory } = require("rate-limiter-flexible");
const logger = require("../utils/logger");
const utils = require("../utils/misc");
const PostStatistic = require("../models/PostStatistic");
const TextEntry = require("../models/TextEntry");

//get posts per minute over the last 30 min
async function getPpm() {
  const res = await PostStatistic.aggregate([
    { $match: { date: { $gte: new Date(Date.now() - 1000 * 60 * 30) } } },
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

var latestData = { activeThreads: null, ppm: 0, basedness: 0 };

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
    latestData = { activeThreads, ppm, basedness };
    io.emit("latestData", latestData);
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
});

const port = process.env.PORT || 2096;

server.listen(port, function () {
  logger.info(`Started API Server on port ${port}`);
});
