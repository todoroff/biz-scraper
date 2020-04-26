"use strict";

const { parentPort } = require("worker_threads");
const fs = require("fs");
const express = require("express");
const path = require("path");
const Redis = require("ioredis");
const redis = new Redis();
const connectDb = require("../utils/connectDb");
connectDb();

var latestData = {};

parentPort.on("message", async (msg) => {
  const ppm = 0;
  const basedness = 0;
  latestData = { activeThreads: msg, ppm, basedness };
  redis.publish("collector", "updated");
});

const httpsOptions = {
  key: fs.readFileSync(path.resolve(process.env.KEY)),
  cert: fs.readFileSync(path.resolve(process.env.CERT)),
};
const app = express();
const server = require("https").createServer(httpsOptions, app);

app.use(express.json());

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

const port = process.env.PORT || 2096;

server.listen(port, function () {
  console.log(`listening on ${port}`);
});
