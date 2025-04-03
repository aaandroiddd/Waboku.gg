import { useState, useEffect } from 'react';
import { Listing } from '@/types/database';
import { GAME_NAME_MAPPING } from '@/lib/game-mappings';

interface ListingVisibilityDebuggerProps {
  listingId?: string;
  game?: string;
}

export function ListingVisibilityDebugger({ listingId, game }: ListingVisibilityDebuggerProps) {
  const [debugInfo, setDebugInfo] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchListingData() {
      try {
        setLoading(true);
        
        // Only run in development
        if (process.env.NODE_ENV !== 'development') {
          setDebugInfo({ error: 'Debug component only available in development mode' });
          return;
        }
        
        if (!listingId) {
          setDebugInfo({ error: 'No listing ID provided' });
          return;
        }
        
        // Fetch the listing data from the API
        const response = await fetch(`/api/debug/check-listing?id=${listingId}`);
        const data = await response.json();
        
        if (!response.ok) {
          setDebugInfo({ error: data.error || 'Failed to fetch listing data' });
          return;
        }
        
        // If we have a game parameter, check if the listing matches the game
        if (game && data.listing) {
          const listingGameLower = (data.listing.game?.toLowerCase() || '').trim();
          const matchesGame = GAME_NAME_MAPPING[game]?.some(name => 
            listingGameLower === name.toLowerCase().trim()
          ) || false;
          
          data.gameMatching = {
            listingGame: data.listing.game,
            listingGameLower,
            selectedGame: game,
            mappedNames: GAME_NAME_MAPPING[game],
            matches: matchesGame
          };
        }
        
        setDebugInfo(data);
      } catch (error) {
        console.error('Error in ListingVisibilityDebugger:', error);
        setDebugInfo({ error: String(error) });
      } finally {
        setLoading(false);
      }
    }
    
    fetchListingData();
  }, [listingId, game]);

  if (process.env.NODE_ENV !== 'development') {
    return null;
  }

  return (
    <div className="bg-yellow-100 dark:bg-yellow-900 p-4 rounded-lg text-sm my-4">
      <h3 className="font-bold mb-2">Listing Visibility Debugger</h3>
      {loading ? (
        <p>Loading debug information...</p>
      ) : debugInfo?.error ? (
        <p className="text-red-500">{debugInfo.error}</p>
      ) : (
        <div className="space-y-2">
          <div>
            <strong>Listing ID:</strong> {debugInfo.listing?.id}
          </div>
          <div>
            <strong>Title:</strong> {debugInfo.listing?.title}
          </div>
          <div>
            <strong>Status:</strong> {debugInfo.listing?.status}
          </div>
          <div>
            <strong>Game:</strong> {debugInfo.listing?.game}
          </div>
          <div>
            <strong>Condition:</strong> {debugInfo.listing?.condition}
          </div>
          <div>
            <strong>Price:</strong> ${debugInfo.listing?.price}
          </div>
          <div>
            <strong>Created:</strong> {debugInfo.listing?.createdAt}
          </div>
          <div>
            <strong>Expires:</strong> {debugInfo.listing?.expiresAt}
          </div>
          
          {debugInfo.gameMatching && (
            <div className="mt-4 p-2 bg-blue-100 dark:bg-blue-900 rounded">
              <h4 className="font-bold">Game Matching Debug:</h4>
              <div>
                <strong>Listing Game:</strong> {debugInfo.gameMatching.listingGame}
              </div>
              <div>
                <strong>Normalized Game:</strong> {debugInfo.gameMatching.listingGameLower}
              </div>
              <div>
                <strong>Selected Game:</strong> {debugInfo.gameMatching.selectedGame}
              </div>
              <div>
                <strong>Mapped Names:</strong> {JSON.stringify(debugInfo.gameMatching.mappedNames)}
              </div>
              <div>
                <strong>Matches:</strong> {debugInfo.gameMatching.matches ? 'Yes' : 'No'}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}