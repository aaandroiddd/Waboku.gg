import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle, CreditCard, Shield, Globe, Clock, DollarSign } from 'lucide-react';

const SellerAccountBenefits: React.FC = () => {
  const benefits = [
    {
      icon: <CreditCard className="h-8 w-8 text-primary" />,
      title: "Secure Payments",
      description: "Accept credit cards and other payment methods securely through Stripe's trusted platform."
    },
    {
      icon: <Shield className="h-8 w-8 text-primary" />,
      title: "Fraud Protection",
      description: "Benefit from Stripe's advanced fraud detection and prevention systems to protect your business."
    },
    {
      icon: <Globe className="h-8 w-8 text-primary" />,
      title: "Global Reach",
      description: "Sell to customers worldwide with support for multiple currencies and payment methods."
    },
    {
      icon: <Clock className="h-8 w-8 text-primary" />,
      title: "Fast Payouts",
      description: "Receive your funds quickly with Stripe's efficient payout schedule to your bank account."
    },
    {
      icon: <DollarSign className="h-8 w-8 text-primary" />,
      title: "Transparent Pricing",
      description: "Clear fee structure with no hidden costs. Only pay when you make a sale."
    },
    {
      icon: <CheckCircle className="h-8 w-8 text-primary" />,
      title: "Easy Integration",
      description: "Seamlessly integrated with our platform - no technical knowledge required."
    }
  ];

  return (
    <Card className="border-0 shadow-none">
      <CardHeader>
        <CardTitle className="text-2xl">Benefits of Stripe Connect</CardTitle>
        <CardDescription>
          Connecting your account with Stripe provides these advantages for sellers
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {benefits.map((benefit, index) => (
            <div key={index} className="flex flex-col items-center text-center p-4 rounded-lg border bg-card">
              <div className="mb-3">
                {benefit.icon}
              </div>
              <h3 className="text-lg font-medium mb-2">{benefit.title}</h3>
              <p className="text-sm text-muted-foreground">{benefit.description}</p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

export default SellerAccountBenefits;