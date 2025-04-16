import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Footer } from "@/components/Footer";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function FAQPage() {
  return (
    <>
      <div className="container mx-auto py-12 px-4 space-y-16">
        {/* Hero Section */}
        <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-slate-900 to-slate-800 p-8 md:p-12">
          <div className="absolute inset-0 bg-[url('/images/cards-pattern.svg')] opacity-10"></div>
          <div className="relative z-10">
            <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">Frequently Asked Questions</h1>
            <p className="text-xl text-slate-300 max-w-3xl">
              Find answers to common questions about using Waboku.gg, our features, and how to get the most out of our platform.
            </p>
          </div>
        </div>

        {/* FAQ Categories */}
        <Tabs defaultValue="general" className="w-full">
          <div className="flex justify-center mb-8">
            <TabsList className="grid grid-cols-3 md:grid-cols-5 w-full max-w-3xl">
              <TabsTrigger value="general">General</TabsTrigger>
              <TabsTrigger value="listings">Listings</TabsTrigger>
              <TabsTrigger value="payments">Payments</TabsTrigger>
              <TabsTrigger value="features">Features</TabsTrigger>
              <TabsTrigger value="account">Account</TabsTrigger>
            </TabsList>
          </div>

          {/* General FAQs */}
          <TabsContent value="general" className="space-y-6">
            <div className="flex items-center gap-2 mb-4">
              <h2 className="text-2xl font-bold">General Questions</h2>
              <Badge>Basics</Badge>
            </div>
            <Card className="border-none shadow-lg">
              <CardContent className="pt-6">
                <Accordion type="single" collapsible className="w-full">
                  <AccordionItem value="general-1" className="border-b border-slate-200 dark:border-slate-700">
                    <AccordionTrigger className="text-lg font-medium py-4">What is Waboku.gg?</AccordionTrigger>
                    <AccordionContent className="text-muted-foreground pb-4 pt-1">
                      Waboku.gg is a specialized marketplace for trading card game enthusiasts. Our platform allows collectors and players to buy, sell, and trade collectible cards in a secure environment with features specifically designed for TCG communities.
                    </AccordionContent>
                  </AccordionItem>

                  <AccordionItem value="general-2" className="border-b border-slate-200 dark:border-slate-700">
                    <AccordionTrigger className="text-lg font-medium py-4">Which trading card games are supported?</AccordionTrigger>
                    <AccordionContent className="text-muted-foreground pb-4 pt-1">
                      We support a wide range of trading card games including Pokémon TCG, Magic: The Gathering, Yu-Gi-Oh!, and many others. Our platform is designed to accommodate various TCG communities with specific features for each game category.
                    </AccordionContent>
                  </AccordionItem>

                  <AccordionItem value="general-3" className="border-b border-slate-200 dark:border-slate-700">
                    <AccordionTrigger className="text-lg font-medium py-4">How does the local trading work?</AccordionTrigger>
                    <AccordionContent className="text-muted-foreground pb-4 pt-1">
                      Our platform connects you with collectors in your area using location-based searching with distance indicators. You can arrange meet-ups at safe locations or local game stores to complete transactions. Always prioritize safety and follow our community guidelines for in-person trades.
                    </AccordionContent>
                  </AccordionItem>

                  <AccordionItem value="general-4" className="border-b border-slate-200 dark:border-slate-700">
                    <AccordionTrigger className="text-lg font-medium py-4">How are disputes handled?</AccordionTrigger>
                    <AccordionContent className="text-muted-foreground pb-4 pt-1">
                      We have a dedicated support team to handle disputes. If you encounter any issues with a transaction, report it immediately through our support system. We&apos;ll review the case and work with both parties to reach a fair resolution based on our platform policies.
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Listings FAQs */}
          <TabsContent value="listings" className="space-y-6">
            <div className="flex items-center gap-2 mb-4">
              <h2 className="text-2xl font-bold">Listing Questions</h2>
              <Badge>Selling</Badge>
            </div>
            <Card className="border-none shadow-lg">
              <CardContent className="pt-6">
                <Accordion type="single" collapsible className="w-full">
                  <AccordionItem value="listings-1" className="border-b border-slate-200 dark:border-slate-700">
                    <AccordionTrigger className="text-lg font-medium py-4">How do I create a listing?</AccordionTrigger>
                    <AccordionContent className="text-muted-foreground pb-4 pt-1">
                      To create a listing, sign in to your account and click on the &quot;Create Listing&quot; button in your dashboard. Fill out the required information about your card, including its condition, price, and photos. Make sure to provide accurate details to help potential buyers make informed decisions.
                    </AccordionContent>
                  </AccordionItem>

                  <AccordionItem value="listings-2" className="border-b border-slate-200 dark:border-slate-700">
                    <AccordionTrigger className="text-lg font-medium py-4">What are the condition grades?</AccordionTrigger>
                    <AccordionContent className="text-muted-foreground pb-4 pt-1">
                      We use a standard grading system ranging from Poor to Mint. Each grade has specific criteria regarding card wear, edge quality, and surface condition. For graded cards, we also support professional grading companies&apos; scales such as PSA, BGS, and CGC.
                    </AccordionContent>
                  </AccordionItem>

                  <AccordionItem value="listings-3" className="border-b border-slate-200 dark:border-slate-700">
                    <AccordionTrigger className="text-lg font-medium py-4">How long do listings stay active?</AccordionTrigger>
                    <AccordionContent className="text-muted-foreground pb-4 pt-1">
                      Standard listings remain active for 30 days. Premium account holders can have extended listing durations. You can always renew your listings from your dashboard before they expire, or set them to auto-renew if you have a premium account.
                    </AccordionContent>
                  </AccordionItem>

                  <AccordionItem value="listings-4" className="border-b border-slate-200 dark:border-slate-700">
                    <AccordionTrigger className="text-lg font-medium py-4">Can I edit my listing after posting?</AccordionTrigger>
                    <AccordionContent className="text-muted-foreground pb-4 pt-1">
                      Yes, you can edit most details of your listing after posting. However, certain fundamental changes may require you to create a new listing to maintain marketplace integrity. You can access the edit function from your dashboard under the &quot;My Listings&quot; section.
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Payments FAQs */}
          <TabsContent value="payments" className="space-y-6">
            <div className="flex items-center gap-2 mb-4">
              <h2 className="text-2xl font-bold">Payment Questions</h2>
              <Badge>Transactions</Badge>
            </div>
            <Card className="border-none shadow-lg">
              <CardContent className="pt-6">
                <Accordion type="single" collapsible className="w-full">
                  <AccordionItem value="payments-1" className="border-b border-slate-200 dark:border-slate-700">
                    <AccordionTrigger className="text-lg font-medium py-4">What payment methods are accepted?</AccordionTrigger>
                    <AccordionContent className="text-muted-foreground pb-4 pt-1">
                      We support various secure payment methods through our Stripe integration, including major credit cards, debit cards, and some digital wallets. For local trades, payment methods can be arranged between parties, but we recommend using our secure payment system for added protection.
                    </AccordionContent>
                  </AccordionItem>

                  <AccordionItem value="payments-2" className="border-b border-slate-200 dark:border-slate-700">
                    <AccordionTrigger className="text-lg font-medium py-4">How does the offer system work?</AccordionTrigger>
                    <AccordionContent className="text-muted-foreground pb-4 pt-1">
                      Our offer system allows buyers to make offers below the listed price. Sellers can accept, decline, or counter these offers. Once an offer is accepted, the buyer will be prompted to complete the payment. The system facilitates negotiation while maintaining security for both parties.
                    </AccordionContent>
                  </AccordionItem>

                  <AccordionItem value="payments-3" className="border-b border-slate-200 dark:border-slate-700">
                    <AccordionTrigger className="text-lg font-medium py-4">Are there any fees for selling?</AccordionTrigger>
                    <AccordionContent className="text-muted-foreground pb-4 pt-1">
                      Yes, we charge a small percentage fee on successful sales to maintain the platform. The exact fee structure depends on your account tier. Premium sellers enjoy lower transaction fees. All fees are transparently displayed before you complete a sale.
                    </AccordionContent>
                  </AccordionItem>

                  <AccordionItem value="payments-4" className="border-b border-slate-200 dark:border-slate-700">
                    <AccordionTrigger className="text-lg font-medium py-4">How do I get paid as a seller?</AccordionTrigger>
                    <AccordionContent className="text-muted-foreground pb-4 pt-1">
                      Payments are processed through our Stripe Connect integration. Once you set up your seller account, payments will be deposited directly to your linked bank account. Standard processing time is 2-3 business days after the buyer confirms receipt of the item.
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Features FAQs */}
          <TabsContent value="features" className="space-y-6">
            <div className="flex items-center gap-2 mb-4">
              <h2 className="text-2xl font-bold">Platform Features</h2>
              <Badge>Functionality</Badge>
            </div>
            <Card className="border-none shadow-lg">
              <CardContent className="pt-6">
                <Accordion type="single" collapsible className="w-full">
                  <AccordionItem value="features-1" className="border-b border-slate-200 dark:border-slate-700">
                    <AccordionTrigger className="text-lg font-medium py-4">How does the messaging system work?</AccordionTrigger>
                    <AccordionContent className="text-muted-foreground pb-4 pt-1">
                      Our real-time messaging system allows buyers and sellers to communicate directly within the platform. You can discuss details, negotiate, and arrange transactions securely. All messages are saved in your account for future reference, and you'll receive notifications for new messages.
                    </AccordionContent>
                  </AccordionItem>

                  <AccordionItem value="features-2" className="border-b border-slate-200 dark:border-slate-700">
                    <AccordionTrigger className="text-lg font-medium py-4">What are Wanted Posts?</AccordionTrigger>
                    <AccordionContent className="text-muted-foreground pb-4 pt-1">
                      Wanted Posts allow you to create listings for cards you're looking to acquire. Other users can see these posts and contact you if they have the cards you want. This feature helps connect buyers with specific wants to sellers who have those items, even if they haven't listed them yet.
                    </AccordionContent>
                  </AccordionItem>

                  <AccordionItem value="features-3" className="border-b border-slate-200 dark:border-slate-700">
                    <AccordionTrigger className="text-lg font-medium py-4">How does the rating system work?</AccordionTrigger>
                    <AccordionContent className="text-muted-foreground pb-4 pt-1">
                      After completing a transaction, both buyers and sellers can leave ratings and reviews for each other. These ratings contribute to user reputation scores, helping build trust in the community. Detailed reviews provide valuable feedback about transaction experiences.
                    </AccordionContent>
                  </AccordionItem>

                  <AccordionItem value="features-4" className="border-b border-slate-200 dark:border-slate-700">
                    <AccordionTrigger className="text-lg font-medium py-4">How does shipping and tracking work?</AccordionTrigger>
                    <AccordionContent className="text-muted-foreground pb-4 pt-1">
                      Sellers can add tracking information to orders through their dashboard. Buyers receive automatic updates on their order status. Our system integrates with major shipping carriers to provide real-time tracking updates, ensuring transparency throughout the shipping process.
                    </AccordionContent>
                  </AccordionItem>

                  <AccordionItem value="features-5" className="border-b border-slate-200 dark:border-slate-700">
                    <AccordionTrigger className="text-lg font-medium py-4">What is the favorites system?</AccordionTrigger>
                    <AccordionContent className="text-muted-foreground pb-4 pt-1">
                      The favorites system allows you to save listings you're interested in for easy access later. You can manage your favorites from your dashboard and receive notifications about price changes or if favorited items are about to expire. This helps you keep track of cards you're considering purchasing.
                    </AccordionContent>
                  </AccordionItem>

                  <AccordionItem value="features-6" className="border-b border-slate-200 dark:border-slate-700">
                    <AccordionTrigger className="text-lg font-medium py-4">Is the platform mobile-friendly?</AccordionTrigger>
                    <AccordionContent className="text-muted-foreground pb-4 pt-1">
                      Yes, Waboku.gg is fully responsive and optimized for mobile devices. You can browse listings, manage your account, communicate with other users, and complete transactions from your smartphone or tablet with the same functionality as the desktop version.
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Account FAQs */}
          <TabsContent value="account" className="space-y-6">
            <div className="flex items-center gap-2 mb-4">
              <h2 className="text-2xl font-bold">Account Questions</h2>
              <Badge>User Management</Badge>
            </div>
            <Card className="border-none shadow-lg">
              <CardContent className="pt-6">
                <Accordion type="single" collapsible className="w-full">
                  <AccordionItem value="account-1" className="border-b border-slate-200 dark:border-slate-700">
                    <AccordionTrigger className="text-lg font-medium py-4">How do I create an account?</AccordionTrigger>
                    <AccordionContent className="text-muted-foreground pb-4 pt-1">
                      Creating an account is simple. Click the "Sign Up" button, enter your email address, create a password, and complete the verification process. You'll need to verify your email address to activate your account fully. We also offer authentication through various providers for your convenience.
                    </AccordionContent>
                  </AccordionItem>

                  <AccordionItem value="account-2" className="border-b border-slate-200 dark:border-slate-700">
                    <AccordionTrigger className="text-lg font-medium py-4">What is multi-factor authentication?</AccordionTrigger>
                    <AccordionContent className="text-muted-foreground pb-4 pt-1">
                      Multi-factor authentication (MFA) adds an extra layer of security to your account. When enabled, you'll need to provide a second form of verification (typically a code from an authenticator app) in addition to your password when signing in. This helps protect your account even if your password is compromised.
                    </AccordionContent>
                  </AccordionItem>

                  <AccordionItem value="account-3" className="border-b border-slate-200 dark:border-slate-700">
                    <AccordionTrigger className="text-lg font-medium py-4">What are the different account tiers?</AccordionTrigger>
                    <AccordionContent className="text-muted-foreground pb-4 pt-1">
                      We offer different account tiers including Free, Standard, and Premium. Each tier provides different benefits such as reduced fees, increased listing limits, extended listing durations, and premium features. You can upgrade your account at any time from your dashboard settings.
                    </AccordionContent>
                  </AccordionItem>

                  <AccordionItem value="account-4" className="border-b border-slate-200 dark:border-slate-700">
                    <AccordionTrigger className="text-lg font-medium py-4">How do I become a verified seller?</AccordionTrigger>
                    <AccordionContent className="text-muted-foreground pb-4 pt-1">
                      To become a verified seller, you need to complete our seller verification process. This includes confirming your identity, connecting a payment method through Stripe Connect, and maintaining a positive reputation on the platform. Verified sellers receive a badge on their profile and listings, increasing buyer trust.
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Contact Section */}
        <div className="bg-slate-100 dark:bg-slate-900 rounded-xl p-8 text-center">
          <h2 className="text-2xl font-bold mb-4">Still Have Questions?</h2>
          <p className="text-lg mb-6">If you couldn't find the answer you were looking for, our support team is here to help.</p>
          <div className="inline-block">
            <Badge variant="outline" className="text-lg px-4 py-2">Contact Support</Badge>
          </div>
        </div>
      </div>
      <Footer />
    </>
  );
}