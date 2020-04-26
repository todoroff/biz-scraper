"use strict";

const mongoose = require("mongoose");

const TextEntrySchema = new mongoose.Schema(
  {
    title: {
      type: String,
    },
    content: {
      type: String,
    },
    threadId: {
      type: Number,
      required: true,
    },
    toxicity: {
      type: Number,
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
