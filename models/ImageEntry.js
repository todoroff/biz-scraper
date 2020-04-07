"use strict";

const mongoose = require("mongoose");

const ImageEntrySchema = new mongoose.Schema(
  {
    hash: {
      type: String,
      required: true,
    },
    fileName: {
      type: String,
      required: true,
    },
    totalEncounters: {
      type: Number,
      default: 1,
    },
    date: {
      type: Date,
      default: Date.now,
    },
  },
  { collection: "image_entries" }
);

module.exports = mongoose.model("ImageEntry", ImageEntrySchema);
