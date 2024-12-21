import dynamic from 'next/dynamic';

const DashboardPage = dynamic(() => import('./main'), {
  ssr: false
})

export default DashboardPage;