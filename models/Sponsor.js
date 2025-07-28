const mongoose = require("mongoose");

const PostSchema = new mongoose.Schema({
  media: String,
  caption: String,
  jobLink: String,
  views: { type: Number, default: 0 },
  clicks: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now }
});

const SponsorSchema = new mongoose.Schema({
  companyName: { type: String, required: true },
  logo: String,
  objectives: String,
  posts: [PostSchema],
  postCount: { type: Number, default: 0 }
});

module.exports = mongoose.model("Sponsor", SponsorSchema);
