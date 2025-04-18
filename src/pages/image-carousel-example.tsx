import { NextPage } from 'next';
import ImageCarousel from '../components/ImageCarousel';
import { Card } from '../components/ui/card';

const ImageCarouselExample: NextPage = () => {
  // Example images - replace with your actual images
  const exampleImages = [
    'https://images.unsplash.com/photo-1682687220063-4742bd7fd538?q=80&w=1000',
    'https://images.unsplash.com/photo-1682687220198-88e9bdea9931?q=80&w=1000',
    'https://images.unsplash.com/photo-1682687220067-dced9a881b56?q=80&w=1000',
    'https://images.unsplash.com/photo-1682687220923-c7a7cf9ece67?q=80&w=1000',
  ];

  return (
    <div className="container mx-auto py-10">
      <h1 className="text-3xl font-bold mb-6 text-center">Image Carousel Example</h1>
      
      <Card className="p-6 max-w-2xl mx-auto">
        <h2 className="text-xl font-semibold mb-4">Basic Image Carousel</h2>
        <p className="text-muted-foreground mb-6">
          Click on an image to view it in fullscreen mode. In fullscreen mode, you can zoom in/out and navigate between images.
        </p>
        
        <ImageCarousel images={exampleImages} />
      </Card>
      
      <div className="mt-10 text-center">
        <p className="text-muted-foreground">
          This component can be used in product listings, galleries, and anywhere you need to display multiple images.
        </p>
      </div>
    </div>
  );
};

export default ImageCarouselExample;