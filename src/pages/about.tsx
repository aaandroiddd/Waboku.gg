import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Footer } from "@/components/Footer";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

export default function AboutPage() {
  return (
    <>
      <div className="container mx-auto py-12 px-4 space-y-16">
        {/* Hero Section */}
        <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-slate-900 to-slate-800 p-8 md:p-12">
          <div className="absolute inset-0 bg-[url('/images/cards-pattern.svg')] opacity-10"></div>
          <div className="relative z-10">
            <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">About Waboku.gg</h1>
            <p className="text-xl text-slate-300 max-w-3xl">
              Your premier destination for trading card game enthusiasts. We&apos;re dedicated to creating a safe, efficient, and enjoyable marketplace for buying, selling, and trading collectible cards.
            </p>
          </div>
        </div>

        {/* Mission Section */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="md:col-span-1">
            <h2 className="text-3xl font-bold tracking-tight">Our Mission</h2>
            <Badge variant="outline" className="mt-2">Community-Driven</Badge>
          </div>
          <div className="md:col-span-2">
            <p className="text-lg">
              Our mission is to connect TCG collectors and players through a user-friendly platform that prioritizes transparency, security, and community engagement. We believe in creating a space where enthusiasts can share their passion and build meaningful connections through their love of trading card games.
            </p>
          </div>
        </div>

        <Separator />

        {/* Features Section */}
        <div>
          <h2 className="text-3xl font-bold tracking-tight mb-8">Platform Features</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Feature Card 1 */}
            <Card className="border-none shadow-lg hover:shadow-xl transition-shadow">
              <CardContent className="pt-6">
                <div className="rounded-full w-12 h-12 flex items-center justify-center bg-primary/10 mb-4">
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-primary"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                </div>
                <h3 className="text-xl font-semibold mb-2">User Authentication</h3>
                <p className="text-muted-foreground">Secure login with email verification and multi-factor authentication support for enhanced account security.</p>
              </CardContent>
            </Card>

            {/* Feature Card 2 */}
            <Card className="border-none shadow-lg hover:shadow-xl transition-shadow">
              <CardContent className="pt-6">
                <div className="rounded-full w-12 h-12 flex items-center justify-center bg-primary/10 mb-4">
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-primary"><rect width="20" height="14" x="2" y="5" rx="2"></rect><line x1="2" x2="22" y1="10" y2="10"></line></svg>
                </div>
                <h3 className="text-xl font-semibold mb-2">Secure Payments</h3>
                <p className="text-muted-foreground">Integrated Stripe payment processing with buyer and seller protection for safe transactions.</p>
              </CardContent>
            </Card>

            {/* Feature Card 3 */}
            <Card className="border-none shadow-lg hover:shadow-xl transition-shadow">
              <CardContent className="pt-6">
                <div className="rounded-full w-12 h-12 flex items-center justify-center bg-primary/10 mb-4">
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-primary"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>
                </div>
                <h3 className="text-xl font-semibold mb-2">Local Trading</h3>
                <p className="text-muted-foreground">Location-based searching with distance indicators to find collectors in your area for in-person trades.</p>
              </CardContent>
            </Card>

            {/* Feature Card 4 */}
            <Card className="border-none shadow-lg hover:shadow-xl transition-shadow">
              <CardContent className="pt-6">
                <div className="rounded-full w-12 h-12 flex items-center justify-center bg-primary/10 mb-4">
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-primary"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
                </div>
                <h3 className="text-xl font-semibold mb-2">Real-time Messaging</h3>
                <p className="text-muted-foreground">Direct communication between buyers and sellers with real-time chat functionality.</p>
              </CardContent>
            </Card>

            {/* Feature Card 5 */}
            <Card className="border-none shadow-lg hover:shadow-xl transition-shadow">
              <CardContent className="pt-6">
                <div className="rounded-full w-12 h-12 flex items-center justify-center bg-primary/10 mb-4">
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-primary"><path d="M20.42 4.58a5.4 5.4 0 0 0-7.65 0l-.77.78-.77-.78a5.4 5.4 0 0 0-7.65 0C1.46 6.7 1.33 10.28 4 13l8 8 8-8c2.67-2.72 2.54-6.3.42-8.42z"></path></svg>
                </div>
                <h3 className="text-xl font-semibold mb-2">Favorites System</h3>
                <p className="text-muted-foreground">Save and track your favorite listings for easy access and monitoring.</p>
              </CardContent>
            </Card>

            {/* Feature Card 6 */}
            <Card className="border-none shadow-lg hover:shadow-xl transition-shadow">
              <CardContent className="pt-6">
                <div className="rounded-full w-12 h-12 flex items-center justify-center bg-primary/10 mb-4">
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-primary"><path d="M12 20h9"></path><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"></path></svg>
                </div>
                <h3 className="text-xl font-semibold mb-2">Wanted Posts</h3>
                <p className="text-muted-foreground">Create posts for cards you're looking to acquire, helping connect with sellers who have what you need.</p>
              </CardContent>
            </Card>
          </div>
          
          <div className="mt-8 text-center">
            <Badge variant="secondary" className="text-sm px-3 py-1">And many more features!</Badge>
          </div>
        </div>

        <Separator />

        {/* What Sets Us Apart Section */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="md:col-span-1">
            <h2 className="text-3xl font-bold tracking-tight">What Sets Us Apart</h2>
            <Badge variant="outline" className="mt-2">Unique Value</Badge>
          </div>
          <div className="md:col-span-2">
            <ul className="space-y-4">
              <li className="flex items-start">
                <div className="mr-3 mt-1 text-primary">
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                </div>
                <p><span className="font-semibold">Comprehensive card condition grading system</span> that ensures transparency and accuracy in listings</p>
              </li>
              <li className="flex items-start">
                <div className="mr-3 mt-1 text-primary">
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                </div>
                <p><span className="font-semibold">Secure and transparent transactions</span> with built-in protections for both buyers and sellers</p>
              </li>
              <li className="flex items-start">
                <div className="mr-3 mt-1 text-primary">
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                </div>
                <p><span className="font-semibold">Local trading community focus</span> that brings collectors together in their area</p>
              </li>
              <li className="flex items-start">
                <div className="mr-3 mt-1 text-primary">
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                </div>
                <p><span className="font-semibold">Expert verification for graded cards</span> to ensure authenticity and value</p>
              </li>
              <li className="flex items-start">
                <div className="mr-3 mt-1 text-primary">
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                </div>
                <p><span className="font-semibold">Integrated shipping and tracking solutions</span> for seamless order fulfillment</p>
              </li>
              <li className="flex items-start">
                <div className="mr-3 mt-1 text-primary">
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                </div>
                <p><span className="font-semibold">Robust offer and counter-offer system</span> that facilitates fair negotiations</p>
              </li>
            </ul>
          </div>
        </div>

        <Separator />

        {/* Community Section */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="md:col-span-1">
            <h2 className="text-3xl font-bold tracking-tight">Our Community</h2>
            <Badge variant="outline" className="mt-2">Growing Together</Badge>
          </div>
          <div className="md:col-span-2">
            <p className="text-lg mb-4">
              Waboku.gg is more than just a marketplace - it&apos;s a community of passionate collectors and players who share their love for trading card games. We strive to foster meaningful connections and create a positive environment for all our users.
            </p>
            <p className="text-lg">
              Join thousands of collectors who have found their perfect cards, made new friends, and enhanced their collections through our platform.
            </p>
          </div>
        </div>

        <Separator />

        {/* Ownership Section */}
        <div className="bg-slate-100 dark:bg-slate-800 rounded-xl p-8">
          <div className="flex flex-col md:flex-row items-center gap-6">
            <div className="w-24 h-24 rounded-full bg-primary/10 flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-primary"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
            </div>
            <div>
              <h2 className="text-2xl font-bold mb-2">Ownership</h2>
              <p className="text-lg">
                Waboku.gg is owned and operated by <span className="font-semibold">Brian Brown</span>, also known as <span className="font-semibold">&apos;aandroidd&apos;</span>. As a passionate collector and developer, Brian created this platform to address the needs of the TCG community and provide a modern, user-friendly marketplace experience.
              </p>
            </div>
          </div>
        </div>
      </div>
      <Footer />
    </>
  );
}