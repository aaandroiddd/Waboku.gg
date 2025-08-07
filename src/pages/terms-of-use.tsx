import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Footer } from "@/components/Footer";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function TermsOfUsePage() {
  return (
    <>
      <div className="container mx-auto py-12 px-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-3xl font-bold text-center mb-6">Terms of Use</CardTitle>
            <p className="text-center text-muted-foreground">Last updated August 4, 2025</p>
          </CardHeader>
          <CardContent className="prose dark:prose-invert max-w-none">
            <p className="text-lg mb-6">
              These Terms of Use ("Terms") govern your access to and use of the services provided by Stage Zero, LLC ("we," "us," or "our") through our website at <a href="https://www.waboku.gg" className="text-primary">https://www.waboku.gg</a> and <a href="https://www.wtcg.gg" className="text-primary">https://www.wtcg.gg</a> (collectively, the "Platform" or "Services").
            </p>

            <div className="bg-muted p-4 rounded-lg mb-8">
              <p className="font-semibold mb-2">Important Notice</p>
              <p className="mb-3">By creating an account, accessing, or using our Services, you agree to be bound by these Terms. If you do not agree to these Terms, you may not use our Services. Please read these Terms carefully before using our Platform.</p>
              <p className="text-sm"><strong>Sellers:</strong> If you list items for sale on our Platform, you also agree to comply with our <a href="/marketplace-seller-policies" className="text-primary hover:underline">Marketplace Seller Policies</a>, which establish additional requirements and standards for selling activities.</p>
            </div>

            <Separator className="my-8" />

            <h2 className="text-2xl font-semibold mt-8 mb-4">Table of Contents</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-8">
              <div className="space-y-1">
                <p className="text-sm"><a href="#section-1" className="text-primary hover:underline">1. Acceptance of Terms</a></p>
                <p className="text-sm"><a href="#section-2" className="text-primary hover:underline">2. Description of Services</a></p>
                <p className="text-sm"><a href="#section-3" className="text-primary hover:underline">3. User Accounts and Registration</a></p>
                <p className="text-sm"><a href="#section-4" className="text-primary hover:underline">4. User Responsibilities and Conduct</a></p>
                <p className="text-sm"><a href="#section-5" className="text-primary hover:underline">5. Prohibited Content and Activities</a></p>
                <p className="text-sm"><a href="#section-6" className="text-primary hover:underline">6. Listing and Selling</a></p>
                <p className="text-sm"><a href="#section-7" className="text-primary hover:underline">7. Buying and Payment</a></p>
                <p className="text-sm"><a href="#section-8" className="text-primary hover:underline">8. Subscription Services</a></p>
              </div>
              <div className="space-y-1">
                <p className="text-sm"><a href="#section-9" className="text-primary hover:underline">9. Fees and Taxes</a></p>
                <p className="text-sm"><a href="#section-10" className="text-primary hover:underline">10. Shipping and Delivery</a></p>
                <p className="text-sm"><a href="#section-11" className="text-primary hover:underline">11. Disputes and Resolution</a></p>
                <p className="text-sm"><a href="#section-12" className="text-primary hover:underline">12. Account Suspension and Termination</a></p>
                <p className="text-sm"><a href="#section-13" className="text-primary hover:underline">13. Disclaimer and Limitation of Liability</a></p>
                <p className="text-sm"><a href="#section-14" className="text-primary hover:underline">14. Assumption of Risk</a></p>
                <p className="text-sm"><a href="#section-15" className="text-primary hover:underline">15. Intellectual Property</a></p>
                <p className="text-sm"><a href="#section-16" className="text-primary hover:underline">16. Changes to Terms</a></p>
              </div>
            </div>

            <Separator className="my-8" />

            <h2 id="section-1" className="text-2xl font-semibold mt-8 mb-4">1. Acceptance of Terms</h2>
            <p className="mb-4">By accessing or using our Services, you acknowledge that you have read, understood, and agree to be bound by these Terms and our Privacy Policy. These Terms constitute a legally binding agreement between you and Stage Zero, LLC.</p>
            
            <p className="mb-6">You must be at least 18 years old to use our Services. If you are under 18, you may only use our Services with the involvement and consent of a parent or guardian.</p>

            <Separator className="my-8" />

            <h2 id="section-2" className="text-2xl font-semibold mt-8 mb-4">2. Description of Services</h2>
            <p className="mb-4">Waboku.gg and WTCG.gg provide an online marketplace platform that connects buyers and sellers of trading card games (TCG) and collectible cards. Our Services include:</p>
            
            <div className="bg-muted p-4 rounded-lg mb-6">
              <ul className="list-disc pl-6 space-y-2">
                <li><strong>Marketplace Platform:</strong> Tools for listing, browsing, and purchasing trading cards</li>
                <li><strong>User Accounts:</strong> Personal dashboards for managing listings, orders, and communications</li>
                <li><strong>Messaging System:</strong> Direct communication between buyers and sellers</li>
                <li><strong>Payment Processing:</strong> Secure transaction handling through Stripe</li>
                <li><strong>Offer System:</strong> Tools for making and managing offers on listings</li>
                <li><strong>Wanted Posts:</strong> Ability to post requests for specific cards you're seeking</li>
                <li><strong>Location-Based Features:</strong> Local trading and pickup options</li>
                <li><strong>Review System:</strong> User feedback and rating system</li>
                <li><strong>Premium Subscriptions:</strong> Enhanced features for premium users</li>
                <li><strong>Mobile-Optimized Experience:</strong> Full functionality across all devices</li>
              </ul>
            </div>

            <Separator className="my-8" />

            <h2 id="section-3" className="text-2xl font-semibold mt-8 mb-4">3. User Accounts and Registration</h2>
            
            <h3 className="text-xl font-semibold mt-6 mb-3">Account Creation</h3>
            <p className="mb-4">To use our Services, you must create an account by providing accurate and complete information. You may register using:</p>
            <ul className="list-disc pl-6 mb-4">
              <li>Email address and password</li>
              <li>Google account authentication</li>
              <li>Other supported social login methods</li>
            </ul>

            <h3 className="text-xl font-semibold mt-6 mb-3">Account Security</h3>
            <p className="mb-4">You are responsible for:</p>
            <ul className="list-disc pl-6 mb-4">
              <li>Maintaining the confidentiality of your account credentials</li>
              <li>All activities that occur under your account</li>
              <li>Notifying us immediately of any unauthorized use</li>
              <li>Ensuring your account information remains accurate and up-to-date</li>
            </ul>

            <h3 className="text-xl font-semibold mt-6 mb-3">Profile Completion</h3>
            <p className="mb-6">Users must complete their profile with accurate information including display name, location (for local trading features), and contact preferences. False or misleading information may result in account suspension.</p>

            <Separator className="my-8" />

            <h2 id="section-4" className="text-2xl font-semibold mt-8 mb-4">4. User Responsibilities and Conduct</h2>
            
            <div className="bg-muted p-4 rounded-lg mb-6">
              <p className="font-semibold mb-2">As a user of our Platform, you agree to:</p>
              <ul className="list-disc pl-6 space-y-1">
                <li>Provide accurate and truthful information in all listings and communications</li>
                <li>Honor all transactions and agreements made through the Platform</li>
                <li>Communicate respectfully and professionally with other users</li>
                <li>Ship items promptly and as described when selling</li>
                <li>Pay for purchases in a timely manner when buying</li>
                <li>Report any issues or disputes through proper channels</li>
                <li>Comply with all applicable laws and regulations</li>
                <li>Respect the intellectual property rights of others</li>
                <li>Use the Platform only for legitimate trading card transactions</li>
              </ul>
            </div>

            <Separator className="my-8" />

            <h2 id="section-5" className="text-2xl font-semibold mt-8 mb-4">5. Prohibited Content and Activities</h2>
            
            <Alert className="mb-6">
              <AlertDescription>
                <strong>Zero Tolerance Policy:</strong> Violation of these prohibitions may result in immediate account suspension or permanent ban without prior notice.
              </AlertDescription>
            </Alert>

            <h3 className="text-xl font-semibold mt-6 mb-3">Prohibited Content</h3>
            <p className="mb-4">Users may not post, upload, or share content that includes:</p>
            <div className="bg-destructive/10 p-4 rounded-lg mb-6">
              <ul className="list-disc pl-6 space-y-1">
                <li><strong>Explicit or Adult Content:</strong> Sexually explicit, pornographic, or adult-oriented material</li>
                <li><strong>Hate Speech:</strong> Content promoting discrimination, harassment, or violence</li>
                <li><strong>Fraudulent Material:</strong> Counterfeit cards, fake grading certificates, or misrepresented items</li>
                <li><strong>Illegal Items:</strong> Stolen goods or items that violate applicable laws</li>
                <li><strong>Spam or Solicitation:</strong> Unsolicited marketing, promotional content, or off-platform solicitation</li>
                <li><strong>Personal Information:</strong> Private information of other users without consent</li>
                <li><strong>Misleading Information:</strong> False descriptions, fake photos, or deceptive pricing</li>
              </ul>
            </div>

            <h3 className="text-xl font-semibold mt-6 mb-3">Prohibited Activities</h3>
            <p className="mb-4">Users may not engage in:</p>
            <div className="bg-destructive/10 p-4 rounded-lg mb-6">
              <ul className="list-disc pl-6 space-y-1">
                <li><strong>Fraudulent Transactions:</strong> Scamming, payment fraud, or intentional misrepresentation</li>
                <li><strong>Market Manipulation:</strong> Artificial price inflation or coordinated manipulation</li>
                <li><strong>System Abuse:</strong> Attempting to circumvent security measures or exploit vulnerabilities</li>
                <li><strong>Multiple Account Abuse:</strong> Creating multiple accounts to circumvent restrictions</li>
                <li><strong>Harassment:</strong> Threatening, stalking, or harassing other users</li>
                <li><strong>Off-Platform Transactions:</strong> Attempting to complete transactions outside our secure system</li>
                <li><strong>Automated Activity:</strong> Using bots, scripts, or automated tools without permission</li>
              </ul>
            </div>

            <Separator className="my-8" />

            <h2 id="section-6" className="text-2xl font-semibold mt-8 mb-4">6. Listing and Selling</h2>
            
            <h3 className="text-xl font-semibold mt-6 mb-3">Listing Requirements</h3>
            <p className="mb-4">All listings must include:</p>
            <ul className="list-disc pl-6 mb-4">
              <li>Accurate and detailed description of the item</li>
              <li>Clear, high-quality photographs showing the actual item</li>
              <li>Honest condition assessment using our grading system</li>
              <li>Fair market pricing</li>
              <li>Accurate game category and card details</li>
            </ul>

            <h3 className="text-xl font-semibold mt-6 mb-3">Seller Obligations</h3>
            <div className="bg-muted p-4 rounded-lg mb-6">
              <p className="font-semibold mb-2">As a seller, you must:</p>
              <ul className="list-disc pl-6 space-y-1">
                <li>Own the items you list for sale</li>
                <li>Ship items within the specified timeframe (typically 2-3 business days)</li>
                <li>Package items securely to prevent damage during shipping</li>
                <li>Provide tracking information when available</li>
                <li>Respond to buyer inquiries promptly</li>
                <li>Honor the sale price and terms as listed</li>
                <li>Update shipping status and tracking information</li>
              </ul>
            </div>

            <h3 className="text-xl font-semibold mt-6 mb-3">Listing Limits</h3>
            <p className="mb-6">Free accounts are limited to 2 active listings at any time. Premium subscribers have unlimited listing capabilities and access to bulk listing tools.</p>

            <Separator className="my-8" />

            <h2 id="section-7" className="text-2xl font-semibold mt-8 mb-4">7. Buying and Payment</h2>
            
            <h3 className="text-xl font-semibold mt-6 mb-3">Payment Processing</h3>
            <p className="mb-4">All payments are processed securely through Stripe. We accept:</p>
            <ul className="list-disc pl-6 mb-4">
              <li>Major credit and debit cards</li>
              <li>Digital wallets (Apple Pay, Google Pay)</li>
              <li>Bank transfers (where available)</li>
            </ul>

            <h3 className="text-xl font-semibold mt-6 mb-3">Buyer Protection</h3>
            <p className="mb-4">We provide buyer protection through:</p>
            <ul className="list-disc pl-6 mb-4">
              <li>Secure payment processing with dispute resolution</li>
              <li>Item not as described protection</li>
              <li>Non-delivery protection</li>
              <li>Refund processing for eligible cases</li>
            </ul>

            <h3 className="text-xl font-semibold mt-6 mb-3">Shipping Address</h3>
            <p className="mb-6">Buyers must provide accurate shipping addresses. We use Stripe's billing address as the default shipping address, but buyers can update this information during checkout or immediately after purchase.</p>

            <Separator className="my-8" />

            <h2 id="section-8" className="text-2xl font-semibold mt-8 mb-4">8. Subscription Services</h2>
            
            <h3 className="text-xl font-semibold mt-6 mb-3">Premium Subscriptions</h3>
            <p className="mb-4">We offer premium subscription plans that include:</p>
            <div className="bg-muted p-4 rounded-lg mb-6">
              <ul className="list-disc pl-6 space-y-1">
                <li>Unlimited active listings</li>
                <li>Bulk listing tools</li>
                <li>Extended offer expiration options (24 hours, 48 hours, 3 days, or 7 days)</li>
                <li>Priority customer support</li>
                <li>Advanced analytics and insights</li>
                <li>Reduced platform fees</li>
                <li>Early access to new features</li>
              </ul>
            </div>

            <h3 className="text-xl font-semibold mt-6 mb-3">Subscription Terms</h3>
            <p className="mb-4">Premium subscriptions:</p>
            <ul className="list-disc pl-6 mb-4">
              <li>Are billed monthly or annually as selected</li>
              <li>Automatically renew unless cancelled</li>
              <li>Can be cancelled at any time through your account settings</li>
              <li>Provide access to premium features until the end of the billing period</li>
            </ul>

            <p className="mb-6">Free accounts have access to basic platform features with limitations on listing quantity and offer expiration times (24 hours default).</p>

            <Separator className="my-8" />

            <h2 id="section-9" className="text-2xl font-semibold mt-8 mb-4">9. Fees and Taxes</h2>
            
            <h3 className="text-xl font-semibold mt-6 mb-3">Platform Fees</h3>
            <p className="mb-4">We charge platform fees on completed transactions. Fee structures vary based on:</p>
            <ul className="list-disc pl-6 mb-4">
              <li>Account type (free vs. premium)</li>
              <li>Transaction amount</li>
              <li>Payment method used</li>
              <li>Seller's Stripe Connect status</li>
            </ul>

            <h3 className="text-xl font-semibold mt-6 mb-3">Tax Responsibilities</h3>
            <div className="bg-yellow-50 dark:bg-yellow-900/20 p-4 rounded-lg mb-6">
              <p className="font-semibold mb-2 text-yellow-800 dark:text-yellow-200">Important Tax Notice</p>
              <p className="text-yellow-700 dark:text-yellow-300">Users are solely responsible for determining and paying all applicable taxes on their transactions, including but not limited to sales tax, use tax, and income tax. We do not provide tax advice and recommend consulting with a qualified tax professional.</p>
            </div>

            <h3 className="text-xl font-semibold mt-6 mb-3">Payment Processing</h3>
            <p className="mb-6">All payment processing fees are handled by Stripe according to their current fee structure. Additional fees may apply for international transactions, currency conversion, or special payment methods.</p>

            <Separator className="my-8" />

            <h2 id="section-10" className="text-2xl font-semibold mt-8 mb-4">10. Shipping and Delivery</h2>
            
            <h3 className="text-xl font-semibold mt-6 mb-3">Shipping Requirements</h3>
            <p className="mb-4">Sellers must:</p>
            <ul className="list-disc pl-6 mb-4">
              <li>Ship items within 2-3 business days of payment confirmation</li>
              <li>Use appropriate packaging to prevent damage</li>
              <li>Provide tracking information when available</li>
              <li>Update shipping status in their dashboard</li>
              <li>Respond to shipping-related inquiries promptly</li>
            </ul>

            <h3 className="text-xl font-semibold mt-6 mb-3">Local Pickup</h3>
            <p className="mb-4">For local transactions, users may arrange in-person pickup using our:</p>
            <ul className="list-disc pl-6 mb-4">
              <li>QR code verification system</li>
              <li>Pickup confirmation process</li>
              <li>Location-based matching features</li>
            </ul>

            <h3 className="text-xl font-semibold mt-6 mb-3">Shipping Reminders</h3>
            <p className="mb-6">Sellers who do not ship items or update shipping status within 48 hours will receive automated reminder emails. Continued delays may result in account restrictions.</p>

            <Separator className="my-8" />

            <h2 id="section-11" className="text-2xl font-semibold mt-8 mb-4">11. Disputes and Resolution</h2>
            
            <h3 className="text-xl font-semibold mt-6 mb-3">Dispute Process</h3>
            <p className="mb-4">If issues arise with a transaction, users should:</p>
            <ol className="list-decimal pl-6 mb-4">
              <li>First attempt to resolve the issue directly with the other party through our messaging system</li>
              <li>If direct resolution fails, contact our support team through the support ticket system</li>
              <li>Provide all relevant documentation and evidence</li>
              <li>Cooperate with our investigation process</li>
            </ol>

            <h3 className="text-xl font-semibold mt-6 mb-3">Resolution Options</h3>
            <p className="mb-4">Depending on the situation, resolution may include:</p>
            <ul className="list-disc pl-6 mb-4">
              <li>Partial or full refunds</li>
              <li>Return and refund processes</li>
              <li>Account restrictions or warnings</li>
              <li>Mediated settlements</li>
            </ul>

            <h3 className="text-xl font-semibold mt-6 mb-3">Refund Policy</h3>
            <p className="mb-6">Refunds may be issued for items that are significantly not as described, damaged during shipping (when properly packaged), or not delivered. All refund requests are subject to investigation and approval.</p>

            <Separator className="my-8" />

            <h2 id="section-12" className="text-2xl font-semibold mt-8 mb-4">12. Account Suspension and Termination</h2>
            
            <Alert className="mb-6">
              <AlertDescription>
                <strong>Enforcement Authority:</strong> Waboku.gg and WTCG.gg reserve the right to suspend or permanently ban any user account at any time, with or without notice, for violations of these Terms or for any other reason we deem necessary to protect our platform and community.
              </AlertDescription>
            </Alert>

            <h3 className="text-xl font-semibold mt-6 mb-3">Grounds for Suspension or Ban</h3>
            <div className="bg-destructive/10 p-4 rounded-lg mb-6">
              <ul className="list-disc pl-6 space-y-1">
                <li>Violation of prohibited content or activity policies</li>
                <li>Fraudulent or deceptive practices</li>
                <li>Repeated failure to ship items or honor transactions</li>
                <li>Harassment or abuse of other users</li>
                <li>Circumventing platform security measures</li>
                <li>Creating multiple accounts to evade restrictions</li>
                <li>Engaging in activities that harm the platform or community</li>
                <li>Failure to resolve disputes in good faith</li>
              </ul>
            </div>

            <h3 className="text-xl font-semibold mt-6 mb-3">Consequences of Termination</h3>
            <p className="mb-4">Upon account termination:</p>
            <ul className="list-disc pl-6 mb-4">
              <li>Access to the platform will be immediately revoked</li>
              <li>Active listings will be removed</li>
              <li>Pending transactions may be cancelled</li>
              <li>Account data may be retained for legal and security purposes</li>
              <li>Outstanding obligations remain in effect</li>
            </ul>

            <h3 className="text-xl font-semibold mt-6 mb-3">Appeal Process</h3>
            <p className="mb-6">Users may appeal account actions by contacting our support team with relevant information and evidence. Appeals are reviewed on a case-by-case basis, and our decisions are final.</p>

            <Separator className="my-8" />

            <h2 id="section-13" className="text-2xl font-semibold mt-8 mb-4">13. Disclaimer and Limitation of Liability</h2>
            
            <div className="bg-yellow-50 dark:bg-yellow-900/20 p-6 rounded-lg mb-6">
              <h3 className="text-lg font-semibold mb-3 text-yellow-800 dark:text-yellow-200">Use at Your Own Risk</h3>
              <p className="text-yellow-700 dark:text-yellow-300 mb-4">
                Our Services are provided "as is" and "as available" without warranties of any kind, either express or implied. You use our Services at your own risk and discretion.
              </p>
              
              <p className="text-yellow-700 dark:text-yellow-300">
                We disclaim all warranties, including but not limited to warranties of merchantability, fitness for a particular purpose, and non-infringement. We do not warrant that our Services will be uninterrupted, error-free, or completely secure.
              </p>
            </div>

            <h3 className="text-xl font-semibold mt-6 mb-3">Limitation of Liability</h3>
            <p className="mb-4">To the maximum extent permitted by law, Stage Zero, LLC shall not be liable for:</p>
            <ul className="list-disc pl-6 mb-4">
              <li>Any indirect, incidental, special, consequential, or punitive damages</li>
              <li>Loss of profits, revenue, data, or business opportunities</li>
              <li>Damages arising from user-to-user transactions</li>
              <li>Issues with third-party services (payment processors, shipping carriers)</li>
              <li>Unauthorized access to or alteration of your data</li>
              <li>Actions or omissions of other users</li>
            </ul>

            <p className="mb-6">Our total liability for any claims arising from or related to these Terms or our Services shall not exceed the amount you paid to us in the 12 months preceding the claim.</p>

            <Separator className="my-8" />

            <h2 id="section-14" className="text-2xl font-semibold mt-8 mb-4">14. Assumption of Risk</h2>
            
            <div className="bg-red-50 dark:bg-red-900/20 p-6 rounded-lg mb-6">
              <h3 className="text-lg font-semibold mb-3 text-red-800 dark:text-red-200">Inherent Risks of Internet-Based Services</h3>
              <p className="text-red-700 dark:text-red-300 mb-4">
                By using our Services, you acknowledge and assume the risks inherent in internet-based platforms and peer-to-peer transactions, including but not limited to:
              </p>
              
              <ul className="list-disc pl-6 space-y-2 text-red-700 dark:text-red-300">
                <li><strong>Transaction Risks:</strong> Risk of fraud, non-payment, or non-delivery by other users</li>
                <li><strong>Item Condition Risks:</strong> Risk that items may not match descriptions or expectations</li>
                <li><strong>Communication Risks:</strong> Risk of miscommunication or misunderstanding with other users</li>
                <li><strong>Technical Risks:</strong> Risk of system downtime, data loss, or technical malfunctions</li>
                <li><strong>Security Risks:</strong> Risk of unauthorized access, data breaches, or cyber attacks</li>
                <li><strong>Market Risks:</strong> Risk of price fluctuations and market volatility</li>
                <li><strong>Shipping Risks:</strong> Risk of loss, damage, or delay during shipping</li>
                <li><strong>Legal Risks:</strong> Risk of legal disputes or regulatory changes</li>
              </ul>
            </div>

            <h3 className="text-xl font-semibold mt-6 mb-3">User Interactions</h3>
            <p className="mb-4">You acknowledge that:</p>
            <ul className="list-disc pl-6 mb-4">
              <li>We do not control the actions of other users</li>
              <li>We cannot guarantee the accuracy of user-provided information</li>
              <li>Interactions with other users are at your own risk</li>
              <li>You should exercise caution and good judgment in all transactions</li>
              <li>You should verify information independently when possible</li>
            </ul>

            <h3 className="text-xl font-semibold mt-6 mb-3">Protective Measures</h3>
            <p className="mb-6">While we implement security measures and policies to protect our users, you acknowledge that no system is completely secure and that you bear responsibility for protecting yourself through careful use of our platform and adherence to safe trading practices.</p>

            <Separator className="my-8" />

            <h2 id="section-15" className="text-2xl font-semibold mt-8 mb-4">15. Intellectual Property</h2>
            
            <h3 className="text-xl font-semibold mt-6 mb-3">Platform Intellectual Property</h3>
            <p className="mb-4">All content, features, and functionality of our platform, including but not limited to text, graphics, logos, icons, images, audio clips, digital downloads, data compilations, and software, are owned by Stage Zero, LLC or our licensors and are protected by copyright, trademark, and other intellectual property laws.</p>

            <h3 className="text-xl font-semibold mt-6 mb-3">Trading Card Game Intellectual Property</h3>
            <p className="mb-4">We do not own, claim ownership of, or have any affiliation with the intellectual property rights of trading card games, characters, artwork, or trademarks featured on cards sold through our marketplace. All such rights belong to their respective owners as detailed in our About page.</p>

            <h3 className="text-xl font-semibold mt-6 mb-3">User Content</h3>
            <p className="mb-4">By posting content on our platform, you grant us a non-exclusive, worldwide, royalty-free license to use, display, and distribute your content in connection with our Services. You retain ownership of your content and may remove it at any time.</p>

            <h3 className="text-xl font-semibold mt-6 mb-3">Copyright Infringement</h3>
            <p className="mb-6">We respect intellectual property rights and will respond to valid copyright infringement notices. If you believe your copyrighted work has been infringed, please contact us with detailed information about the alleged infringement.</p>

            <Separator className="my-8" />

            <h2 id="section-16" className="text-2xl font-semibold mt-8 mb-4">16. Changes to Terms</h2>
            
            <p className="mb-4">We reserve the right to modify these Terms at any time. When we make changes, we will:</p>
            <ul className="list-disc pl-6 mb-4">
              <li>Update the "Last updated" date at the top of these Terms</li>
              <li>Notify users of material changes through email or platform notifications</li>
              <li>Provide reasonable notice before changes take effect</li>
            </ul>

            <p className="mb-6">Your continued use of our Services after changes become effective constitutes acceptance of the revised Terms. If you do not agree to the changes, you must stop using our Services.</p>

            <Separator className="my-8" />

            <h2 className="text-2xl font-semibold mt-8 mb-4">17. Governing Law and Jurisdiction</h2>
            
            <p className="mb-4">These Terms are governed by and construed in accordance with the laws of the United States and the state in which Stage Zero, LLC is incorporated, without regard to conflict of law principles.</p>

            <p className="mb-6">Any disputes arising from these Terms or your use of our Services will be resolved through binding arbitration or in the courts of competent jurisdiction in our corporate location, and you consent to the personal jurisdiction of such courts.</p>

            <Separator className="my-8" />

            <h2 className="text-2xl font-semibold mt-8 mb-4">18. Severability and Entire Agreement</h2>
            
            <p className="mb-4">If any provision of these Terms is found to be unenforceable or invalid, the remaining provisions will continue in full force and effect. These Terms, together with our Privacy Policy, constitute the entire agreement between you and Stage Zero, LLC regarding your use of our Services.</p>

            <Separator className="my-8" />

            <h2 className="text-2xl font-semibold mt-8 mb-4">19. Contact Information</h2>
            
            <p className="mb-4">If you have questions about these Terms, please contact us:</p>
            
            <div className="bg-muted p-4 rounded-lg mb-6">
              <p className="font-semibold">Stage Zero, LLC</p>
              <p>Email: <a href="mailto:support@waboku.gg" className="text-primary">support@waboku.gg</a></p>
              <p>Support: <a href="/support" className="text-primary">Submit a Support Ticket</a></p>
              <p className="text-sm text-muted-foreground mt-2">Additional contact information available upon request</p>
            </div>

            <div className="mt-8 p-6 bg-primary/10 rounded-lg">
              <h3 className="text-lg font-semibold mb-3 text-primary">Agreement Acknowledgment</h3>
              <p className="text-sm">
                By creating an account or using our Services, you acknowledge that you have read, understood, and agree to be bound by these Terms of Use. You also acknowledge that you have read and understood our Privacy Policy and agree to our data collection and use practices as described therein.
              </p>
            </div>

          </CardContent>
        </Card>
      </div>
      <Footer />
    </>
  );
}