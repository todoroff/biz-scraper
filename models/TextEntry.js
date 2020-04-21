"use strict";

const mongoose = require("mongoose");

const TextEntrySchema = new mongoose.Schema(
  {
    content: {
      type: String,
      required: true,
    },
    threadId: {
      type: String,
      required: true,
    },
    date: {
      type: Date,
      default: Date.now,
    },
  },
  { collection: "text_entries" }
);

module.exports = mongoose.model("TextEntry", TextEntrySchema);
