import { useEffect } from "react";
import { useRouter } from "next/router";
import { useWantedPosts } from "@/hooks/useWantedPosts";
import { getWantedPostUrl } from "@/lib/wanted-posts-slug";
import { Skeleton } from "@/components/ui/skeleton";
import { PageTransition } from "@/components/PageTransition";
import Header from "@/components/Header";
import { Footer } from "@/components/Footer";

export default function LegacyWantedPostRedirectPage() {
  const router = useRouter();
  const { id } = router.query;
  const { getWantedPost } = useWantedPosts();

  useEffect(() => {
    if (!router.isReady || !id) return;

    const redirectToNewUrl = async () => {
      try {
        console.log(`Legacy redirect for wanted post ID: ${id}`);
        
        // Try to fetch the wanted post to get its details
        const post = await getWantedPost(id as string);
        
        if (post) {
          console.log(`Found legacy post: ${post.title}, generating new URL...`);
          
          // Generate the new URL format
          const newUrl = getWantedPostUrl(post);
          console.log(`Generated new URL: ${newUrl}`);
          
          // Redirect to the new URL format
          router.replace(newUrl);
          return;
        } else {
          console.log(`Legacy post not found for ID: ${id}`);
        }
        
        // Fallback to wanted posts page
        router.replace('/wanted/posts');
      } catch (error) {
        console.error('Error in legacy redirect:', error);
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
              <p className="text-sm text-muted-foreground mt-4">Redirecting to new URL format...</p>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </PageTransition>
  );
}