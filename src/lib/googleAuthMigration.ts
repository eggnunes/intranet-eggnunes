// Google Authenticator Migration Format Decoder
// Decodes otpauth-migration:// URLs containing multiple TOTP accounts

const base32Chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

function bytesToBase32(bytes: Uint8Array): string {
  let bits = '';
  for (const byte of bytes) {
    bits += byte.toString(2).padStart(8, '0');
  }
  
  let result = '';
  for (let i = 0; i < bits.length; i += 5) {
    const chunk = bits.slice(i, i + 5).padEnd(5, '0');
    result += base32Chars[parseInt(chunk, 2)];
  }
  
  return result;
}

interface OtpAccount {
  name: string;
  issuer: string;
  secret: string;
  algorithm: 'SHA1' | 'SHA256' | 'SHA512' | 'MD5';
  digits: number;
  type: 'TOTP' | 'HOTP';
}

// Simple protobuf decoder for Google Authenticator migration format
function decodeVarint(data: Uint8Array, offset: number): [number, number] {
  let result = 0;
  let shift = 0;
  let currentOffset = offset;
  
  while (currentOffset < data.length) {
    const byte = data[currentOffset];
    result |= (byte & 0x7f) << shift;
    currentOffset++;
    if ((byte & 0x80) === 0) {
      break;
    }
    shift += 7;
  }
  
  return [result, currentOffset];
}

function decodeOtpParameters(data: Uint8Array): OtpAccount {
  let offset = 0;
  let secret: Uint8Array = new Uint8Array();
  let name = '';
  let issuer = '';
  let algorithm: OtpAccount['algorithm'] = 'SHA1';
  let digits = 6;
  let type: OtpAccount['type'] = 'TOTP';
  
  const algorithmMap: Record<number, OtpAccount['algorithm']> = {
    0: 'SHA1',
    1: 'SHA1',
    2: 'SHA256',
    3: 'SHA512',
    4: 'MD5'
  };
  
  const digitsMap: Record<number, number> = {
    0: 6,
    1: 6,
    2: 8
  };
  
  while (offset < data.length) {
    const [tag, newOffset] = decodeVarint(data, offset);
    offset = newOffset;
    
    const fieldNumber = tag >> 3;
    const wireType = tag & 0x7;
    
    if (wireType === 0) {
      // Varint
      const [value, nextOffset] = decodeVarint(data, offset);
      offset = nextOffset;
      
      if (fieldNumber === 4) {
        algorithm = algorithmMap[value] || 'SHA1';
      } else if (fieldNumber === 5) {
        digits = digitsMap[value] || 6;
      } else if (fieldNumber === 6) {
        type = value === 1 ? 'HOTP' : 'TOTP';
      }
    } else if (wireType === 2) {
      // Length-delimited
      const [length, nextOffset] = decodeVarint(data, offset);
      offset = nextOffset;
      const fieldData = data.slice(offset, offset + length);
      offset += length;
      
      if (fieldNumber === 1) {
        secret = fieldData;
      } else if (fieldNumber === 2) {
        name = new TextDecoder().decode(fieldData);
      } else if (fieldNumber === 3) {
        issuer = new TextDecoder().decode(fieldData);
      }
    }
  }
  
  return {
    name,
    issuer,
    secret: bytesToBase32(secret),
    algorithm,
    digits,
    type
  };
}

function decodeMigrationPayload(data: Uint8Array): OtpAccount[] {
  const accounts: OtpAccount[] = [];
  let offset = 0;
  
  while (offset < data.length) {
    const [tag, newOffset] = decodeVarint(data, offset);
    offset = newOffset;
    
    const fieldNumber = tag >> 3;
    const wireType = tag & 0x7;
    
    if (wireType === 2 && fieldNumber === 1) {
      // otp_parameters field
      const [length, nextOffset] = decodeVarint(data, offset);
      offset = nextOffset;
      const fieldData = data.slice(offset, offset + length);
      offset += length;
      
      try {
        const account = decodeOtpParameters(fieldData);
        if (account.secret) {
          accounts.push(account);
        }
      } catch (e) {
        console.error('Error decoding OTP parameters:', e);
      }
    } else if (wireType === 0) {
      // Skip varint fields
      const [, nextOffset] = decodeVarint(data, offset);
      offset = nextOffset;
    } else if (wireType === 2) {
      // Skip other length-delimited fields
      const [length, nextOffset] = decodeVarint(data, offset);
      offset = nextOffset + length;
    }
  }
  
  return accounts;
}

export function decodeMigrationUrl(url: string): OtpAccount[] {
  // Parse the URL
  const match = url.match(/otpauth-migration:\/\/offline\?data=(.+)/);
  if (!match) {
    throw new Error('Invalid migration URL format');
  }
  
  // Decode base64 (URL-safe)
  const base64Data = decodeURIComponent(match[1]);
  const binaryString = atob(base64Data.replace(/-/g, '+').replace(/_/g, '/'));
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  
  return decodeMigrationPayload(bytes);
}

export function decodeStandardOtpauthUrl(url: string): OtpAccount | null {
  // Parse standard otpauth://totp/... URLs
  const match = url.match(/otpauth:\/\/(totp|hotp)\/([^?]+)\?(.+)/);
  if (!match) {
    return null;
  }
  
  const type = match[1].toUpperCase() as 'TOTP' | 'HOTP';
  const label = decodeURIComponent(match[2]);
  const params = new URLSearchParams(match[3]);
  
  const secret = params.get('secret');
  if (!secret) {
    return null;
  }
  
  // Parse label for issuer and name
  let issuer = params.get('issuer') || '';
  let name = label;
  
  if (label.includes(':')) {
    const parts = label.split(':');
    if (!issuer) {
      issuer = parts[0];
    }
    name = parts[1] || parts[0];
  }
  
  const algorithmParam = params.get('algorithm')?.toUpperCase();
  let algorithm: OtpAccount['algorithm'] = 'SHA1';
  if (algorithmParam === 'SHA256') algorithm = 'SHA256';
  else if (algorithmParam === 'SHA512') algorithm = 'SHA512';
  else if (algorithmParam === 'MD5') algorithm = 'MD5';
  
  const digits = parseInt(params.get('digits') || '6', 10);
  
  return {
    name,
    issuer,
    secret: secret.toUpperCase().replace(/\s/g, ''),
    algorithm,
    digits,
    type
  };
}

export type { OtpAccount };
