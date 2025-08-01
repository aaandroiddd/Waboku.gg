import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from '@/contexts/AuthContext';
import { Shield, Key, Copy, RefreshCw, AlertTriangle, CheckCircle, Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';

interface BackupCode {
  code: string;
  used: boolean;
  usedAt?: number;
}

interface MfaStatus {
  enabled: boolean;
  backupCodes: BackupCode[];
  needsRegeneration: boolean;
  unusedCodesCount: number;
  lastBackupGenerated?: number;
}

export default function AdminSecurityManager() {
  const { user } = useAuth();
  const [mfaStatus, setMfaStatus] = useState<MfaStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showBackupCodes, setShowBackupCodes] = useState(false);
  const [newBackupCode, setNewBackupCode] = useState('');
  const [testingBackupCode, setTestingBackupCode] = useState(false);

  useEffect(() => {
    loadMfaStatus();
  }, [user]);

  const loadMfaStatus = async () => {
    if (!user) return;

    try {
      setLoading(true);
      const token = await user.getIdToken();
      
      const response = await fetch('/api/admin/mfa-setup', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          action: 'get-status',
          userId: user.uid
        })
      });

      if (response.ok) {
        const data = await response.json();
        setMfaStatus(data);
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to load MFA status');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load MFA status');
    } finally {
      setLoading(false);
    }
  };

  const enableMfa = async () => {
    if (!user) return;

    try {
      setLoading(true);
      setError(null);
      const token = await user.getIdToken();
      
      const response = await fetch('/api/admin/mfa-setup', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          action: 'enable',
          userId: user.uid
        })
      });

      if (response.ok) {
        const data = await response.json();
        setMfaStatus({
          enabled: true,
          backupCodes: data.backupCodes,
          needsRegeneration: data.needsRegeneration,
          unusedCodesCount: data.backupCodes.filter((code: BackupCode) => !code.used).length,
          lastBackupGenerated: Date.now()
        });
        setShowBackupCodes(true);
        toast.success('Admin MFA enabled successfully! Please save your backup codes.');
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to enable MFA');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to enable MFA');
    } finally {
      setLoading(false);
    }
  };

  const disableMfa = async () => {
    if (!user) return;

    if (!confirm('Are you sure you want to disable admin MFA? This will reduce the security of your admin account.')) {
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const token = await user.getIdToken();
      
      const response = await fetch('/api/admin/mfa-setup', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          action: 'disable',
          userId: user.uid
        })
      });

      if (response.ok) {
        setMfaStatus({
          enabled: false,
          backupCodes: [],
          needsRegeneration: false,
          unusedCodesCount: 0
        });
        toast.success('Admin MFA disabled successfully');
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to disable MFA');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to disable MFA');
    } finally {
      setLoading(false);
    }
  };

  const generateNewBackupCodes = async () => {
    if (!user) return;

    if (!confirm('Are you sure you want to generate new backup codes? This will invalidate all existing codes.')) {
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const token = await user.getIdToken();
      
      const response = await fetch('/api/admin/mfa-setup', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          action: 'generate-backup-codes',
          userId: user.uid
        })
      });

      if (response.ok) {
        const data = await response.json();
        setMfaStatus(prev => prev ? {
          ...prev,
          backupCodes: data.backupCodes,
          needsRegeneration: false,
          unusedCodesCount: data.backupCodes.length,
          lastBackupGenerated: Date.now()
        } : null);
        setShowBackupCodes(true);
        toast.success('New backup codes generated successfully! Please save them.');
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to generate backup codes');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to generate backup codes');
    } finally {
      setLoading(false);
    }
  };

  const copyBackupCodes = () => {
    if (!mfaStatus?.backupCodes) return;

    const codesText = mfaStatus.backupCodes
      .map(code => `${code.code}${code.used ? ' (USED)' : ''}`)
      .join('\n');
    
    navigator.clipboard.writeText(codesText);
    toast.success('Backup codes copied to clipboard');
  };

  const testBackupCode = async () => {
    if (!user || !newBackupCode) return;

    try {
      setTestingBackupCode(true);
      const token = await user.getIdToken();
      
      const response = await fetch('/api/admin/verify-enhanced', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          backupCode: newBackupCode
        })
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success && data.mfaVerified) {
          toast.success('Backup code is valid and has been consumed');
          setNewBackupCode('');
          loadMfaStatus(); // Reload to show updated status
        } else {
          toast.error('Backup code verification failed');
        }
      } else {
        const errorData = await response.json();
        toast.error(errorData.error || 'Failed to test backup code');
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to test backup code');
    } finally {
      setTestingBackupCode(false);
    }
  };

  if (!user) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          You must be logged in to manage admin security settings.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Admin Security Manager
          </CardTitle>
          <CardDescription>
            Manage two-factor authentication and backup codes for admin access
          </CardDescription>
        </CardHeader>
        <CardContent>
          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {loading && (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="h-6 w-6 animate-spin" />
              <span className="ml-2">Loading...</span>
            </div>
          )}

          {!loading && mfaStatus && (
            <Tabs defaultValue="status" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="status">Status</TabsTrigger>
                <TabsTrigger value="backup-codes">Backup Codes</TabsTrigger>
                <TabsTrigger value="test">Test</TabsTrigger>
              </TabsList>

              <TabsContent value="status" className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-medium">MFA Status</h3>
                    <p className="text-sm text-muted-foreground">
                      Current two-factor authentication status
                    </p>
                  </div>
                  <Badge variant={mfaStatus.enabled ? "default" : "secondary"}>
                    {mfaStatus.enabled ? "Enabled" : "Disabled"}
                  </Badge>
                </div>

                {mfaStatus.enabled && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span>Unused backup codes:</span>
                      <Badge variant={mfaStatus.unusedCodesCount < 3 ? "destructive" : "default"}>
                        {mfaStatus.unusedCodesCount}
                      </Badge>
                    </div>
                    
                    {mfaStatus.needsRegeneration && (
                      <Alert variant="destructive">
                        <AlertTriangle className="h-4 w-4" />
                        <AlertDescription>
                          You have fewer than 3 unused backup codes. Consider generating new ones.
                        </AlertDescription>
                      </Alert>
                    )}
                  </div>
                )}

                <div className="flex gap-2">
                  {!mfaStatus.enabled ? (
                    <Button onClick={enableMfa} disabled={loading}>
                      <Shield className="h-4 w-4 mr-2" />
                      Enable Admin MFA
                    </Button>
                  ) : (
                    <>
                      <Button onClick={generateNewBackupCodes} disabled={loading}>
                        <RefreshCw className="h-4 w-4 mr-2" />
                        Generate New Codes
                      </Button>
                      <Button variant="destructive" onClick={disableMfa} disabled={loading}>
                        Disable MFA
                      </Button>
                    </>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="backup-codes" className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-medium">Backup Codes</h3>
                    <p className="text-sm text-muted-foreground">
                      Use these codes if you can't access your primary MFA method
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowBackupCodes(!showBackupCodes)}
                  >
                    {showBackupCodes ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    {showBackupCodes ? 'Hide' : 'Show'}
                  </Button>
                </div>

                {mfaStatus.enabled && mfaStatus.backupCodes.length > 0 && (
                  <div className="space-y-2">
                    {showBackupCodes && (
                      <>
                        <div className="grid grid-cols-2 gap-2 p-4 bg-muted rounded-lg font-mono text-sm">
                          {mfaStatus.backupCodes.map((code, index) => (
                            <div
                              key={index}
                              className={`flex items-center justify-between p-2 rounded ${
                                code.used ? 'bg-destructive/10 text-destructive line-through' : 'bg-background'
                              }`}
                            >
                              <span>{code.code}</span>
                              {code.used && <span className="text-xs">(USED)</span>}
                            </div>
                          ))}
                        </div>
                        
                        <div className="flex gap-2">
                          <Button variant="outline" size="sm" onClick={copyBackupCodes}>
                            <Copy className="h-4 w-4 mr-2" />
                            Copy All Codes
                          </Button>
                        </div>
                        
                        <Alert>
                          <Key className="h-4 w-4" />
                          <AlertDescription>
                            Save these backup codes in a secure location. Each code can only be used once.
                          </AlertDescription>
                        </Alert>
                      </>
                    )}
                  </div>
                )}

                {!mfaStatus.enabled && (
                  <Alert>
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>
                      MFA is not enabled. Enable MFA to generate backup codes.
                    </AlertDescription>
                  </Alert>
                )}
              </TabsContent>

              <TabsContent value="test" className="space-y-4">
                <div>
                  <h3 className="text-lg font-medium">Test Backup Code</h3>
                  <p className="text-sm text-muted-foreground">
                    Test a backup code to verify it works (this will consume the code)
                  </p>
                </div>

                {mfaStatus.enabled ? (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="backup-code">Backup Code</Label>
                      <Input
                        id="backup-code"
                        type="text"
                        placeholder="Enter 8-character backup code"
                        value={newBackupCode}
                        onChange={(e) => setNewBackupCode(e.target.value.toUpperCase())}
                        maxLength={8}
                        className="font-mono"
                      />
                    </div>
                    
                    <Button 
                      onClick={testBackupCode} 
                      disabled={!newBackupCode || testingBackupCode}
                    >
                      {testingBackupCode ? (
                        <>
                          <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                          Testing...
                        </>
                      ) : (
                        <>
                          <CheckCircle className="h-4 w-4 mr-2" />
                          Test Code
                        </>
                      )}
                    </Button>
                    
                    <Alert variant="destructive">
                      <AlertTriangle className="h-4 w-4" />
                      <AlertDescription>
                        Warning: Testing a backup code will consume it. Only test if you have multiple unused codes.
                      </AlertDescription>
                    </Alert>
                  </div>
                ) : (
                  <Alert>
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>
                      MFA is not enabled. Enable MFA to test backup codes.
                    </AlertDescription>
                  </Alert>
                )}
              </TabsContent>
            </Tabs>
          )}
        </CardContent>
      </Card>
    </div>
  );
}