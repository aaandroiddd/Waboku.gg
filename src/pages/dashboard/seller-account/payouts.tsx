import React from 'react';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import PayoutDashboard from '@/components/PayoutDashboard';
import Head from 'next/head';

const PayoutsPage = () => {
  return (
    <>
      <Head>
        <title>Payouts & Earnings | Dashboard</title>
      </Head>
      
      <DashboardLayout>
        <div className="container max-w-7xl py-6">
          <PayoutDashboard />
        </div>
      </DashboardLayout>
    </>
  );
};

export default PayoutsPage;