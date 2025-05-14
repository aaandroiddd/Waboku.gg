import React from 'react';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

const SellerAccountFAQ: React.FC = () => {
  const faqs = [
    {
      question: "What is Stripe Connect?",
      answer: "Stripe Connect is a payment platform that allows you to accept payments securely on our marketplace. It handles payment processing, security, and transfers funds directly to your bank account."
    },
    {
      question: "What information do I need to provide?",
      answer: "You'll need to provide basic personal information, business details if applicable, and banking information for receiving payments. For identity verification, you may need to provide a government-issued ID."
    },
    {
      question: "How long does verification take?",
      answer: "Most accounts are verified instantly or within 24 hours. In some cases, Stripe may require additional information which could extend this timeframe."
    },
    {
      question: "Are there any fees for using Stripe Connect?",
      answer: "Our platform charges a small percentage fee on each transaction. This fee covers payment processing, fraud prevention, and platform maintenance. You'll only pay fees when you make a sale."
    },
    {
      question: "How quickly will I receive my money?",
      answer: "Once a payment is processed, funds are typically available in your Stripe account within 2 business days. From there, Stripe automatically transfers the money to your bank account based on your payout schedule."
    },
    {
      question: "Is my information secure?",
      answer: "Yes, Stripe uses bank-level security and is PCI compliant. Your sensitive information is encrypted and securely stored according to the highest industry standards."
    }
  ];

  return (
    <Card className="border-0 shadow-none">
      <CardHeader>
        <CardTitle className="text-2xl">Frequently Asked Questions</CardTitle>
        <CardDescription>
          Common questions about setting up your seller account
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Accordion type="single" collapsible className="w-full">
          {faqs.map((faq, index) => (
            <AccordionItem key={index} value={`item-${index}`}>
              <AccordionTrigger className="text-left">{faq.question}</AccordionTrigger>
              <AccordionContent>
                <p className="text-muted-foreground">{faq.answer}</p>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </CardContent>
    </Card>
  );
};

export default SellerAccountFAQ;