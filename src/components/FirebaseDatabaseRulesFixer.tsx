import React, { useState } from 'react';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { Textarea } from '@/components/ui/textarea';

export function FirebaseDatabaseRulesFixer() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  
  const fixDatabaseRules = async () => {
    setLoading(true);
    setError('');
    setSuccess('');
    
    try {
      const response = await fetch('/api/admin/update-database-rules', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'fix_chat_permissions'
        })
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to update database rules');
      }
      
      setSuccess('Database rules updated successfully');
      toast({
        title: "Success",
        description: "Database rules have been updated to fix chat permissions",
      });
    } catch (error) {
      console.error('Error updating database rules:', error);
      setError(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      toast({
        title: "Error",
        description: `Failed to update database rules: ${error instanceof Error ? error.message : 'Unknown error'}`,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };
  
  const simplifiedRules = `
// Simplified rules for chats and messages
"chats": {
  ".read": "auth != null",
  ".write": "auth != null",
  "$chatId": {
    ".read": "auth != null",
    ".write": "auth != null",
    "participants": {
      "$uid": {
        ".validate": "newData.isBoolean() && ($uid === auth.uid || root.child('users').child($uid).exists())"
      }
    },
    "createdAt": {
      ".validate": "newData.isNumber() && newData.val() <= now"
    }
  }
},

"messages": {
  ".read": "auth != null",
  ".write": "auth != null",
  "$chatId": {
    ".read": "auth != null",
    ".write": "auth != null",
    "$messageId": {
      "senderId": {
        ".validate": "newData.val() === auth.uid"
      },
      "content": {
        ".validate": "newData.isString()"
      },
      "timestamp": {
        ".validate": "newData.isNumber() && newData.val() <= now"
      }
    }
  }
}
  `;

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Fix Database Rules for Chat Permissions</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <div className="bg-destructive/10 text-destructive p-3 rounded">
            {error}
          </div>
        )}
        
        {success && (
          <div className="bg-green-100 text-green-800 p-3 rounded">
            {success}
          </div>
        )}
        
        <div className="space-y-2">
          <div className="font-medium">Simplified Rules for Chat Permissions:</div>
          <Textarea 
            readOnly
            className="font-mono text-xs h-64"
            value={simplifiedRules}
          />
        </div>
        
        <p className="text-sm text-muted-foreground">
          This will update your database rules to fix permission issues with chat and message creation.
          The changes will simplify the validation rules while maintaining security.
        </p>
      </CardContent>
      <CardFooter>
        <Button onClick={fixDatabaseRules} disabled={loading}>
          {loading ? 'Updating Rules...' : 'Update Database Rules'}
        </Button>
      </CardFooter>
    </Card>
  );
}