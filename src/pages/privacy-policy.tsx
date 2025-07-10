import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Footer } from "@/components/Footer";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";

export default function PrivacyPolicyPage() {
  return (
    <>
      <div className="container mx-auto py-12 px-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-3xl font-bold text-center mb-6">Privacy Policy</CardTitle>
            <p className="text-center text-muted-foreground">Last updated July 10, 2025</p>
          </CardHeader>
          <CardContent className="prose dark:prose-invert max-w-none">
            <p className="text-lg mb-6">
              This Privacy Notice for Stage Zero, LLC ("we," "us," or "our"), describes how and why we might access, collect, store, use, and/or share ("process") your personal information when you use our services ("Services"), including when you:
            </p>

            <ul className="list-disc pl-6 mb-6">
              <li>Visit our website at <a href="https://www.waboku.gg" className="text-primary">https://www.waboku.gg</a> or any website of ours that links to this Privacy Notice</li>
              <li>Use Waboku.gg. Our mission is to connect TCG collectors and players through a user-friendly platform that prioritizes transparency, security, and community engagement. We believe in creating a space where enthusiasts can share their passion and build meaningful connections through their love of trading card games.</li>
              <li>Engage with us in other related ways, including any sales, marketing, or events</li>
            </ul>

            <div className="bg-muted p-4 rounded-lg mb-8">
              <p className="font-semibold mb-2">Questions or concerns?</p>
              <p>Reading this Privacy Notice will help you understand your privacy rights and choices. We are responsible for making decisions about how your personal information is processed. If you do not agree with our policies and practices, please do not use our Services. If you still have any questions or concerns, please contact us at <a href="mailto:support@waboku.gg" className="text-primary">support@waboku.gg</a>.</p>
            </div>

            <Separator className="my-8" />

            <h2 className="text-2xl font-semibold mt-8 mb-4">Summary of Key Points</h2>
            <div className="bg-card border rounded-lg p-6 mb-8">
              <p className="italic mb-4">This summary provides key points from our Privacy Notice, but you can find out more details about any of these topics by clicking the link following each key point or by using our table of contents below to find the section you are looking for.</p>
              
              <div className="space-y-4">
                <div>
                  <p className="font-semibold">What personal information do we process?</p>
                  <p className="text-sm text-muted-foreground">When you visit, use, or navigate our Services, we may process personal information depending on how you interact with us and the Services, the choices you make, and the products and features you use.</p>
                </div>
                
                <div>
                  <p className="font-semibold">Do we process any sensitive personal information?</p>
                  <p className="text-sm text-muted-foreground">We do not process sensitive personal information.</p>
                </div>
                
                <div>
                  <p className="font-semibold">Do we collect any information from third parties?</p>
                  <p className="text-sm text-muted-foreground">We do not collect any information from third parties.</p>
                </div>
                
                <div>
                  <p className="font-semibold">How do we process your information?</p>
                  <p className="text-sm text-muted-foreground">We process your information to provide, improve, and administer our Services, communicate with you, for security and fraud prevention, and to comply with law.</p>
                </div>
                
                <div>
                  <p className="font-semibold">How do we keep your information safe?</p>
                  <p className="text-sm text-muted-foreground">We have adequate organizational and technical processes and procedures in place to protect your personal information. However, no electronic transmission over the internet can be guaranteed to be 100% secure.</p>
                </div>
              </div>
            </div>

            <Separator className="my-8" />

            <h2 className="text-2xl font-semibold mt-8 mb-4">Table of Contents</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-8">
              <div className="space-y-1">
                <p className="text-sm"><a href="#section-1" className="text-primary hover:underline">1. What Information Do We Collect?</a></p>
                <p className="text-sm"><a href="#section-2" className="text-primary hover:underline">2. How Do We Process Your Information?</a></p>
                <p className="text-sm"><a href="#section-3" className="text-primary hover:underline">3. When and With Whom Do We Share Your Personal Information?</a></p>
                <p className="text-sm"><a href="#section-4" className="text-primary hover:underline">4. Do We Use Cookies and Other Tracking Technologies?</a></p>
                <p className="text-sm"><a href="#section-5" className="text-primary hover:underline">5. How Do We Handle Your Social Logins?</a></p>
                <p className="text-sm"><a href="#section-6" className="text-primary hover:underline">6. How Long Do We Keep Your Information?</a></p>
                <p className="text-sm"><a href="#section-7" className="text-primary hover:underline">7. How Do We Keep Your Information Safe?</a></p>
              </div>
              <div className="space-y-1">
                <p className="text-sm"><a href="#section-8" className="text-primary hover:underline">8. Do We Collect Information From Minors?</a></p>
                <p className="text-sm"><a href="#section-9" className="text-primary hover:underline">9. What Are Your Privacy Rights?</a></p>
                <p className="text-sm"><a href="#section-10" className="text-primary hover:underline">10. Controls for Do-Not-Track Features</a></p>
                <p className="text-sm"><a href="#section-11" className="text-primary hover:underline">11. Do United States Residents Have Specific Privacy Rights?</a></p>
                <p className="text-sm"><a href="#section-12" className="text-primary hover:underline">12. Do We Make Updates to This Notice?</a></p>
                <p className="text-sm"><a href="#section-13" className="text-primary hover:underline">13. How Can You Contact Us About This Notice?</a></p>
                <p className="text-sm"><a href="#section-14" className="text-primary hover:underline">14. How Can You Review, Update, or Delete Data We Collect?</a></p>
              </div>
            </div>

            <Separator className="my-8" />

            <h2 id="section-1" className="text-2xl font-semibold mt-8 mb-4">1. What Information Do We Collect?</h2>
            
            <h3 className="text-xl font-semibold mt-6 mb-3">Personal information you disclose to us</h3>
            <p className="italic mb-4">In Short: We collect personal information that you provide to us.</p>
            
            <p className="mb-4">We collect personal information that you voluntarily provide to us when you register on the Services, express an interest in obtaining information about us or our products and Services, when you participate in activities on the Services, or otherwise when you contact us.</p>
            
            <div className="bg-muted p-4 rounded-lg mb-6">
              <p className="font-semibold mb-2">Personal Information Provided by You.</p>
              <p className="mb-2">The personal information that we collect depends on the context of your interactions with us and the Services, the choices you make, and the products and features you use. The personal information we collect may include the following:</p>
              <ul className="list-disc pl-6 mt-2">
                <li>names</li>
                <li>phone numbers</li>
                <li>email addresses</li>
                <li>mailing addresses</li>
                <li>usernames</li>
                <li>passwords</li>
                <li>contact preferences</li>
                <li>contact or authentication data</li>
                <li>billing addresses</li>
                <li>debit/credit card numbers</li>
              </ul>
            </div>

            <p className="mb-4"><strong>Sensitive Information.</strong> We do not process sensitive information.</p>
            
            <p className="mb-4"><strong>Payment Data.</strong> We may collect data necessary to process your payment if you choose to make purchases, such as your payment instrument number, and the security code associated with your payment instrument. All payment data is handled and stored by Stripe. You may find their privacy notice at: <a href="https://stripe.com/privacy" className="text-primary">https://stripe.com/privacy</a>.</p>
            
            <p className="mb-4"><strong>Social Media Login Data.</strong> We may provide you with the option to register with us using your existing social media account details, like your Facebook, Google, or other social media account. If you choose to register in this way, we will collect certain profile information about you from the social media provider.</p>
            
            <p className="mb-6">All personal information that you provide to us must be true, complete, and accurate, and you must notify us of any changes to such personal information.</p>

            <h3 className="text-xl font-semibold mt-6 mb-3">Information automatically collected</h3>
            <p className="italic mb-4">In Short: Some information — such as your Internet Protocol (IP) address and/or browser and device characteristics — is collected automatically when you visit our Services.</p>
            
            <p className="mb-4">We automatically collect certain information when you visit, use, or navigate the Services. This information does not reveal your specific identity (like your name or contact information) but may include device and usage information, such as your IP address, browser and device characteristics, operating system, language preferences, referring URLs, device name, country, location, information about how and when you use our Services, and other technical information.</p>
            
            <div className="bg-muted p-4 rounded-lg mb-6">
              <p className="font-semibold mb-2">The information we collect includes:</p>
              <ul className="list-disc pl-6">
                <li><strong>Log and Usage Data.</strong> Service-related, diagnostic, usage, and performance information our servers automatically collect when you access or use our Services.</li>
                <li><strong>Location Data.</strong> We collect location data such as information about your device's location for local trading features. You can opt out of allowing us to collect this information by disabling your Location setting on your device.</li>
              </ul>
            </div>

            <h3 className="text-xl font-semibold mt-6 mb-3">Google API</h3>
            <p className="mb-6">Our use of information received from Google APIs will adhere to Google API Services User Data Policy, including the Limited Use requirements.</p>

            <Separator className="my-8" />

            <h2 id="section-2" className="text-2xl font-semibold mt-8 mb-4">2. How Do We Process Your Information?</h2>
            <p className="italic mb-4">In Short: We process your information to provide, improve, and administer our Services, communicate with you, for security and fraud prevention, and to comply with law.</p>
            
            <div className="bg-muted p-4 rounded-lg mb-6">
              <p className="font-semibold mb-2">We process your personal information for a variety of reasons, including:</p>
              <ul className="list-disc pl-6 space-y-1">
                <li>To facilitate account creation and authentication and otherwise manage user accounts</li>
                <li>To deliver and facilitate delivery of services to the user</li>
                <li>To send administrative information to you</li>
                <li>To fulfill and manage your orders</li>
                <li>To enable user-to-user communications</li>
                <li>To request feedback</li>
                <li>To send you marketing and promotional communications</li>
                <li>To evaluate and improve our Services, products, marketing, and your experience</li>
              </ul>
            </div>

            <Separator className="my-8" />

            <h2 id="section-3" className="text-2xl font-semibold mt-8 mb-4">3. When and With Whom Do We Share Your Personal Information?</h2>
            <p className="italic mb-4">In Short: We may share information in specific situations described in this section and/or with the following third parties.</p>
            
            <div className="bg-muted p-4 rounded-lg mb-6">
              <p className="font-semibold mb-2">We may need to share your personal information in the following situations:</p>
              <ul className="list-disc pl-6 space-y-1">
                <li><strong>Business Transfers.</strong> We may share or transfer your information in connection with any merger, sale of company assets, financing, or acquisition.</li>
                <li><strong>Google Maps Platform APIs.</strong> We may share your information with certain Google Maps Platform APIs for location-based features.</li>
                <li><strong>Other Users.</strong> When you share personal information or interact with public areas of the Services, such information may be viewed by all users.</li>
              </ul>
            </div>

            <Separator className="my-8" />

            <h2 id="section-4" className="text-2xl font-semibold mt-8 mb-4">4. Do We Use Cookies and Other Tracking Technologies?</h2>
            <p className="italic mb-4">In Short: We may use cookies and other tracking technologies to collect and store your information.</p>
            
            <p className="mb-6">We may use cookies and similar tracking technologies to gather information when you interact with our Services. Some online tracking technologies help us maintain the security of our Services and your account, prevent crashes, fix bugs, save your preferences, and assist with basic site functions.</p>

            <Separator className="my-8" />

            <h2 id="section-5" className="text-2xl font-semibold mt-8 mb-4">5. How Do We Handle Your Social Logins?</h2>
            <p className="italic mb-4">In Short: If you choose to register or log in to our Services using a social media account, we may have access to certain information about you.</p>
            
            <p className="mb-6">Our Services offer you the ability to register and log in using your third-party social media account details. Where you choose to do this, we will receive certain profile information about you from your social media provider. We will use the information we receive only for the purposes described in this Privacy Notice.</p>

            <Separator className="my-8" />

            <h2 id="section-6" className="text-2xl font-semibold mt-8 mb-4">6. How Long Do We Keep Your Information?</h2>
            <p className="italic mb-4">In Short: We keep your information for as long as necessary to fulfill the purposes outlined in this Privacy Notice unless otherwise required by law.</p>
            
            <p className="mb-6">We will only keep your personal information for as long as it is necessary for the purposes set out in this Privacy Notice, unless a longer retention period is required or permitted by law. When we have no ongoing legitimate business need to process your personal information, we will either delete or anonymize such information.</p>

            <Separator className="my-8" />

            <h2 id="section-7" className="text-2xl font-semibold mt-8 mb-4">7. How Do We Keep Your Information Safe?</h2>
            <p className="italic mb-4">In Short: We aim to protect your personal information through a system of organizational and technical security measures.</p>
            
            <p className="mb-6">We have implemented appropriate and reasonable technical and organizational security measures designed to protect the security of any personal information we process. However, despite our safeguards and efforts to secure your information, no electronic transmission over the Internet or information storage technology can be guaranteed to be 100% secure.</p>

            <Separator className="my-8" />

            <h2 id="section-8" className="text-2xl font-semibold mt-8 mb-4">8. Do We Collect Information From Minors?</h2>
            <p className="italic mb-4">In Short: We do not knowingly collect data from or market to children under 18 years of age.</p>
            
            <p className="mb-6">We do not knowingly collect, solicit data from, or market to children under 18 years of age. By using the Services, you represent that you are at least 18 or that you are the parent or guardian of such a minor and consent to such minor dependent's use of the Services. If you become aware of any data we may have collected from children under age 18, please contact us at <a href="mailto:support@waboku.gg" className="text-primary">support@waboku.gg</a>.</p>

            <Separator className="my-8" />

            <h2 id="section-9" className="text-2xl font-semibold mt-8 mb-4">9. What Are Your Privacy Rights?</h2>
            <p className="italic mb-4">In Short: You may review, change, or terminate your account at any time, depending on your country, province, or state of residence.</p>
            
            <div className="bg-muted p-4 rounded-lg mb-6">
              <p className="font-semibold mb-2">Your rights include:</p>
              <ul className="list-disc pl-6 space-y-1">
                <li><strong>Withdrawing your consent:</strong> You have the right to withdraw your consent at any time</li>
                <li><strong>Opting out of marketing:</strong> You can unsubscribe from our marketing communications at any time</li>
                <li><strong>Account Information:</strong> You can review or change information in your account or terminate your account</li>
              </ul>
            </div>
            
            <p className="mb-6">If you have questions or comments about your privacy rights, you may email us at <a href="mailto:support@waboku.gg" className="text-primary">support@waboku.gg</a>.</p>

            <Separator className="my-8" />

            <h2 id="section-10" className="text-2xl font-semibold mt-8 mb-4">10. Controls for Do-Not-Track Features</h2>
            <p className="mb-6">Most web browsers include a Do-Not-Track ("DNT") feature. At this stage, no uniform technology standard for recognizing and implementing DNT signals has been finalized. As such, we do not currently respond to DNT browser signals.</p>

            <Separator className="my-8" />

            <h2 id="section-11" className="text-2xl font-semibold mt-8 mb-4">11. Do United States Residents Have Specific Privacy Rights?</h2>
            <p className="italic mb-4">In Short: If you are a resident of certain US states, you may have the right to request access to and receive details about the personal information we maintain about you and how we have processed it, correct inaccuracies, get a copy of, or delete your personal information.</p>
            
            <div className="bg-muted p-4 rounded-lg mb-6">
              <p className="font-semibold mb-2">Your rights may include:</p>
              <ul className="list-disc pl-6 space-y-1">
                <li>Right to know whether or not we are processing your personal data</li>
                <li>Right to access your personal data</li>
                <li>Right to correct inaccuracies in your personal data</li>
                <li>Right to request the deletion of your personal data</li>
                <li>Right to obtain a copy of the personal data you previously shared with us</li>
                <li>Right to non-discrimination for exercising your rights</li>
              </ul>
            </div>
            
            <p className="mb-6">To exercise these rights, you can contact us by visiting <a href="/support" className="text-primary">our support page</a> or by referring to the contact details at the bottom of this document.</p>

            <Separator className="my-8" />

            <h2 id="section-12" className="text-2xl font-semibold mt-8 mb-4">12. Do We Make Updates to This Notice?</h2>
            <p className="italic mb-4">In Short: Yes, we will update this notice as necessary to stay compliant with relevant laws.</p>
            
            <p className="mb-6">We may update this Privacy Notice from time to time. The updated version will be indicated by an updated "Last updated" date at the top of this Privacy Notice. If we make material changes, we may notify you either by prominently posting a notice of such changes or by directly sending you a notification.</p>

            <Separator className="my-8" />

            <h2 id="section-13" className="text-2xl font-semibold mt-8 mb-4">13. How Can You Contact Us About This Notice?</h2>
            <p className="mb-4">If you have questions or comments about this notice, you may email us at <a href="mailto:support@waboku.gg" className="text-primary">support@waboku.gg</a> or contact us by post at:</p>
            
            <div className="bg-muted p-4 rounded-lg mb-6">
              <p className="font-semibold">Stage Zero, LLC</p>
              <p className="text-sm text-muted-foreground">Contact information available upon request</p>
            </div>

            <Separator className="my-8" />

            <h2 id="section-14" className="text-2xl font-semibold mt-8 mb-4">14. How Can You Review, Update, or Delete the Data We Collect From You?</h2>
            <p className="mb-6">You have the right to request access to the personal information we collect from you, details about how we have processed it, correct inaccuracies, or delete your personal information. To request to review, update, or delete your personal information, please visit <a href="/support" className="text-primary">our support page</a> or contact us directly.</p>

          </CardContent>
        </Card>
      </div>
      <Footer />
    </>
  );
}