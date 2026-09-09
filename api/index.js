export default function handler(req, res) {
  res.status(200).json({
    status: 'ok',
    nodeVersion: process.version,
    envVercel: process.env.VERCEL
  });
}
