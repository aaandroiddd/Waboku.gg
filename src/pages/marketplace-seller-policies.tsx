import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Footer } from "@/components/Footer";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CheckCircle, AlertTriangle, XCircle, Shield, DollarSign, Package, Clock, Star } from "lucide-react";

export default function MarketplaceSellerPoliciesPage() {
  return (
    <>
      <div className="container mx-auto py-12 px-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-3xl font-bold text-center mb-6">Marketplace Seller Policies</CardTitle>
            <p className="text-center text-muted-foreground">Last updated August 7, 2025</p>
          </CardHeader>
          <CardContent className="prose dark:prose-invert max-w-none">
            <p className="text-lg mb-6">
              These Marketplace Seller Policies ("Seller Policies") establish the specific requirements, standards, and obligations for users who sell trading cards and collectibles on the Waboku.gg and WTCG.gg platforms ("Platform"). These policies supplement and are incorporated into our Terms of Use.
            </p>

            <div className="bg-primary/10 p-6 rounded-lg mb-8 border border-primary">
              <div className="flex items-start gap-3">
                <Shield className="h-6 w-6 text-primary flex-shrink-0 mt-1" />
                <div>
                  <p className="font-semibold mb-2 text-primary">Seller Agreement</p>
                  <p className="text-sm">By listing items for sale on our Platform, you agree to comply with all seller policies outlined below. Violation of these policies may result in listing removal, account restrictions, or permanent suspension from selling privileges.</p>
                </div>
              </div>
            </div>

            <Separator className="my-8" />

            <h2 className="text-2xl font-semibold mt-8 mb-4">Table of Contents</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-8">
              <div className="space-y-1">
                <p className="text-sm"><a href="#section-1" className="text-primary hover:underline">1. Seller Eligibility and Account Requirements</a></p>
                <p className="text-sm"><a href="#section-2" className="text-primary hover:underline">2. Listing Standards and Requirements</a></p>
                <p className="text-sm"><a href="#section-3" className="text-primary hover:underline">3. Item Condition and Grading Standards</a></p>
                <p className="text-sm"><a href="#section-4" className="text-primary hover:underline">4. Pricing and Fee Policies</a></p>
                <p className="text-sm"><a href="#section-5" className="text-primary hover:underline">5. Order Fulfillment and Shipping</a></p>
                <p className="text-sm"><a href="#section-6" className="text-primary hover:underline">6. Communication and Customer Service</a></p>
                <p className="text-sm"><a href="#section-7" className="text-primary hover:underline">7. Returns, Refunds, and Disputes</a></p>
                <p className="text-sm"><a href="#section-8" className="text-primary hover:underline">8. Prohibited Items and Practices</a></p>
              </div>
              <div className="space-y-1">
                <p className="text-sm"><a href="#section-9" className="text-primary hover:underline">9. Payment Processing and Payouts</a></p>
                <p className="text-sm"><a href="#section-10" className="text-primary hover:underline">10. Performance Standards and Metrics</a></p>
                <p className="text-sm"><a href="#section-11" className="text-primary hover:underline">11. Intellectual Property and Authenticity</a></p>
                <p className="text-sm"><a href="#section-12" className="text-primary hover:underline">12. Local Trading and Pickup Policies</a></p>
                <p className="text-sm"><a href="#section-13" className="text-primary hover:underline">13. Compliance and Legal Requirements</a></p>
                <p className="text-sm"><a href="#section-14" className="text-primary hover:underline">14. Enforcement and Penalties</a></p>
                <p className="text-sm"><a href="#section-15" className="text-primary hover:underline">15. Seller Support and Resources</a></p>
                <p className="text-sm"><a href="#section-16" className="text-primary hover:underline">16. Policy Updates and Changes</a></p>
              </div>
            </div>

            <Separator className="my-8" />

            <h2 id="section-1" className="text-2xl font-semibold mt-8 mb-4">1. Seller Eligibility and Account Requirements</h2>
            
            <h3 className="text-xl font-semibold mt-6 mb-3">Basic Eligibility</h3>
            <p className="mb-4">To sell on our Platform, you must:</p>
            <ul className="list-disc pl-6 mb-4">
              <li>Be at least 18 years old or have parental/guardian consent</li>
              <li>Have a verified email address</li>
              <li>Complete your user profile with accurate information</li>
              <li>Agree to these Seller Policies and our Terms of Use</li>
              <li>Comply with all applicable laws and regulations</li>
            </ul>

            <h3 className="text-xl font-semibold mt-6 mb-3">Enhanced Seller Requirements</h3>
            <div className="bg-muted p-4 rounded-lg mb-6">
              <p className="font-semibold mb-2">For Stripe Connect Integration (Required for Payment Processing):</p>
              <ul className="list-disc pl-6 space-y-1">
                <li><strong>Email Verification:</strong> Must have a verified email address</li>
                <li><strong>Two-Factor Authentication:</strong> Must enable 2FA for account security</li>
                <li><strong>Account Age:</strong> Account must be at least 1 week old</li>
                <li><strong>Identity Verification:</strong> Must complete Stripe's identity verification process</li>
                <li><strong>Bank Account:</strong> Must link a valid bank account for payouts</li>
              </ul>
            </div>

            <h3 className="text-xl font-semibold mt-6 mb-3">Account Restrictions</h3>
            <p className="mb-6">Users with the following may be restricted from selling:</p>
            <ul className="list-disc pl-6 mb-6">
              <li>Previous account suspensions or bans</li>
              <li>Outstanding disputes or unresolved issues</li>
              <li>Failure to meet performance standards</li>
              <li>Violation of platform policies</li>
            </ul>

            <Separator className="my-8" />

            <h2 id="section-2" className="text-2xl font-semibold mt-8 mb-4">2. Listing Standards and Requirements</h2>
            
            <h3 className="text-xl font-semibold mt-6 mb-3">Required Information</h3>
            <p className="mb-4">Every listing must include:</p>
            <div className="bg-muted p-4 rounded-lg mb-6">
              <ul className="list-disc pl-6 space-y-1">
                <li><strong>Accurate Title:</strong> Clear, descriptive title including card name and key details</li>
                <li><strong>Game Category:</strong> Correct game selection (Pokémon, Yu-Gi-Oh!, Magic: The Gathering, etc.)</li>
                <li><strong>Detailed Description:</strong> Comprehensive description of the item's condition and features</li>
                <li><strong>High-Quality Images:</strong> Clear, well-lit photos showing the actual item</li>
                <li><strong>Condition Assessment:</strong> Honest evaluation using our grading standards</li>
                <li><strong>Fair Pricing:</strong> Competitive pricing based on current market values</li>
                <li><strong>Shipping Information:</strong> Clear shipping terms and handling time</li>
              </ul>
            </div>

            <h3 className="text-xl font-semibold mt-6 mb-3">Image Requirements</h3>
            <Alert className="mb-6">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                <strong>Photo Policy:</strong> All images must show the actual item being sold. Stock photos, promotional images, or photos of different items are strictly prohibited.
              </AlertDescription>
            </Alert>

            <p className="mb-4">Image standards:</p>
            <ul className="list-disc pl-6 mb-4">
              <li>Minimum resolution of 800x600 pixels</li>
              <li>Clear focus with good lighting</li>
              <li>Show front and back of cards when applicable</li>
              <li>Highlight any damage, wear, or imperfections</li>
              <li>Include close-ups of important details</li>
              <li>Maximum of 10 images per listing</li>
            </ul>

            <h3 className="text-xl font-semibold mt-6 mb-3">Listing Limits</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <div className="bg-muted p-4 rounded-lg">
                <h4 className="font-semibold mb-2 flex items-center gap-2">
                  <Badge variant="secondary">Free Account</Badge>
                </h4>
                <ul className="text-sm space-y-1">
                  <li>• Maximum 2 active listings</li>
                  <li>• Standard listing tools</li>
                  <li>• 24-hour offer expiration</li>
                </ul>
              </div>
              <div className="bg-primary/10 p-4 rounded-lg border border-primary">
                <h4 className="font-semibold mb-2 flex items-center gap-2">
                  <Badge className="bg-primary text-primary-foreground">Premium Account</Badge>
                </h4>
                <ul className="text-sm space-y-1">
                  <li>• Unlimited active listings</li>
                  <li>• Bulk listing tools</li>
                  <li>• Extended offer options (24h-7d)</li>
                  <li>• Priority support</li>
                </ul>
              </div>
            </div>

            <Separator className="my-8" />

            <h2 id="section-3" className="text-2xl font-semibold mt-8 mb-4">3. Item Condition and Grading Standards</h2>
            
            <h3 className="text-xl font-semibold mt-6 mb-3">Condition Categories</h3>
            <p className="mb-4">Use our standardized condition categories to accurately describe your items:</p>
            
            <div className="space-y-4 mb-6">
              <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg border border-green-200 dark:border-green-800">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  <h4 className="font-semibold text-green-800 dark:text-green-200">Near Mint (NM)</h4>
                </div>
                <p className="text-sm text-green-700 dark:text-green-300">Appears unplayed with minimal to no wear. May have very slight edge wear or minor printing imperfections.</p>
              </div>

              <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
                <div className="flex items-center gap-2 mb-2">
                  <Star className="h-5 w-5 text-blue-600" />
                  <h4 className="font-semibold text-blue-800 dark:text-blue-200">Lightly Played (LP)</h4>
                </div>
                <p className="text-sm text-blue-700 dark:text-blue-300">Shows minor wear from play. May have slight edge wear, corner wear, or minor scratches.</p>
              </div>

              <div className="bg-yellow-50 dark:bg-yellow-900/20 p-4 rounded-lg border border-yellow-200 dark:border-yellow-800">
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle className="h-5 w-5 text-yellow-600" />
                  <h4 className="font-semibold text-yellow-800 dark:text-yellow-200">Moderately Played (MP)</h4>
                </div>
                <p className="text-sm text-yellow-700 dark:text-yellow-300">Shows moderate wear from play. May have edge wear, corner wear, scratches, or minor creases.</p>
              </div>

              <div className="bg-orange-50 dark:bg-orange-900/20 p-4 rounded-lg border border-orange-200 dark:border-orange-800">
                <div className="flex items-center gap-2 mb-2">
                  <XCircle className="h-5 w-5 text-orange-600" />
                  <h4 className="font-semibold text-orange-800 dark:text-orange-200">Heavily Played (HP)</h4>
                </div>
                <p className="text-sm text-orange-700 dark:text-orange-300">Shows significant wear from play. May have major edge wear, corner damage, creases, or other visible damage.</p>
              </div>

              <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-lg border border-red-200 dark:border-red-800">
                <div className="flex items-center gap-2 mb-2">
                  <XCircle className="h-5 w-5 text-red-600" />
                  <h4 className="font-semibold text-red-800 dark:text-red-200">Damaged (DMG)</h4>
                </div>
                <p className="text-sm text-red-700 dark:text-red-300">Shows severe wear or damage. May have major creases, tears, stains, or other significant damage.</p>
              </div>
            </div>

            <h3 className="text-xl font-semibold mt-6 mb-3">Grading Accuracy</h3>
            <Alert className="mb-6">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                <strong>Accuracy Requirement:</strong> Condition assessments must be conservative and accurate. When in doubt, grade down to the next lower condition to ensure buyer satisfaction.
              </AlertDescription>
            </Alert>

            <h3 className="text-xl font-semibold mt-6 mb-3">Professional Grading</h3>
            <p className="mb-6">For professionally graded cards (PSA, BGS, CGC, etc.), you must clearly indicate the grading company and grade in both the title and description. Include clear photos of the graded card and certification label.</p>

            <Separator className="my-8" />

            <h2 id="section-4" className="text-2xl font-semibold mt-8 mb-4">4. Pricing and Fee Policies</h2>
            
            <h3 className="text-xl font-semibold mt-6 mb-3">Fair Pricing Standards</h3>
            <p className="mb-4">Sellers must price items fairly based on:</p>
            <ul className="list-disc pl-6 mb-4">
              <li>Current market values and recent sales data</li>
              <li>Item condition and rarity</li>
              <li>Comparable listings on the platform</li>
              <li>Industry pricing guides and resources</li>
            </ul>

            <h3 className="text-xl font-semibold mt-6 mb-3">Platform Fees</h3>
            <div className="bg-muted p-4 rounded-lg mb-6">
              <p className="font-semibold mb-2 flex items-center gap-2">
                <DollarSign className="h-5 w-5" />
                Transaction Fees
              </p>
              <p className="text-sm mb-3">Platform fees are automatically deducted from your sale proceeds and vary based on:</p>
              <ul className="list-disc pl-6 text-sm space-y-1">
                <li>Account type (free vs. premium)</li>
                <li>Transaction amount</li>
                <li>Payment processing fees</li>
                <li>Stripe Connect processing fees</li>
              </ul>
            </div>

            <h3 className="text-xl font-semibold mt-6 mb-3">Price Negotiation</h3>
            <p className="mb-4">Our platform supports price negotiation through:</p>
            <ul className="list-disc pl-6 mb-4">
              <li><strong>Offers System:</strong> Buyers can make offers on your listings</li>
              <li><strong>Price Negotiable Option:</strong> Mark listings as open to negotiation</li>
              <li><strong>Counteroffer Capability:</strong> Respond to offers with counteroffers</li>
              <li><strong>Offer Expiration:</strong> Set appropriate expiration times for offers</li>
            </ul>

            <h3 className="text-xl font-semibold mt-6 mb-3">Prohibited Pricing Practices</h3>
            <div className="bg-destructive/10 p-4 rounded-lg mb-6">
              <ul className="list-disc pl-6 space-y-1">
                <li>Price manipulation or artificial inflation</li>
                <li>Coordinated pricing with other sellers</li>
                <li>Bait-and-switch pricing tactics</li>
                <li>Hidden fees not disclosed in the listing</li>
                <li>Excessive shipping charges to circumvent platform fees</li>
              </ul>
            </div>

            <Separator className="my-8" />

            <h2 id="section-5" className="text-2xl font-semibold mt-8 mb-4">5. Order Fulfillment and Shipping</h2>
            
            <h3 className="text-xl font-semibold mt-6 mb-3">Shipping Requirements</h3>
            <div className="bg-muted p-4 rounded-lg mb-6">
              <p className="font-semibold mb-2 flex items-center gap-2">
                <Package className="h-5 w-5" />
                Mandatory Shipping Standards
              </p>
              <ul className="list-disc pl-6 space-y-1 text-sm">
                <li><strong>Handling Time:</strong> Ship within 2-3 business days of payment confirmation</li>
                <li><strong>Secure Packaging:</strong> Use appropriate protection to prevent damage</li>
                <li><strong>Tracking Information:</strong> Provide tracking numbers when available</li>
                <li><strong>Status Updates:</strong> Update shipping status in your seller dashboard</li>
                <li><strong>Communication:</strong> Respond to shipping inquiries promptly</li>
              </ul>
            </div>

            <h3 className="text-xl font-semibold mt-6 mb-3">Packaging Standards</h3>
            <p className="mb-4">Proper packaging requirements:</p>
            <ul className="list-disc pl-6 mb-4">
              <li><strong>Card Protection:</strong> Use toploaders, sleeves, or team bags for individual cards</li>
              <li><strong>Bubble Mailers:</strong> Use padded envelopes for single cards or small orders</li>
              <li><strong>Boxes:</strong> Use sturdy boxes for larger orders or valuable items</li>
              <li><strong>Moisture Protection:</strong> Include moisture protection for valuable items</li>
              <li><strong>Fragile Items:</strong> Add extra padding and "Fragile" labels when appropriate</li>
            </ul>

            <h3 className="text-xl font-semibold mt-6 mb-3">Shipping Methods and Insurance</h3>
            <p className="mb-4">Recommended shipping practices:</p>
            <ul className="list-disc pl-6 mb-4">
              <li>Use tracked shipping methods for orders over $20</li>
              <li>Consider insurance for high-value items ($100+)</li>
              <li>Offer expedited shipping options when possible</li>
              <li>Clearly communicate shipping costs and timeframes</li>
            </ul>

            <h3 className="text-xl font-semibold mt-6 mb-3">Shipping Delays and Issues</h3>
            <Alert className="mb-6">
              <Clock className="h-4 w-4" />
              <AlertDescription>
                <strong>Delay Notification:</strong> If you cannot ship within the specified timeframe, you must notify the buyer immediately and provide an updated shipping estimate.
              </AlertDescription>
            </Alert>

            <Separator className="my-8" />

            <h2 id="section-6" className="text-2xl font-semibold mt-8 mb-4">6. Communication and Customer Service</h2>
            
            <h3 className="text-xl font-semibold mt-6 mb-3">Response Time Standards</h3>
            <p className="mb-4">Sellers must maintain professional communication by:</p>
            <ul className="list-disc pl-6 mb-4">
              <li>Responding to buyer messages within 24 hours</li>
              <li>Providing clear, helpful, and courteous responses</li>
              <li>Using the platform's messaging system for all communications</li>
              <li>Maintaining professional language and tone</li>
            </ul>

            <h3 className="text-xl font-semibold mt-6 mb-3">Required Communications</h3>
            <div className="bg-muted p-4 rounded-lg mb-6">
              <p className="font-semibold mb-2">You must proactively communicate:</p>
              <ul className="list-disc pl-6 space-y-1 text-sm">
                <li>Order confirmation and expected shipping date</li>
                <li>Shipping confirmation with tracking information</li>
                <li>Any delays or issues that arise</li>
                <li>Delivery confirmation when applicable</li>
                <li>Response to any buyer concerns or questions</li>
              </ul>
            </div>

            <h3 className="text-xl font-semibold mt-6 mb-3">Professional Standards</h3>
            <p className="mb-6">All seller communications must be:</p>
            <ul className="list-disc pl-6 mb-6">
              <li>Professional and courteous in tone</li>
              <li>Clear and informative</li>
              <li>Honest and transparent</li>
              <li>Focused on resolving buyer concerns</li>
              <li>Compliant with platform policies</li>
            </ul>

            <Separator className="my-8" />

            <h2 id="section-7" className="text-2xl font-semibold mt-8 mb-4">7. Returns, Refunds, and Disputes</h2>
            
            <h3 className="text-xl font-semibold mt-6 mb-3">Return Policy</h3>
            <p className="mb-4">Sellers must accept returns for:</p>
            <ul className="list-disc pl-6 mb-4">
              <li>Items significantly not as described</li>
              <li>Items damaged during shipping (when properly packaged)</li>
              <li>Items that arrive in worse condition than listed</li>
              <li>Wrong items sent</li>
            </ul>

            <h3 className="text-xl font-semibold mt-6 mb-3">Refund Requirements</h3>
            <div className="bg-muted p-4 rounded-lg mb-6">
              <p className="font-semibold mb-2">Refund Scenarios:</p>
              <ul className="list-disc pl-6 space-y-1 text-sm">
                <li><strong>Full Refund:</strong> Item not as described, damaged, or not delivered</li>
                <li><strong>Partial Refund:</strong> Minor discrepancies that don't warrant full return</li>
                <li><strong>Return + Refund:</strong> Buyer returns item in original condition</li>
                <li><strong>No Refund:</strong> Buyer's remorse or change of mind (unless seller agrees)</li>
              </ul>
            </div>

            <h3 className="text-xl font-semibold mt-6 mb-3">Dispute Resolution Process</h3>
            <p className="mb-4">When disputes arise:</p>
            <ol className="list-decimal pl-6 mb-4">
              <li>Attempt direct resolution with the buyer through messaging</li>
              <li>Document all communications and evidence</li>
              <li>Escalate to platform support if direct resolution fails</li>
              <li>Cooperate fully with platform investigation</li>
              <li>Accept platform's final resolution decision</li>
            </ol>

            <h3 className="text-xl font-semibold mt-6 mb-3">Seller Protection</h3>
            <p className="mb-6">Sellers are protected against:</p>
            <ul className="list-disc pl-6 mb-6">
              <li>Fraudulent chargeback claims when proper documentation is provided</li>
              <li>Buyer's remorse returns (unless seller agrees)</li>
              <li>Items damaged after delivery confirmation</li>
              <li>False "not as described" claims with proper evidence</li>
            </ul>

            <Separator className="my-8" />

            <h2 id="section-8" className="text-2xl font-semibold mt-8 mb-4">8. Prohibited Items and Practices</h2>
            
            <h3 className="text-xl font-semibold mt-6 mb-3">Prohibited Items</h3>
            <div className="bg-destructive/10 p-4 rounded-lg mb-6">
              <p className="font-semibold mb-2 text-destructive">Strictly Prohibited:</p>
              <ul className="list-disc pl-6 space-y-1 text-sm">
                <li><strong>Counterfeit Cards:</strong> Fake, proxy, or reproduction cards</li>
                <li><strong>Stolen Merchandise:</strong> Items obtained through theft or fraud</li>
                <li><strong>Damaged Grading Labels:</strong> Cards with tampered or damaged grading certificates</li>
                <li><strong>Adult Content:</strong> Cards or items with explicit or inappropriate content</li>
                <li><strong>Non-TCG Items:</strong> Items outside our trading card marketplace scope</li>
                <li><strong>Digital Items:</strong> Digital codes, accounts, or virtual items</li>
                <li><strong>Illegal Items:</strong> Items that violate local, state, or federal laws</li>
              </ul>
            </div>

            <h3 className="text-xl font-semibold mt-6 mb-3">Prohibited Selling Practices</h3>
            <div className="bg-destructive/10 p-4 rounded-lg mb-6">
              <ul className="list-disc pl-6 space-y-1 text-sm">
                <li><strong>Bait and Switch:</strong> Listing one item but sending another</li>
                <li><strong>Shill Bidding:</strong> Using fake accounts to inflate prices</li>
                <li><strong>Fee Avoidance:</strong> Attempting to circumvent platform fees</li>
                <li><strong>Off-Platform Sales:</strong> Directing buyers to complete transactions elsewhere</li>
                <li><strong>False Advertising:</strong> Misrepresenting item condition, rarity, or value</li>
                <li><strong>Spam Listings:</strong> Creating duplicate or excessive listings</li>
                <li><strong>Review Manipulation:</strong> Fake reviews or review trading</li>
              </ul>
            </div>

            <h3 className="text-xl font-semibold mt-6 mb-3">Authenticity Requirements</h3>
            <p className="mb-6">Sellers must ensure all items are authentic and accurately represented. If authenticity is questioned, sellers must provide proof of authenticity or accept returns/refunds.</p>

            <Separator className="my-8" />

            <h2 id="section-9" className="text-2xl font-semibold mt-8 mb-4">9. Payment Processing and Payouts</h2>
            
            <h3 className="text-xl font-semibold mt-6 mb-3">Stripe Connect Integration</h3>
            <p className="mb-4">All seller payments are processed through Stripe Connect, which requires:</p>
            <ul className="list-disc pl-6 mb-4">
              <li>Completion of Stripe's identity verification process</li>
              <li>Valid bank account for direct deposits</li>
              <li>Compliance with Stripe's terms of service</li>
              <li>Tax information as required by law</li>
            </ul>

            <h3 className="text-xl font-semibold mt-6 mb-3">Payout Schedule</h3>
            <div className="bg-muted p-4 rounded-lg mb-6">
              <p className="font-semibold mb-2">Standard Payout Terms:</p>
              <ul className="list-disc pl-6 space-y-1 text-sm">
                <li><strong>Frequency:</strong> Daily automatic payouts</li>
                <li><strong>Processing Time:</strong> 2-7 business days to your bank account</li>
                <li><strong>New Accounts:</strong> May have longer holds for risk assessment</li>
                <li><strong>High-Value Sales:</strong> May have extended holds for verification</li>
              </ul>
            </div>

            <h3 className="text-xl font-semibold mt-6 mb-3">Payment Holds and Reserves</h3>
            <p className="mb-4">Payments may be held or reserved for:</p>
            <ul className="list-disc pl-6 mb-4">
              <li>New seller accounts (first 30 days)</li>
              <li>High-value transactions requiring additional verification</li>
              <li>Disputed transactions under investigation</li>
              <li>Accounts with performance issues</li>
              <li>Risk management and fraud prevention</li>
            </ul>

            <h3 className="text-xl font-semibold mt-6 mb-3">Tax Responsibilities</h3>
            <Alert className="mb-6">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                <strong>Tax Compliance:</strong> Sellers are solely responsible for all tax obligations related to their sales, including income tax, sales tax, and any required tax reporting.
              </AlertDescription>
            </Alert>

            <Separator className="my-8" />

            <h2 id="section-10" className="text-2xl font-semibold mt-8 mb-4">10. Performance Standards and Metrics</h2>
            
            <h3 className="text-xl font-semibold mt-6 mb-3">Key Performance Indicators</h3>
            <p className="mb-4">Sellers are evaluated on:</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <div className="bg-muted p-4 rounded-lg">
                <h4 className="font-semibold mb-2">Shipping Performance</h4>
                <ul className="text-sm space-y-1">
                  <li>• On-time shipping rate</li>
                  <li>• Tracking upload rate</li>
                  <li>• Delivery confirmation rate</li>
                </ul>
              </div>
              <div className="bg-muted p-4 rounded-lg">
                <h4 className="font-semibold mb-2">Customer Satisfaction</h4>
                <ul className="text-sm space-y-1">
                  <li>• Buyer feedback ratings</li>
                  <li>• Item as described accuracy</li>
                  <li>• Communication responsiveness</li>
                </ul>
              </div>
            </div>

            <h3 className="text-xl font-semibold mt-6 mb-3">Performance Thresholds</h3>
            <div className="space-y-4 mb-6">
              <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg border border-green-200 dark:border-green-800">
                <h4 className="font-semibold text-green-800 dark:text-green-200 mb-2">Excellent Performance</h4>
                <ul className="text-sm text-green-700 dark:text-green-300 space-y-1">
                  <li>• 95%+ on-time shipping rate</li>
                  <li>• 4.5+ average rating</li>
                  <li>• &lt;5% dispute rate</li>
                </ul>
              </div>
              
              <div className="bg-yellow-50 dark:bg-yellow-900/20 p-4 rounded-lg border border-yellow-200 dark:border-yellow-800">
                <h4 className="font-semibold text-yellow-800 dark:text-yellow-200 mb-2">Below Standards</h4>
                <ul className="text-sm text-yellow-700 dark:text-yellow-300 space-y-1">
                  <li>• &lt;85% on-time shipping rate</li>
                  <li>• &lt;4.0 average rating</li>
                  <li>• &gt;10% dispute rate</li>
                </ul>
              </div>
            </div>

            <h3 className="text-xl font-semibold mt-6 mb-3">Performance Improvement</h3>
            <p className="mb-6">Sellers with below-standard performance will receive guidance and support to improve, including access to seller resources, best practice guides, and direct support assistance.</p>

            <Separator className="my-8" />

            <h2 id="section-11" className="text-2xl font-semibold mt-8 mb-4">11. Intellectual Property and Authenticity</h2>
            
            <h3 className="text-xl font-semibold mt-6 mb-3">Intellectual Property Compliance</h3>
            <p className="mb-4">Sellers must respect intellectual property rights by:</p>
            <ul className="list-disc pl-6 mb-4">
              <li>Only selling authentic, officially licensed trading cards</li>
              <li>Not creating or selling counterfeit items</li>
              <li>Respecting trademark and copyright protections</li>
              <li>Using accurate product names and descriptions</li>
              <li>Not infringing on third-party intellectual property</li>
            </ul>

            <h3 className="text-xl font-semibold mt-6 mb-3">Authenticity Verification</h3>
            <div className="bg-muted p-4 rounded-lg mb-6">
              <p className="font-semibold mb-2">Authenticity Standards:</p>
              <ul className="list-disc pl-6 space-y-1 text-sm">
                <li>All items must be genuine, officially produced trading cards</li>
                <li>Professionally graded cards must include valid certification</li>
                <li>Sellers must disclose any known authenticity concerns</li>
                <li>Proof of authenticity may be required for high-value items</li>
                <li>Suspected counterfeit items will be removed immediately</li>
              </ul>
            </div>

            <h3 className="text-xl font-semibold mt-6 mb-3">Copyright and Trademark Usage</h3>
            <p className="mb-6">When creating listings, sellers may use official product names and descriptions for identification purposes but may not:</p>
            <ul className="list-disc pl-6 mb-6">
              <li>Claim ownership of copyrighted artwork or trademarks</li>
              <li>Use copyrighted images without permission</li>
              <li>Misrepresent their relationship with card manufacturers</li>
              <li>Create derivative works based on copyrighted material</li>
            </ul>

            <Separator className="my-8" />

            <h2 id="section-12" className="text-2xl font-semibold mt-8 mb-4">12. Local Trading and Pickup Policies</h2>
            
            <h3 className="text-xl font-semibold mt-6 mb-3">Local Pickup Options</h3>
            <p className="mb-4">Our platform supports local trading through:</p>
            <ul className="list-disc pl-6 mb-4">
              <li>Location-based listing visibility</li>
              <li>In-person pickup arrangements</li>
              <li>QR code verification system</li>
              <li>Pickup confirmation process</li>
            </ul>

            <h3 className="text-xl font-semibold mt-6 mb-3">Safety Guidelines</h3>
            <div className="bg-yellow-50 dark:bg-yellow-900/20 p-4 rounded-lg mb-6">
              <p className="font-semibold mb-2 text-yellow-800 dark:text-yellow-200">Safety First</p>
              <ul className="list-disc pl-6 space-y-1 text-sm text-yellow-700 dark:text-yellow-300">
                <li>Meet in public, well-lit locations</li>
                <li>Consider meeting at local game stores or card shops</li>
                <li>Bring a friend when meeting strangers</li>
                <li>Trust your instincts and prioritize personal safety</li>
                <li>Use the platform's verification system</li>
              </ul>
            </div>

            <h3 className="text-xl font-semibold mt-6 mb-3">Pickup Verification</h3>
            <p className="mb-6">All local pickups must be confirmed through our QR code system to ensure transaction completion and buyer protection.</p>

            <Separator className="my-8" />

            <h2 id="section-13" className="text-2xl font-semibold mt-8 mb-4">13. Compliance and Legal Requirements</h2>
            
            <h3 className="text-xl font-semibold mt-6 mb-3">Legal Compliance</h3>
            <p className="mb-4">Sellers must comply with all applicable laws, including:</p>
            <ul className="list-disc pl-6 mb-4">
              <li>Local, state, and federal tax obligations</li>
              <li>Business licensing requirements (if applicable)</li>
              <li>Consumer protection laws</li>
              <li>Import/export regulations for international sales</li>
              <li>Anti-money laundering regulations</li>
            </ul>

            <h3 className="text-xl font-semibold mt-6 mb-3">Record Keeping</h3>
            <p className="mb-4">Sellers should maintain records of:</p>
            <ul className="list-disc pl-6 mb-4">
              <li>All sales transactions and receipts</li>
              <li>Shipping and tracking information</li>
              <li>Customer communications</li>
              <li>Tax-related documentation</li>
              <li>Business expenses (if applicable)</li>
            </ul>

            <h3 className="text-xl font-semibold mt-6 mb-3">Regulatory Compliance</h3>
            <p className="mb-6">High-volume sellers may be subject to additional regulatory requirements, including business registration, sales tax collection, and enhanced reporting obligations.</p>

            <Separator className="my-8" />

            <h2 id="section-14" className="text-2xl font-semibold mt-8 mb-4">14. Enforcement and Penalties</h2>
            
            <h3 className="text-xl font-semibold mt-6 mb-3">Violation Consequences</h3>
            <p className="mb-4">Policy violations may result in:</p>
            <div className="space-y-3 mb-6">
              <div className="bg-yellow-50 dark:bg-yellow-900/20 p-3 rounded border border-yellow-200 dark:border-yellow-800">
                <p className="font-semibold text-yellow-800 dark:text-yellow-200 text-sm">Warning</p>
                <p className="text-xs text-yellow-700 dark:text-yellow-300">First-time minor violations</p>
              </div>
              <div className="bg-orange-50 dark:bg-orange-900/20 p-3 rounded border border-orange-200 dark:border-orange-800">
                <p className="font-semibold text-orange-800 dark:text-orange-200 text-sm">Listing Removal</p>
                <p className="text-xs text-orange-700 dark:text-orange-300">Specific listings that violate policies</p>
              </div>
              <div className="bg-red-50 dark:bg-red-900/20 p-3 rounded border border-red-200 dark:border-red-800">
                <p className="font-semibold text-red-800 dark:text-red-200 text-sm">Account Suspension</p>
                <p className="text-xs text-red-700 dark:text-red-300">Temporary restriction of selling privileges</p>
              </div>
              <div className="bg-gray-50 dark:bg-gray-900/20 p-3 rounded border border-gray-200 dark:border-gray-800">
                <p className="font-semibold text-gray-800 dark:text-gray-200 text-sm">Permanent Ban</p>
                <p className="text-xs text-gray-700 dark:text-gray-300">Severe or repeated violations</p>
              </div>
            </div>

            <h3 className="text-xl font-semibold mt-6 mb-3">Appeal Process</h3>
            <p className="mb-4">Sellers may appeal enforcement actions by:</p>
            <ol className="list-decimal pl-6 mb-4">
              <li>Submitting an appeal through our support system</li>
              <li>Providing relevant evidence and documentation</li>
              <li>Explaining the circumstances of the violation</li>
              <li>Demonstrating corrective measures taken</li>
            </ol>

            <h3 className="text-xl font-semibold mt-6 mb-3">Repeat Violations</h3>
            <p className="mb-6">Sellers with multiple policy violations will face escalating consequences, including permanent removal from the platform.</p>

            <Separator className="my-8" />

            <h2 id="section-15" className="text-2xl font-semibold mt-8 mb-4">15. Seller Support and Resources</h2>
            
            <h3 className="text-xl font-semibold mt-6 mb-3">Available Support</h3>
            <p className="mb-4">We provide sellers with:</p>
            <ul className="list-disc pl-6 mb-4">
              <li>Comprehensive seller guides and tutorials</li>
              <li>Best practice recommendations</li>
              <li>Performance analytics and insights</li>
              <li>Direct support through our ticket system</li>
              <li>Community forums and seller resources</li>
            </ul>

            <h3 className="text-xl font-semibold mt-6 mb-3">Premium Seller Benefits</h3>
            <div className="bg-primary/10 p-4 rounded-lg mb-6 border border-primary">
              <p className="font-semibold mb-2 text-primary">Premium subscribers receive:</p>
              <ul className="list-disc pl-6 space-y-1 text-sm">
                <li>Priority customer support</li>
                <li>Advanced seller analytics</li>
                <li>Bulk listing and management tools</li>
                <li>Extended offer expiration options</li>
                <li>Early access to new features</li>
                <li>Reduced platform fees</li>
              </ul>
            </div>

            <h3 className="text-xl font-semibold mt-6 mb-3">Educational Resources</h3>
            <p className="mb-6">Access our seller education center for guides on pricing strategies, photography tips, customer service best practices, and market insights.</p>

            <Separator className="my-8" />

            <h2 id="section-16" className="text-2xl font-semibold mt-8 mb-4">16. Policy Updates and Changes</h2>
            
            <p className="mb-4">These Seller Policies may be updated periodically to reflect:</p>
            <ul className="list-disc pl-6 mb-4">
              <li>Changes in platform features and functionality</li>
              <li>Legal and regulatory requirements</li>
              <li>Industry best practices and standards</li>
              <li>User feedback and platform improvements</li>
            </ul>

            <h3 className="text-xl font-semibold mt-6 mb-3">Notification of Changes</h3>
            <p className="mb-4">When policies are updated, we will:</p>
            <ul className="list-disc pl-6 mb-4">
              <li>Update the "Last updated" date</li>
              <li>Notify active sellers via email</li>
              <li>Provide reasonable notice before changes take effect</li>
              <li>Highlight significant changes in our communications</li>
            </ul>

            <p className="mb-6">Continued selling on our platform after policy updates constitutes acceptance of the revised policies.</p>

            <Separator className="my-8" />

            <h2 className="text-2xl font-semibold mt-8 mb-4">17. Contact and Support</h2>
            
            <p className="mb-4">For questions about these Seller Policies or seller-related support:</p>
            
            <div className="bg-muted p-4 rounded-lg mb-6">
              <p className="font-semibold">Seller Support</p>
              <p>Email: <a href="mailto:sellers@waboku.gg" className="text-primary">sellers@waboku.gg</a></p>
              <p>General Support: <a href="/support" className="text-primary">Submit a Support Ticket</a></p>
              <p>Seller Resources: <a href="/seller-resources" className="text-primary">Seller Education Center</a></p>
            </div>

            <div className="mt-8 p-6 bg-primary/10 rounded-lg border border-primary">
              <h3 className="text-lg font-semibold mb-3 text-primary">Seller Agreement Acknowledgment</h3>
              <p className="text-sm">
                By listing items for sale on our platform, you acknowledge that you have read, understood, and agree to comply with these Marketplace Seller Policies. These policies are incorporated into and form part of our Terms of Use. Violation of these policies may result in enforcement actions up to and including permanent suspension of your selling privileges.
              </p>
            </div>

          </CardContent>
        </Card>
      </div>
      <Footer />
    </>
  );
}