import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function PrivacyPolicyPage() {
  return (
    <div className="container mx-auto py-12 px-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-3xl font-bold text-center mb-6">Privacy Policy</CardTitle>
        </CardHeader>
        <CardContent className="prose dark:prose-invert max-w-none">
          <p className="text-lg mb-6">
            At Waboku.gg, we take your privacy seriously. This Privacy Policy explains how we collect, use, and protect your personal information.
          </p>

          <h2 className="text-2xl font-semibold mt-8 mb-4">Information We Collect</h2>
          <p className="mb-6">
            We collect information that you provide directly to us, including:
          </p>
          <ul className="list-disc pl-6 mb-6">
            <li>Account information (username, email)</li>
            <li>Transaction data</li>
            <li>Communication preferences</li>
            <li>Listing information</li>
          </ul>

          <h2 className="text-2xl font-semibold mt-8 mb-4">How We Use Your Information</h2>
          <p className="mb-6">
            We use the collected information to:
          </p>
          <ul className="list-disc pl-6 mb-6">
            <li>Provide and improve our services</li>
            <li>Process transactions</li>
            <li>Send notifications about your account</li>
            <li>Ensure platform security</li>
          </ul>

          <h2 className="text-2xl font-semibold mt-8 mb-4">Data Security</h2>
          <p className="mb-6">
            We implement appropriate security measures to protect your personal information. However, no method of transmission over the Internet is 100% secure, and we cannot guarantee absolute security.
          </p>

          <h2 className="text-2xl font-semibold mt-8 mb-4">Your Rights</h2>
          <p className="mb-6">
            You have the right to:
          </p>
          <ul className="list-disc pl-6 mb-6">
            <li>Access your personal data</li>
            <li>Correct inaccurate data</li>
            <li>Request deletion of your data</li>
            <li>Opt-out of marketing communications</li>
          </ul>

          <h2 className="text-2xl font-semibold mt-8 mb-4">Contact Us</h2>
          <p className="mb-6">
            If you have any questions about this Privacy Policy, please contact us through our support channels.
          </p>

          <p className="text-sm text-muted-foreground mt-8">
            Last updated: December 2024
          </p>
        </CardContent>
      </Card>
    </div>
  );
}