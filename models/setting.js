const mongoose = require("mongoose");

const settingSchema = new mongoose.Schema(
  {
    horsePoints: {
      type: [Number],
      required: true,
      validate: {
        validator: function (v) {
          return v.length === 4 && v.every((num) => Number.isInteger(num));
        },
        message: "马点值必须是4个整数",
      },
    },
    returnPoint: {
      type: Number,
      required: true,
      validate: {
        validator: Number.isInteger,
        message: "返点值必须是整数",
      },
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Setting", settingSchema);
