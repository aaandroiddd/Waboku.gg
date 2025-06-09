import { useEffect } from "react";
import { useRouter } from "next/router";
import { useWantedPosts } from "@/hooks/useWantedPosts";
import { getWantedPostUrl } from "@/lib/wanted-posts-slug";
import { Skeleton } from "@/components/ui/skeleton";
import { PageTransition } from "@/components/PageTransition";
import Header from "@/components/Header";
import { Footer } from "@/components/Footer";

export default function DirectWantedPostPage() {
  const router = useRouter();
  const { id } = router.query;
  const { getWantedPost } = useWantedPosts();

  useEffect(() => {
    if (!router.isReady || !id) return;

    const handleDirectId = async () => {
      try {
        console.log(`Direct wanted post access for ID: ${id}`);
        
        // Check if this looks like a Firebase document ID (starts with - or is long alphanumeric)
        if (typeof id === 'string' && (id.startsWith('-') || id.length > 10)) {
          console.log(`ID "${id}" looks like a Firebase document ID, trying direct fetch...`);
          
          // Try to fetch the wanted post directly using the Firebase ID
          const post = await getWantedPost(id);
          
          if (post) {
            console.log(`Found post: ${post.title}, generating new URL...`);
            
            // Generate the new URL format and redirect
            const newUrl = getWantedPostUrl(post);
            console.log(`Redirecting to new URL: ${newUrl}`);
            
            // Preserve any query parameters
            const queryParams = new URLSearchParams();
            Object.entries(router.query).forEach(([key, value]) => {
              if (key !== 'id' && value) {
                queryParams.set(key, Array.isArray(value) ? value[0] : value);
              }
            });
            
            const finalUrl = queryParams.toString() 
              ? `${newUrl}?${queryParams.toString()}`
              : newUrl;
            
            router.replace(finalUrl);
            return;
          } else {
            console.log(`Post not found for Firebase ID: ${id}`);
          }
        } else {
          console.log(`ID "${id}" doesn't look like a Firebase ID, redirecting to wanted posts`);
        }
        
        // Fallback to wanted posts page
        router.replace('/wanted/posts');
      } catch (error) {
        console.error('Error handling direct wanted post ID:', error);
        router.replace('/wanted/posts');
      }
    };

    handleDirectId();
  }, [router.isReady, id, router, getWantedPost]);

  // Show loading state while processing
  return (
    <PageTransition>
      <Header />
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <Skeleton className="h-8 w-48 mb-4 mx-auto" />
              <Skeleton className="h-4 w-64 mb-2 mx-auto" />
              <Skeleton className="h-4 w-32 mx-auto" />
              <p className="text-sm text-muted-foreground mt-4">Loading wanted post...</p>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </PageTransition>
  );
}