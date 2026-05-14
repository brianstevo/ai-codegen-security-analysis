const express = require('express');
const router = express.Router();
const Post = require('../models/Post');

router.delete('/posts/:id', async (req, res) => {
  try {
    const post = await Post.findByIdAndDelete(req.params.id);
    if (!post) return res.status(404).send('Post not found');
    res.send(post);
  } catch (error) {
    res.status(500).send(error.message);
  }
});

module.exports = router;