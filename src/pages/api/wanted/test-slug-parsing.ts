import { NextApiRequest, NextApiResponse } from 'next';
import { extractWantedPostIdFromSlug, generateNumericShortId } from '@/lib/wanted-posts-slug';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { slug } = req.query;

  try {
    const testSlugs = [
      'need-absol-cards-599756',
      'pokemon-cards-123456',
      'test-post-999999',
      'another-test-654321'
    ];

    const results: any = {
      inputSlug: slug,
      testResults: {}
    };

    // Test the provided slug if any
    if (slug && typeof slug === 'string') {
      const extractedId = extractWantedPostIdFromSlug(slug);
      results.inputSlugResult = {
        slug,
        extractedId,
        isValid: extractedId !== null,
        isNumeric: extractedId ? /^\d+$/.test(extractedId) : false,
        length: extractedId ? extractedId.length : 0
      };
    }

    // Test various slug formats
    for (const testSlug of testSlugs) {
      const extractedId = extractWantedPostIdFromSlug(testSlug);
      results.testResults[testSlug] = {
        extractedId,
        isValid: extractedId !== null,
        isNumeric: extractedId ? /^\d+$/.test(extractedId) : false,
        length: extractedId ? extractedId.length : 0
      };
    }

    // Test generating short IDs from Firebase IDs
    const testFirebaseIds = [
      '-O1234567890abcdef',
      '-N9876543210fedcba',
      'someRandomFirebaseId123'
    ];

    results.shortIdGeneration = {};
    for (const firebaseId of testFirebaseIds) {
      const shortId = generateNumericShortId(firebaseId);
      results.shortIdGeneration[firebaseId] = {
        shortId,
        length: shortId.length,
        isNumeric: /^\d+$/.test(shortId)
      };
    }

    return res.status(200).json(results);

  } catch (error) {
    console.error('Error in slug parsing test:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}