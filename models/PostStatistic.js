const mongoose = require("mongoose");

const PostStatisticSchema = new mongoose.Schema({
  newThreads: {
    type: Number,
    required: true,
  },
  newReplies: {
    type: Number,
    required: true,
  },
  newPosts: {
    type: Number,
    default: function () {
      return this.newThreads + this.newReplies;
    },
  },
  date: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model("PostStatistic", PostStatisticSchema);
