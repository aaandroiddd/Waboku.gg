import dynamic from 'next/dynamic';

const CreateListingPage = dynamic(() => import('./create-listing'), {
  ssr: false
})

export default CreateListingPage;