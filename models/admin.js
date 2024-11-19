const mongoose = require("mongoose");

const adminSchema = new mongoose.Schema(
  {
    password: {
      type: String,
      required: true,
    },
    isInitialized: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Admin", adminSchema);
