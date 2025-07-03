// Script to decode proxy links

// First link (BÀI GIẢNG)
const link1 = 'aHR0cHM6Ly93d3cuZ29vZ2xlLmNvbS91cmw_cT1odHRwczovL3lvdXR1LmJlL0xPTUxYb3RNb1g4JnNhPUQmc291cmNlPWVkaXRvcnMmdXN0PTE3NTEyMTc0OTczNDI5NTcmdXNnPUFPdlZhdzBnMFMxN0RnV2VjR2RwNUNLMFZpdUw';

// Second link (TÀI LIỆU)
const link2 = 'aHR0cHM6Ly9kcml2ZS5nb29nbGUuY29tL29wZW4_aWQ9MWpIU0ZwUjc0Zkt0X0pnQTFlNlBzRWZxanFTb3Y3TGps';

// Normalize base64 (replace URL-safe characters)
const normalizeBase64 = (base64) => {
  return base64
    .replace(/-/g, '+')  // Replace - with +
    .replace(/_/g, '/'); // Replace _ with /
};

// Decode function
const decodeProxyLink = (base64) => {
  try {
    const normalizedBase64 = normalizeBase64(base64);
    const decoded = Buffer.from(normalizedBase64, 'base64').toString('utf-8');
    return decoded;
  } catch (error) {
    console.error('Error decoding:', error);
    return null;
  }
};

// Decode and print results
console.log('Decoded BÀI GIẢNG link:');
console.log(decodeProxyLink(link1));
console.log('\nDecoded TÀI LIỆU link:');
console.log(decodeProxyLink(link2)); 