"use strict";

require("../utils/connectDb")();
const { parentPort } = require("worker_threads");
const axios = require("axios");
const workerpool = require("workerpool");
const fs = require("fs");
const express = require("express");
const path = require("path");
const { RateLimiterMemory } = require("rate-limiter-flexible");
const logger = require("../utils/logger");
const utils = require("../utils/misc");
const PostStatistic = require("../models/PostStatistic");
const TextEntry = require("../models/TextEntry");

const pool = workerpool.pool(__dirname + "/worker.js");

//get posts per minute over the last 60 min
async function getPpm() {
  try {
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
  } catch (e) {
    utils.handleError(e);
  }
}

async function getAvgBasedness(threadIds) {
  try {
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
  } catch (e) {
    utils.handleError(e);
  }
}

async function getBasedness(threadId) {
  try {
    const res = await TextEntry.findOne({ threadId: threadId });
    return res.toxicity;
  } catch (e) {
    utils.handleError(e);
  }
}

async function get24hWordCloud() {
  try {
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
  } catch (e) {
    utils.handleError(e);
  }
}

async function getBtcHistory(timeframe) {
  try {
    const res = await axios.get(
      `https://api.coinranking.com/v1/public/coin/1/history/${timeframe}`
    );
    return res.data.data;
  } catch (e) {
    utils.handleError(e);
  }
}

async function set5yData() {
  btc5y = (await getBtcHistory("5y")) || btc5y;
  newPosts5y = (await getNewPosts5y()) || newPosts5y;
  try {
    await fs.promises.writeFile(
      path.resolve(__dirname, "latest-cache.json"),
      JSON.stringify({ latestData, wordCloud, btc5y, newPosts5y })
    );
  } catch (e) {
    utils.handleError(e);
  }
}

async function getNewPosts5y() {
  try {
    const res = await PostStatistic.aggregate([
      {
        $match: {
          date: {
            $gte: new Date(new Date().setFullYear(new Date().getFullYear() - 5)),
          },
        },
      },
      {
        $group: {
          _id: {
            $subtract: [
              { $toLong: "$date" },
              { $mod: [{ $toLong: "$date" }, 1000 * 60 * 60 * 24] },
            ],
          },
          count: { $sum: "$newPosts" },
        },
      },
      { $sort: { _id: 1 } },
    ]);
    return res;
  } catch (e) {
    utils.handleError(e);
  }
}

const httpsOptions = {
  key: fs.readFileSync(path.resolve(process.env.KEY)),
  cert: fs.readFileSync(path.resolve(process.env.CERT)),
};
const app = express();
const server = require("https").createServer(httpsOptions, app);
const io = require("socket.io")(server);

var { latestData, wordCloud, btc5y, newPosts5y } = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, "latest-cache.json"))
);

set5yData();
setInterval(set5yData, 1000 * 60 * 30);

parentPort.on("message", async (msg) => {
  const { currentThreads, activeThreads } = msg;

  for (const [i, at] of activeThreads.entries()) {
    const b = await getBasedness(at.no);
    activeThreads[i] = { ...at, basedness: b };
  }

  const ppm = (await getPpm()) || latestData.ppm;
  const basedness =
    (await getAvgBasedness(Object.keys(currentThreads).map(Number))) ||
    latestData.basedness;
  const btcPriceChange = (await getBtcHistory("24h")).change || btcPriceChange;
  latestData = { activeThreads, ppm, basedness, btcPriceChange };
  wordCloud = (await get24hWordCloud()) || wordCloud;
  io.emit("latestData", latestData);
  io.emit("btcPriceChange", btcPriceChange);
  try {
    await fs.promises.writeFile(
      path.resolve(__dirname, "latest-cache.json"),
      JSON.stringify({ latestData, wordCloud, btc5y, newPosts5y })
    );
  } catch (e) {
    utils.handleError(e);
  }
});

app.use(
  "/media",
  express.static(
    path.resolve(__dirname, "../", process.env.DOWNLOAD_DIR, "optimized")
  )
);

if (process.env.NODE_ENV !== "production") {
  app.get("/allz", (req, res) => {
    res.json({ latestData, wordCloud, btc5y, newPosts5y });
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
  socket.on("btc5y", async (payload, cb) => {
    cb(btc5y);
  });
  socket.on("newPosts5y", async (payload, cb) => {
    cb(newPosts5y);
  });
});

const port = process.env.PORT || 2096;

server.listen(port, function () {
  logger.info(`Started API Server on port ${port}`);
});
