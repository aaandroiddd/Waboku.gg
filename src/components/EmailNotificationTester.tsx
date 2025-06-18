import { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface EmailNotificationTesterProps {
  adminSecret: string;
}

interface TestResult {
  success: boolean;
  message: string;
  details?: any;
}

interface ListingTestData {
  listingId: string;
  cardName: string;
  setName: string;
  condition: string;
  price: string;
  quantity: number;
  game: string;
  sellerName: string;
  sellerLocation: string;
  buyerName: string;
  buyerEmail: string;
}

export function EmailNotificationTester({ adminSecret }: EmailNotificationTesterProps) {
  const [userEmail, setUserEmail] = useState('');
  const [userName, setUserName] = useState('');
  const [emailType, setEmailType] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<TestResult | null>(null);
  
  // Enhanced test data for marketplace scenarios
  const [listingData, setListingData] = useState<ListingTestData>({
    listingId: 'LST-' + Math.random().toString(36).substr(2, 9).toUpperCase(),
    cardName: 'Charizard',
    setName: 'Base Set',
    condition: 'Near Mint',
    price: '299.99',
    quantity: 1,
    game: 'pokemon',
    sellerName: 'CardCollector123',
    sellerLocation: 'California, USA',
    buyerName: userName || 'TestBuyer',
    buyerEmail: userEmail || 'buyer@example.com'
  });

  const handleTestEmail = async () => {
    if (!userEmail || !userName || !emailType) {
      setResult({
        success: false,
        message: 'Please fill in all fields'
      });
      return;
    }

    setLoading(true);
    setResult(null);

    try {
      let requestBody: any = {
        userEmail,
        userName,
        type: emailType
      };

      // Add listing data for marketplace-specific email types
      if (['marketplace-purchase', 'marketplace-sale', 'marketplace-shipping', 'marketplace-offer', 'marketplace-payment-received', 'marketplace-order-shipped'].includes(emailType)) {
        requestBody.listingData = {
          ...listingData,
          buyerName: userName,
          buyerEmail: userEmail
        };
      }

      const response = await fetch('/api/notifications/test-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-secret': adminSecret
        },
        body: JSON.stringify(requestBody)
      });

      const data = await response.json();
      
      setResult({
        success: response.ok && data.success,
        message: data.message || (response.ok ? 'Email sent successfully' : 'Failed to send email'),
        details: data
      });
    } catch (error) {
      setResult({
        success: false,
        message: 'Error testing email notification',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }

    setLoading(false);
  };

  const clearForm = () => {
    setUserEmail('');
    setUserName('');
    setEmailType('');
    setResult(null);
  };

  const generateRandomListingData = () => {
    const cards = [
      { name: 'Charizard', set: 'Base Set', game: 'pokemon', price: '299.99' },
      { name: 'Black Lotus', set: 'Alpha', game: 'magic', price: '15000.00' },
      { name: 'Blue-Eyes White Dragon', set: 'LOB', game: 'yugioh', price: '89.99' },
      { name: 'Pikachu', set: 'Base Set', game: 'pokemon', price: '45.99' },
      { name: 'Mox Ruby', set: 'Beta', game: 'magic', price: '3500.00' },
      { name: 'Dark Magician', set: 'LOB', game: 'yugioh', price: '125.50' }
    ];
    
    const conditions = ['Near Mint', 'Lightly Played', 'Moderately Played', 'Heavily Played', 'Damaged'];
    const sellers = ['CardCollector123', 'TCGMaster', 'VintageCards', 'ProTrader', 'CollectorPro'];
    const locations = ['California, USA', 'New York, USA', 'Texas, USA', 'Florida, USA', 'Illinois, USA'];
    
    const randomCard = cards[Math.floor(Math.random() * cards.length)];
    
    setListingData({
      listingId: 'LST-' + Math.random().toString(36).substr(2, 9).toUpperCase(),
      cardName: randomCard.name,
      setName: randomCard.set,
      condition: conditions[Math.floor(Math.random() * conditions.length)],
      price: randomCard.price,
      quantity: Math.floor(Math.random() * 3) + 1,
      game: randomCard.game,
      sellerName: sellers[Math.floor(Math.random() * sellers.length)],
      sellerLocation: locations[Math.floor(Math.random() * locations.length)],
      buyerName: userName || 'TestBuyer',
      buyerEmail: userEmail || 'buyer@example.com'
    });
  };

  return (
    <Tabs defaultValue="basic" className="space-y-6">
      <TabsList className="grid w-full grid-cols-2">
        <TabsTrigger value="basic">Basic Email Tests</TabsTrigger>
        <TabsTrigger value="marketplace">Marketplace Tests</TabsTrigger>
      </TabsList>

      <TabsContent value="basic" className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="userEmail">User Email</Label>
            <Input
              id="userEmail"
              type="email"
              placeholder="user@example.com"
              value={userEmail}
              onChange={(e) => setUserEmail(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="userName">User Name</Label>
            <Input
              id="userName"
              placeholder="John Doe"
              value={userName}
              onChange={(e) => setUserName(e.target.value)}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="emailType">Email Type</Label>
          <Select value={emailType} onValueChange={setEmailType}>
            <SelectTrigger>
              <SelectValue placeholder="Select email type to test" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="welcome">🎴 Welcome Email</SelectItem>
              <SelectItem value="order-confirmation">⚡ Order Confirmation</SelectItem>
              <SelectItem value="payment-confirmation">💳 Payment Confirmation</SelectItem>
              <SelectItem value="shipping">📦 Shipping Notification</SelectItem>
              <SelectItem value="verification">🔐 Account Verification</SelectItem>
              <SelectItem value="password-reset">🔑 Password Reset</SelectItem>
              <SelectItem value="notification">🔔 Test Notification Email</SelectItem>
              <SelectItem value="full-notification">🧪 Full Notification System Test</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex gap-2">
          <Button 
            onClick={handleTestEmail}
            disabled={loading || !userEmail || !userName || !emailType}
            className="flex-1"
          >
            {loading ? 'Sending...' : 'Send Test Email'}
          </Button>
          <Button 
            onClick={clearForm}
            variant="outline"
            disabled={loading}
          >
            Clear
          </Button>
        </div>
      </TabsContent>

      <TabsContent value="marketplace" className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="userEmail">User Email</Label>
            <Input
              id="userEmail"
              type="email"
              placeholder="user@example.com"
              value={userEmail}
              onChange={(e) => {
                setUserEmail(e.target.value);
                setListingData(prev => ({ ...prev, buyerEmail: e.target.value }));
              }}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="userName">User Name</Label>
            <Input
              id="userName"
              placeholder="John Doe"
              value={userName}
              onChange={(e) => {
                setUserName(e.target.value);
                setListingData(prev => ({ ...prev, buyerName: e.target.value }));
              }}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="emailType">Marketplace Email Type</Label>
          <Select value={emailType} onValueChange={setEmailType}>
            <SelectTrigger>
              <SelectValue placeholder="Select marketplace email type to test" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="marketplace-purchase">🛒 Purchase Confirmation (Buyer)</SelectItem>
              <SelectItem value="marketplace-sale">💰 New Sale Notification (Seller)</SelectItem>
              <SelectItem value="marketplace-shipping">📦 Shipping Update (Buyer)</SelectItem>
              <SelectItem value="marketplace-offer">💸 New Offer Notification (Seller)</SelectItem>
              <SelectItem value="marketplace-payment-received">💳 Payment Received (Seller)</SelectItem>
              <SelectItem value="marketplace-order-shipped">🚚 Order Shipped (Buyer)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Card className="p-4">
          <div className="flex justify-between items-center mb-4">
            <h4 className="font-medium">Test Listing Data</h4>
            <Button 
              onClick={generateRandomListingData}
              variant="outline"
              size="sm"
            >
              🎲 Generate Random
            </Button>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="cardName">Card Name</Label>
              <Input
                id="cardName"
                value={listingData.cardName}
                onChange={(e) => setListingData(prev => ({ ...prev, cardName: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="setName">Set Name</Label>
              <Input
                id="setName"
                value={listingData.setName}
                onChange={(e) => setListingData(prev => ({ ...prev, setName: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="condition">Condition</Label>
              <Select 
                value={listingData.condition} 
                onValueChange={(value) => setListingData(prev => ({ ...prev, condition: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Near Mint">Near Mint</SelectItem>
                  <SelectItem value="Lightly Played">Lightly Played</SelectItem>
                  <SelectItem value="Moderately Played">Moderately Played</SelectItem>
                  <SelectItem value="Heavily Played">Heavily Played</SelectItem>
                  <SelectItem value="Damaged">Damaged</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="price">Price ($)</Label>
              <Input
                id="price"
                value={listingData.price}
                onChange={(e) => setListingData(prev => ({ ...prev, price: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="quantity">Quantity</Label>
              <Input
                id="quantity"
                type="number"
                min="1"
                value={listingData.quantity}
                onChange={(e) => setListingData(prev => ({ ...prev, quantity: parseInt(e.target.value) || 1 }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="game">Game</Label>
              <Select 
                value={listingData.game} 
                onValueChange={(value) => setListingData(prev => ({ ...prev, game: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pokemon">Pokémon</SelectItem>
                  <SelectItem value="magic">Magic: The Gathering</SelectItem>
                  <SelectItem value="yugioh">Yu-Gi-Oh!</SelectItem>
                  <SelectItem value="digimon">Digimon</SelectItem>
                  <SelectItem value="dragonball">Dragon Ball</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="sellerName">Seller Name</Label>
              <Input
                id="sellerName"
                value={listingData.sellerName}
                onChange={(e) => setListingData(prev => ({ ...prev, sellerName: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sellerLocation">Seller Location</Label>
              <Input
                id="sellerLocation"
                value={listingData.sellerLocation}
                onChange={(e) => setListingData(prev => ({ ...prev, sellerLocation: e.target.value }))}
              />
            </div>
          </div>
        </Card>

        <div className="flex gap-2">
          <Button 
            onClick={handleTestEmail}
            disabled={loading || !userEmail || !userName || !emailType}
            className="flex-1"
          >
            {loading ? 'Sending...' : 'Send Test Email'}
          </Button>
          <Button 
            onClick={clearForm}
            variant="outline"
            disabled={loading}
          >
            Clear
          </Button>
        </div>
      </TabsContent>

      {result && (
        <Alert className={result.success ? 'border-green-500 bg-green-50' : 'border-red-500 bg-red-50'}>
          <AlertDescription>
            <div className="space-y-2">
              <div className={result.success ? 'text-green-700' : 'text-red-700'}>
                {result.success ? '✅' : '❌'} {result.message}
              </div>
              {result.details && (
                <details className="text-sm">
                  <summary className="cursor-pointer font-medium">View Details</summary>
                  <pre className="mt-2 p-2 bg-gray-100 rounded text-xs overflow-x-auto">
                    {JSON.stringify(result.details, null, 2)}
                  </pre>
                </details>
              )}
            </div>
          </AlertDescription>
        </Alert>
      )}

      <Card className="p-4 bg-blue-50 border-blue-200">
        <h4 className="font-medium text-blue-900 mb-2">Email Type Descriptions:</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <h5 className="font-medium text-blue-800 mb-2">Basic Email Types:</h5>
            <ul className="text-sm text-blue-800 space-y-1">
              <li><strong>🎴 Welcome Email:</strong> Platform introduction and getting started guide</li>
              <li><strong>⚡ Order Confirmation:</strong> Purchase confirmation with order details</li>
              <li><strong>💳 Payment Confirmation:</strong> Payment processing confirmation</li>
              <li><strong>📦 Shipping Notification:</strong> Tracking information and delivery details</li>
              <li><strong>🔐 Account Verification:</strong> Email verification with code</li>
              <li><strong>🔑 Password Reset:</strong> Secure password reset link</li>
              <li><strong>🔔 Test Notification:</strong> Simple delivery test</li>
              <li><strong>🧪 Full System Test:</strong> Complete notification flow test</li>
            </ul>
          </div>
          <div>
            <h5 className="font-medium text-blue-800 mb-2">Marketplace Email Types:</h5>
            <ul className="text-sm text-blue-800 space-y-1">
              <li><strong>🛒 Purchase Confirmation:</strong> Buyer receives order confirmation with realistic listing data</li>
              <li><strong>💰 New Sale Notification:</strong> Seller receives notification of new sale</li>
              <li><strong>📦 Shipping Update:</strong> Buyer receives shipping notification with tracking</li>
              <li><strong>💸 New Offer:</strong> Seller receives notification of new offer on listing</li>
              <li><strong>💳 Payment Received:</strong> Seller receives payment confirmation</li>
              <li><strong>🚚 Order Shipped:</strong> Buyer receives shipment confirmation</li>
            </ul>
          </div>
        </div>
      </Card>

      <Card className="p-4 bg-green-50 border-green-200">
        <h4 className="font-medium text-green-900 mb-2">Stripe Mock Data Used:</h4>
        <ul className="text-sm text-green-800 space-y-1">
          <li>• <strong>Test Card:</strong> 4242 4242 4242 4242 (Visa)</li>
          <li>• <strong>Transaction ID:</strong> pi_test_1234567890</li>
          <li>• <strong>Payment Method:</strong> Visa ending in 4242</li>
          <li>• <strong>Tracking Number:</strong> 1Z999AA1234567890 (UPS)</li>
          <li>• <strong>Order Numbers:</strong> Randomly generated (ORD-XXXXXXX format)</li>
          <li>• <strong>Processing Fees:</strong> Calculated as 3.1% + $0.30 (realistic Stripe fees)</li>
        </ul>
      </Card>

      <Card className="p-4 bg-yellow-50 border-yellow-200">
        <h4 className="font-medium text-yellow-900 mb-2">Important Notes:</h4>
        <ul className="text-sm text-yellow-800 space-y-1">
          <li>• Make sure the RESEND_API_KEY environment variable is properly configured</li>
          <li>• Email delivery may take a few moments</li>
          <li>• Check spam/junk folders if emails don't appear in inbox</li>
          <li>• The "from" address is configured as notifications@waboku.gg</li>
          <li>• Marketplace tests use realistic listing data and Stripe mock information</li>
          <li>• Use the "Generate Random" button to test with different card combinations</li>
        </ul>
      </Card>
    </Tabs>
  );
}