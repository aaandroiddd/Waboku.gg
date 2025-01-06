import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Footer } from "@/components/Footer";

export default function FAQPage() {
  return (
    <>
      <div className="container mx-auto py-12 px-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-3xl font-bold text-center mb-6">Frequently Asked Questions</CardTitle>
          </CardHeader>
          <CardContent>
            <Accordion type="single" collapsible className="w-full">
              <AccordionItem value="item-1">
                <AccordionTrigger>How do I create a listing?</AccordionTrigger>
                <AccordionContent>
                  To create a listing, sign in to your account and click on the &quot;Create Listing&quot; button in your dashboard. Fill out the required information about your card, including its condition, price, and photos. Make sure to provide accurate details to help potential buyers make informed decisions.
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="item-2">
                <AccordionTrigger>What are the condition grades?</AccordionTrigger>
                <AccordionContent>
                  We use a standard grading system ranging from Poor to Mint. Each grade has specific criteria regarding card wear, edge quality, and surface condition. For graded cards, we also support professional grading companies&apos; scales.
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="item-3">
                <AccordionTrigger>How does the local trading work?</AccordionTrigger>
                <AccordionContent>
                  Our platform connects you with collectors in your area. You can arrange meet-ups at safe locations or local game stores to complete transactions. Always prioritize safety and follow our community guidelines for in-person trades.
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="item-4">
                <AccordionTrigger>What payment methods are accepted?</AccordionTrigger>
                <AccordionContent>
                  We support various secure payment methods through our platform. For local trades, payment methods can be arranged between parties, but we recommend using our secure payment system for added protection.
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="item-5">
                <AccordionTrigger>How are disputes handled?</AccordionTrigger>
                <AccordionContent>
                  We have a dedicated support team to handle disputes. If you encounter any issues with a transaction, report it immediately through our support system. We&apos;ll review the case and work with both parties to reach a fair resolution.
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </CardContent>
        </Card>
      </div>
      <Footer />
    </>
  );
}