import { FirebaseDatabaseRulesFixer } from '@/components/FirebaseDatabaseRulesFixer';

export default function FixDatabaseRulesPage() {
  return (
    <div className="container py-8">
      <h1 className="text-2xl font-bold mb-6">Fix Database Rules</h1>
      <p className="mb-6 text-muted-foreground">
        This page allows you to update your Firebase Realtime Database rules to fix permission issues with chat and message creation.
      </p>
      
      <FirebaseDatabaseRulesFixer />
      
      <div className="mt-8 text-sm text-muted-foreground">
        <p>The updated rules will:</p>
        <ul className="list-disc list-inside mt-2 space-y-1">
          <li>Simplify validation for chat and message creation</li>
          <li>Ensure authenticated users can create chats and messages</li>
          <li>Maintain basic security while fixing permission issues</li>
        </ul>
      </div>
    </div>
  );
}