import dynamic from 'next/dynamic';

const CreateListingPage = dynamic(() => import('./create-listing/main'), {
  ssr: false
})

export default CreateListingPage;