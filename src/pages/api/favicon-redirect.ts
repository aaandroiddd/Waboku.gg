import { NextApiRequest, NextApiResponse } from 'next';

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  // Redirect favicon.png requests to favicon.ico
  res.redirect(301, '/favicon.ico');
}