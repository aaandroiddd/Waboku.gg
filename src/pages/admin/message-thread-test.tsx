import { MessageThreadTest } from '@/components/MessageThreadTest';
import { Card } from '@/components/ui/card';

export default function MessageThreadTestPage() {
  return (
    <div className="container py-8">
      <h1 className="text-2xl font-bold mb-6">Message Thread Test</h1>
      <p className="mb-6 text-muted-foreground">
        This page allows you to test chat and message creation to diagnose permission issues.
      </p>
      
      <MessageThreadTest />
      
      <div className="mt-8">
        <h2 className="text-xl font-bold mb-4">Debugging Instructions</h2>
        <Card className="p-4">
          <ol className="list-decimal list-inside space-y-2">
            <li>Enter a valid user ID in the "Receiver User ID" field</li>
            <li>Click "Create/Find Chat" to create a new chat or find an existing one</li>
            <li>If successful, you'll see the chat ID and can send messages</li>
            <li>Type a message and click "Send Message"</li>
            <li>Check the debug info and error messages if any issues occur</li>
          </ol>
        </Card>
      </div>
    </div>
  );
}