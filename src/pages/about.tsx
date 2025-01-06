import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Footer } from "@/components/Footer";

export default function AboutPage() {
  return (
    <>
      <div className="container mx-auto py-12 px-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-3xl font-bold text-center mb-6">About Waboku.gg</CardTitle>
          </CardHeader>
          <CardContent className="prose dark:prose-invert max-w-none">
            <p className="text-lg mb-6">
              Welcome to Waboku.gg, your premier destination for trading card game enthusiasts. We&apos;re dedicated to creating a safe, efficient, and enjoyable marketplace for buying, selling, and trading collectible cards.
            </p>

            <h2 className="text-2xl font-semibold mt-8 mb-4">Our Mission</h2>
            <p className="mb-6">
              Our mission is to connect TCG collectors and players through a user-friendly platform that prioritizes transparency, security, and community engagement.
            </p>

            <h2 className="text-2xl font-semibold mt-8 mb-4">What Sets Us Apart</h2>
            <ul className="list-disc pl-6 mb-6">
              <li className="mb-2">Comprehensive card condition grading system</li>
              <li className="mb-2">Secure and transparent transactions</li>
              <li className="mb-2">Local trading community focus</li>
              <li className="mb-2">Expert verification for graded cards</li>
            </ul>

            <h2 className="text-2xl font-semibold mt-8 mb-4">Our Community</h2>
            <p className="mb-6">
              Waboku.gg is more than just a marketplace - it&apos;s a community of passionate collectors and players who share their love for trading card games. We strive to foster meaningful connections and create a positive environment for all our users.
            </p>
          </CardContent>
        </Card>
      </div>
      <Footer />
    </>
  );
}