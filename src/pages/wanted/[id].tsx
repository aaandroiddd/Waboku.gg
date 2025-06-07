import { useEffect } from "react";
import { useRouter } from "next/router";
import { useWantedPosts } from "@/hooks/useWantedPosts";
import { getWantedPostUrl } from "@/lib/wanted-posts-slug";
import { Skeleton } from "@/components/ui/skeleton";
import { PageTransition } from "@/components/PageTransition";
import Header from "@/components/Header";
import { Footer } from "@/components/Footer";

export default function WantedPostRedirectPage() {
  const router = useRouter();
  const { id } = router.query;
  const { getWantedPost } = useWantedPosts();

  useEffect(() => {
    if (!router.isReady || !id) return;

    const redirectToNewUrl = async () => {
      try {
        console.log(`Attempting to redirect old wanted post URL: /wanted/${id}`);
        
        // Try to fetch the wanted post to get its details
        const post = await getWantedPost(id as string);
        
        if (post) {
          console.log(`Found post: ${post.title}, generating new URL...`);
          
          // Generate the new URL format
          const newUrl = getWantedPostUrl(post);
          console.log(`Generated new URL: ${newUrl}`);
          
          // Preserve any query parameters (like success=created)
          const queryParams = new URLSearchParams();
          Object.entries(router.query).forEach(([key, value]) => {
            if (key !== 'id' && value) {
              queryParams.set(key, Array.isArray(value) ? value[0] : value);
            }
          });
          
          const finalUrl = queryParams.toString() 
            ? `${newUrl}?${queryParams.toString()}`
            : newUrl;
          
          console.log(`Redirecting to: ${finalUrl}`);
          
          // Redirect to the new URL format
          router.replace(finalUrl);
        } else {
          console.log(`Post not found for ID: ${id}, redirecting to wanted posts page`);
          // If post not found, redirect to wanted posts page
          router.replace('/wanted/posts');
        }
      } catch (error) {
        console.error('Error redirecting to new URL:', error);
        
        // Try to create a short ID mapping if the post exists but mapping is missing
        try {
          console.log('Attempting to create short ID mapping for existing post...');
          const response = await fetch('/api/wanted/create-short-id-mapping', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ postId: id }),
          });
          
          if (response.ok) {
            const result = await response.json();
            console.log('Short ID mapping created:', result);
            
            // Try to fetch the post again
            const post = await getWantedPost(id as string);
            if (post) {
              const newUrl = getWantedPostUrl(post);
              console.log(`Redirecting to newly mapped URL: ${newUrl}`);
              router.replace(newUrl);
              return;
            }
          }
        } catch (mappingError) {
          console.error('Error creating short ID mapping:', mappingError);
        }
        
        // Fallback to wanted posts page
        console.log('Falling back to wanted posts page');
        router.replace('/wanted/posts');
      }
    };

    redirectToNewUrl();
  }, [router.isReady, id, router, getWantedPost]);

  // Show loading state while redirecting
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
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </PageTransition>
  );
}