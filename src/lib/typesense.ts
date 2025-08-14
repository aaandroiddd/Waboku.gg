import Typesense from 'typesense';

let typesenseClient: Typesense.Client | null = null;

export function getTypesenseClient(): Typesense.Client | null {
  // Return null if Typesense is not configured
  if (!process.env.TYPESENSE_HOST || !process.env.TYPESENSE_API_KEY_ADMIN) {
    return null;
  }

  // Return existing client if already initialized
  if (typesenseClient) {
    return typesenseClient;
  }

  try {
    typesenseClient = new Typesense.Client({
      nodes: [
        {
          host: process.env.TYPESENSE_HOST,
          port: parseInt(process.env.TYPESENSE_PORT || '443'),
          protocol: process.env.TYPESENSE_PROTOCOL || 'https',
        },
      ],
      apiKey: process.env.TYPESENSE_API_KEY_ADMIN,
      connectionTimeoutSeconds: 10,
    });

    return typesenseClient;
  } catch (error) {
    console.error('Failed to initialize Typesense client:', error);
    return null;
  }
}

export function getTypesenseSearchClient(): Typesense.Client | null {
  // Return null if Typesense is not configured
  if (!process.env.TYPESENSE_HOST || !process.env.TYPESENSE_API_KEY_SEARCH) {
    return null;
  }

  try {
    return new Typesense.Client({
      nodes: [
        {
          host: process.env.TYPESENSE_HOST,
          port: parseInt(process.env.TYPESENSE_PORT || '443'),
          protocol: process.env.TYPESENSE_PROTOCOL || 'https',
        },
      ],
      apiKey: process.env.TYPESENSE_API_KEY_SEARCH,
      connectionTimeoutSeconds: 10,
    });
  } catch (error) {
    console.error('Failed to initialize Typesense search client:', error);
    return null;
  }
}

export const LISTINGS_COLLECTION_NAME = 'listings';

export interface TypesenseListingDocument {
  id: string;
  title: string;
  cardName: string;
  description: string;
  game: string;
  condition: string;
  price: number;
  city: string;
  state: string;
  status: string;
  createdAt: number; // Unix timestamp
  expiresAt: number; // Unix timestamp
  imageUrl?: string;
  userId: string;
  username: string;
}

export const listingsCollectionSchema = {
  name: LISTINGS_COLLECTION_NAME,
  fields: [
    { name: 'id', type: 'string' },
    { name: 'title', type: 'string' },
    { name: 'cardName', type: 'string' },
    { name: 'description', type: 'string' },
    { name: 'game', type: 'string', facet: true },
    { name: 'condition', type: 'string', facet: true },
    { name: 'price', type: 'float', facet: true },
    { name: 'city', type: 'string', facet: true },
    { name: 'state', type: 'string', facet: true },
    { name: 'status', type: 'string', facet: true },
    { name: 'createdAt', type: 'int64', sort: true },
    { name: 'expiresAt', type: 'int64', sort: true },
    { name: 'imageUrl', type: 'string', optional: true },
    { name: 'userId', type: 'string' },
    { name: 'username', type: 'string' },
  ],
  default_sorting_field: 'createdAt',
};