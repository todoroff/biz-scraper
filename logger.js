"use strict";

const winston = require("winston");
require("winston-daily-rotate-file");
const path = require("path");

const logger = winston.createLogger({
  format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
  datePattern: "YYYY-MM-DD-HH",
  zippedArchive: true,
  maxSize: "20m",
  maxFiles: "14d",
  transports: [
    new winston.transports.DailyRotateFile({
      filename: path.resolve("logs", "error-%DATE%.log"),
      level: "error",
    }),
    new winston.transports.DailyRotateFile({
      level: "info",
      filename: path.resolve("logs", "combined-%DATE%.log"),
    }),
  ],
});

if (process.env.NODE_ENV !== "production") {
  logger.add(
    new winston.transports.Console({
      format: winston.format.simple(),
    })
  );
}

module.exports = logger;
