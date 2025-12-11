// TOTP (Time-based One-Time Password) implementation
// Based on RFC 6238

const base32Chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

function base32Decode(input: string): Uint8Array {
  // Remove spaces and convert to uppercase
  const sanitized = input.replace(/\s/g, '').toUpperCase();
  
  let bits = '';
  for (const char of sanitized) {
    const index = base32Chars.indexOf(char);
    if (index === -1) continue; // Skip invalid characters
    bits += index.toString(2).padStart(5, '0');
  }
  
  const bytes = new Uint8Array(Math.floor(bits.length / 8));
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(bits.slice(i * 8, i * 8 + 8), 2);
  }
  
  return bytes;
}

async function hmacSha1(key: Uint8Array, message: Uint8Array): Promise<Uint8Array> {
  const keyBuffer = key.buffer.slice(key.byteOffset, key.byteOffset + key.byteLength) as ArrayBuffer;
  const messageBuffer = message.buffer.slice(message.byteOffset, message.byteOffset + message.byteLength) as ArrayBuffer;
  
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyBuffer,
    { name: 'HMAC', hash: 'SHA-1' },
    false,
    ['sign']
  );
  
  const signature = await crypto.subtle.sign('HMAC', cryptoKey, messageBuffer);
  return new Uint8Array(signature);
}

function intToBytes(num: number): Uint8Array {
  const bytes = new Uint8Array(8);
  for (let i = 7; i >= 0; i--) {
    bytes[i] = num & 0xff;
    num = Math.floor(num / 256);
  }
  return bytes;
}

export async function generateTOTP(secret: string, digits: number = 6, period: number = 30): Promise<string> {
  try {
    const key = base32Decode(secret);
    const counter = Math.floor(Date.now() / 1000 / period);
    const counterBytes = intToBytes(counter);
    
    const hmac = await hmacSha1(key, counterBytes);
    
    // Dynamic truncation
    const offset = hmac[19] & 0x0f;
    const binary = 
      ((hmac[offset] & 0x7f) << 24) |
      ((hmac[offset + 1] & 0xff) << 16) |
      ((hmac[offset + 2] & 0xff) << 8) |
      (hmac[offset + 3] & 0xff);
    
    const otp = binary % Math.pow(10, digits);
    return otp.toString().padStart(digits, '0');
  } catch (error) {
    console.error('Error generating TOTP:', error);
    return '------';
  }
}

export function getTimeRemaining(period: number = 30): number {
  return period - (Math.floor(Date.now() / 1000) % period);
}

export function validateSecretKey(secret: string): boolean {
  const sanitized = secret.replace(/\s/g, '').toUpperCase();
  if (sanitized.length < 16) return false;
  
  for (const char of sanitized) {
    if (!base32Chars.includes(char)) return false;
  }
  
  return true;
}
