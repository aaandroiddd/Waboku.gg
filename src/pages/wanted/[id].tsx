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
        // Try to fetch the wanted post to get its details
        const post = await getWantedPost(id as string);
        
        if (post) {
          // Generate the new URL format
          const newUrl = getWantedPostUrl(post);
          
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
          
          // Redirect to the new URL format
          router.replace(finalUrl);
        } else {
          // If post not found, redirect to wanted posts page
          router.replace('/wanted/posts');
        }
      } catch (error) {
        console.error('Error redirecting to new URL:', error);
        // Fallback to wanted posts page
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