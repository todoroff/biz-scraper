"use strict";

const mongoose = require("mongoose");

const ImageEncounterSchema = new mongoose.Schema(
  {
    entryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ImageEntry",
      required: true,
    },
    date: {
      type: Date,
      default: Date.now,
    },
  },
  { collection: "image_encounters" }
);

module.exports = mongoose.model("ImageEncounter", ImageEncounterSchema);
