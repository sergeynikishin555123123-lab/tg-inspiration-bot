import express from 'express';

const router = express.Router();

router.get('/posts', (req, res) => {
  res.json({ message: 'Admin posts endpoint' });
});

export default router;
