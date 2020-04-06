const mongoose = require("mongoose");
const logger = require("./logger");
const db = process.env.MONGO_URI;

const connectDb = async () => {
  try {
    await mongoose.connect(db, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      useCreateIndex: true,
      useFindAndModify: false,
    });
  } catch (err) {
    logger.error(err);
    //Exit process with failure
    process.exit(1);
  }
};

module.exports = connectDb;
