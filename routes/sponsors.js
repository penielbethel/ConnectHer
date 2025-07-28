// routes/sponsors.js
const express = require("express");
const router = express.Router();

const multer = require("multer");
const path = require("path");
const Sponsor = require("../models/Sponsor");
const verifyTokenAndRole = require("../middleware/verifyTokenAndRole");


const Notification = require("../models/Notification");
const User = require("../models/User"); // if sending to specific users

// File storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "uploads/"),
  filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname)),
});
const upload = multer({ storage });

/**
 * ✅ POST /api/sponsors/register
 * Register a sponsor
 */
router.post(
  "/register",
  verifyTokenAndRole(["admin", "superadmin"]),
  upload.single("logo"),
  async (req, res) => {
    try {
      const { companyName, objectives } = req.body;
      const logo = req.file ? `http://localhost:3000/uploads/${req.file.filename}` : null;

      const newSponsor = new Sponsor({
        companyName,
        objectives,
        logo,
        posts: [],
        postCount: 0
      });

      await newSponsor.save();
      res.status(201).json({ message: "Sponsor registered successfully", sponsor: newSponsor });
    } catch (err) {
      console.error("Register Sponsor Error:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  }
);

/**
 * ✅ GET /api/sponsors
 * Get all sponsors
 */
router.get("/", verifyTokenAndRole(["user","admin", "superadmin"]), async (req, res) => {
  try {
    const sponsors = await Sponsor.find().sort({ createdAt: -1 });
    res.json(sponsors);
  } catch (err) {
    console.error("Get Sponsors Error:", err);
    res.status(500).json({ message: "Failed to load sponsors" });
  }
});


/**
 * ✅ PUT /api/sponsors/:id/post
 post to a sponsor and send notification to users
 */
router.put(
  "/:id/post",
  verifyTokenAndRole(["admin", "superadmin"]),
  upload.single("media"),
  async (req, res) => {
    try {
      const { caption, jobLink } = req.body;
      const media = req.file ? `http://localhost:3000/uploads/${req.file.filename}` : null;

      const sponsor = await Sponsor.findById(req.params.id);
      if (!sponsor) return res.status(404).json({ message: "Sponsor not found" });

      const post = {
        caption,
        jobLink,
        media,
        views: 0,
        createdAt: new Date()
      };

      sponsor.posts.push(post);
      sponsor.postCount = sponsor.posts.length;

      await sponsor.save();

      // ✅ Create a notification for users
      await Notification.create({
        type: "sponsor",
        title: "New Sponsorship Alert",
        content: `${sponsor.companyName} just posted a new sponsorship opportunity.`,
        sponsorId: sponsor._id,
        postId: post._id,
        createdAt: new Date(),
        forAll: true
      });

      res.status(200).json({ message: "Post added and notification sent", sponsor });
    } catch (err) {
      console.error("Post for Sponsor Error:", err);
      res.status(500).json({ message: "Failed to add post" });
    }
  }
);


// GET /api/sponsors/:id/posts
router.get("/:id/posts", verifyTokenAndRole(["user","admin", "superadmin"]), async (req, res) => {
  try {
    const sponsor = await Sponsor.findById(req.params.id);
    if (!sponsor) return res.status(404).json({ message: "Sponsor not found" });

    res.json(sponsor.posts || []);
  } catch (err) {
    console.error("Fetch Sponsor Posts Error:", err);
    res.status(500).json({ message: "Failed to fetch posts." });
  }
});


// PUT /api/sponsors/:sponsorId/posts/:postId
router.put("/:sponsorId/posts/:postId", verifyTokenAndRole(["admin", "superadmin"]), upload.single("media"), async (req, res) => {
  try {
    const sponsor = await Sponsor.findById(req.params.sponsorId);
    if (!sponsor) return res.status(404).json({ message: "Sponsor not found" });

    const post = sponsor.posts.id(req.params.postId);
    if (!post) return res.status(404).json({ message: "Post not found" });

    if (req.body.caption) post.caption = req.body.caption;
    if (req.body.jobLink) post.jobLink = req.body.jobLink;
    if (req.file) post.media = `http://localhost:3000/uploads/${req.file.filename}`;

    await sponsor.save();
    res.json({ message: "Post updated", post });
  } catch (err) {
    console.error("Update Sponsor Post Error:", err);
    res.status(500).json({ message: "Failed to update post." });
  }
});


// DELETE /api/sponsors/:sponsorId/posts/:postId
router.delete("/:sponsorId/posts/:postId", verifyTokenAndRole(["admin", "superadmin"]), async (req, res) => {
  try {
    const { sponsorId, postId } = req.params;

    const sponsor = await Sponsor.findById(sponsorId);
    if (!sponsor) return res.status(404).json({ message: "Sponsor not found" });

    // Use findIndex to locate the post by _id
    const postIndex = sponsor.posts.findIndex(p => p._id.toString() === postId);
    if (postIndex === -1) {
      return res.status(404).json({ message: "Post not found" });
    }

    // Remove the post
    sponsor.posts.splice(postIndex, 1);
    sponsor.postCount = sponsor.posts.length;

    await sponsor.save();

    res.json({ message: "✅ Post deleted successfully" });
  } catch (err) {
    console.error("❌ Delete Sponsor Post Error:", err);
    res.status(500).json({ message: "Failed to delete post", error: err.message });
  }
});


// GET /api/sponsors/:sponsorId/posts/:postId/view
router.get("/:sponsorId/posts/:postId/view", async (req, res) => {
  const sponsor = await Sponsor.findById(req.params.sponsorId);
  if (!sponsor) return res.status(404).json({ message: "Sponsor not found" });

  const post = sponsor.posts.id(req.params.postId);
  if (!post) return res.status(404).json({ message: "Post not found" });

  post.views = (post.views || 0) + 1;
  await sponsor.save();

  res.json({ message: "View counted" });
});


// GET /redirect/:sponsorId/:postId
router.get("/redirect/:sponsorId/:postId", async (req, res) => {
  const sponsor = await Sponsor.findById(req.params.sponsorId);
  if (!sponsor) return res.status(404).json({ message: "Sponsor not found" });

  const post = sponsor.posts.id(req.params.postId);
  if (!post) return res.status(404).json({ message: "Post not found" });

  post.clicks = (post.clicks || 0) + 1;
  await sponsor.save();

  res.redirect(post.jobLink || "/");
});

// DELETE /api/sponsors/:id - Delete a sponsor
router.delete("/:id", verifyTokenAndRole(["admin", "superadmin"]), async (req, res) => {
  try {
    const sponsor = await Sponsor.findByIdAndDelete(req.params.id);
    if (!sponsor) return res.status(404).json({ message: "Sponsor not found" });

    res.json({ message: "Sponsor deleted successfully" });
  } catch (err) {
    console.error("Delete Sponsor Error:", err);
    res.status(500).json({ message: "Failed to delete sponsor" });
  }
});





module.exports = router;
