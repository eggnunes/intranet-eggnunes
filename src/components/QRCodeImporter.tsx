import { useState, useRef } from 'react';
import jsQR from 'jsqr';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Upload, QrCode, Check, AlertCircle, Loader2 } from 'lucide-react';
import { decodeMigrationUrl, decodeStandardOtpauthUrl, OtpAccount } from '@/lib/googleAuthMigration';
import { toast } from 'sonner';

interface QRCodeImporterProps {
  onImport: (accounts: { name: string; description: string; secret_key: string }[]) => Promise<void>;
  existingSecrets: string[];
}

export function QRCodeImporter({ onImport, existingSecrets }: QRCodeImporterProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [accounts, setAccounts] = useState<OtpAccount[]>([]);
  const [selectedAccounts, setSelectedAccounts] = useState<Set<number>>(new Set());
  const [isImporting, setIsImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processImage = async (file: File) => {
    setIsProcessing(true);
    setAccounts([]);
    setSelectedAccounts(new Set());

    try {
      const img = new Image();
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');

      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error('Falha ao carregar imagem'));
        img.src = URL.createObjectURL(file);
      });

      canvas.width = img.width;
      canvas.height = img.height;
      ctx?.drawImage(img, 0, 0);

      const imageData = ctx?.getImageData(0, 0, canvas.width, canvas.height);
      if (!imageData) {
        throw new Error('Falha ao processar imagem');
      }

      const qrCode = jsQR(imageData.data, imageData.width, imageData.height);
      if (!qrCode) {
        throw new Error('Nenhum QR code encontrado na imagem');
      }

      const qrData = qrCode.data;
      console.log('QR Code data:', qrData);

      let decodedAccounts: OtpAccount[] = [];

      if (qrData.startsWith('otpauth-migration://')) {
        decodedAccounts = decodeMigrationUrl(qrData);
      } else if (qrData.startsWith('otpauth://')) {
        const account = decodeStandardOtpauthUrl(qrData);
        if (account) {
          decodedAccounts = [account];
        }
      } else {
        throw new Error('Formato de QR code não reconhecido');
      }

      if (decodedAccounts.length === 0) {
        throw new Error('Nenhuma conta encontrada no QR code');
      }

      setAccounts(decodedAccounts);
      // Pre-select accounts that don't already exist
      const newSelections = new Set<number>();
      decodedAccounts.forEach((acc, idx) => {
        if (!existingSecrets.includes(acc.secret)) {
          newSelections.add(idx);
        }
      });
      setSelectedAccounts(newSelections);

      toast.success(`${decodedAccounts.length} conta(s) encontrada(s)!`);
    } catch (error) {
      console.error('Error processing QR code:', error);
      toast.error(error instanceof Error ? error.message : 'Erro ao processar QR code');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processImage(file);
    }
  };

  const toggleAccount = (index: number) => {
    const newSelected = new Set(selectedAccounts);
    if (newSelected.has(index)) {
      newSelected.delete(index);
    } else {
      newSelected.add(index);
    }
    setSelectedAccounts(newSelected);
  };

  const handleImport = async () => {
    if (selectedAccounts.size === 0) {
      toast.error('Selecione pelo menos uma conta para importar');
      return;
    }

    setIsImporting(true);
    try {
      const accountsToImport = Array.from(selectedAccounts).map(idx => {
        const acc = accounts[idx];
        return {
          name: acc.issuer || acc.name,
          description: acc.issuer ? acc.name : '',
          secret_key: acc.secret
        };
      });

      await onImport(accountsToImport);
      setAccounts([]);
      setSelectedAccounts(new Set());
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } finally {
      setIsImporting(false);
    }
  };

  const selectAll = () => {
    const allIndexes = new Set<number>();
    accounts.forEach((acc, idx) => {
      if (!existingSecrets.includes(acc.secret)) {
        allIndexes.add(idx);
      }
    });
    setSelectedAccounts(allIndexes);
  };

  const deselectAll = () => {
    setSelectedAccounts(new Set());
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <QrCode className="h-5 w-5" />
          Importar do Google Authenticator
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="qr-upload" className="text-sm text-muted-foreground">
            Faça upload da imagem do QR code exportado do Google Authenticator
          </Label>
          <div className="flex gap-2">
            <input
              ref={fileInputRef}
              id="qr-upload"
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              className="hidden"
            />
            <Button
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              disabled={isProcessing}
              className="flex-1"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processando...
                </>
              ) : (
                <>
                  <Upload className="mr-2 h-4 w-4" />
                  Selecionar imagem do QR Code
                </>
              )}
            </Button>
          </div>
        </div>

        {accounts.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">
                {accounts.length} conta(s) encontrada(s)
              </span>
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" onClick={selectAll}>
                  Selecionar todas
                </Button>
                <Button variant="ghost" size="sm" onClick={deselectAll}>
                  Limpar seleção
                </Button>
              </div>
            </div>

            <div className="max-h-60 overflow-y-auto space-y-2 rounded-md border p-3">
              {accounts.map((account, index) => {
                const alreadyExists = existingSecrets.includes(account.secret);
                return (
                  <div
                    key={index}
                    className={`flex items-center gap-3 p-2 rounded-md ${
                      alreadyExists ? 'bg-muted/50 opacity-60' : 'hover:bg-muted/30'
                    }`}
                  >
                    <Checkbox
                      id={`account-${index}`}
                      checked={selectedAccounts.has(index)}
                      onCheckedChange={() => toggleAccount(index)}
                      disabled={alreadyExists}
                    />
                    <div className="flex-1 min-w-0">
                      <Label
                        htmlFor={`account-${index}`}
                        className={`font-medium cursor-pointer ${alreadyExists ? 'line-through' : ''}`}
                      >
                        {account.issuer || account.name}
                      </Label>
                      {account.issuer && account.name && (
                        <p className="text-xs text-muted-foreground truncate">
                          {account.name}
                        </p>
                      )}
                    </div>
                    {alreadyExists ? (
                      <span className="flex items-center gap-1 text-xs text-amber-600">
                        <AlertCircle className="h-3 w-3" />
                        Já existe
                      </span>
                    ) : (
                      selectedAccounts.has(index) && (
                        <Check className="h-4 w-4 text-green-600" />
                      )
                    )}
                  </div>
                );
              })}
            </div>

            <Button
              onClick={handleImport}
              disabled={selectedAccounts.size === 0 || isImporting}
              className="w-full"
            >
              {isImporting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Importando...
                </>
              ) : (
                <>
                  <Check className="mr-2 h-4 w-4" />
                  Importar {selectedAccounts.size} conta(s)
                </>
              )}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
