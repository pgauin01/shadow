// src/utils/crypto.js

// 1. Generate a Key from a Password (PBKDF2)
// This ensures the same password always creates the same encryption key
export const deriveKey = async (password, userSalt) => {
  console.log("userSalt", userSalt);

  const enc = new TextEncoder();
  // fallback for legacy users or during dev
  const saltString = userSalt || "shadow-salt-v1";
  const keyMaterial = await window.crypto.subtle.importKey(
    "raw",
    enc.encode(password),
    { name: "PBKDF2" },
    false,
    ["deriveKey"],
  );
  return window.crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: enc.encode(saltString), // 👈 Use the unique salt
      iterations: 600000, // 👈 BUMP THIS UP (OWASP recommends 600k for SHA-256)
      hash: "SHA-256",
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
};

// 2. Encrypt Data (AES-GCM)
export const encryptData = async (text, key) => {
  const enc = new TextEncoder();
  const iv = window.crypto.getRandomValues(new Uint8Array(12)); // Random initialization vector
  const encrypted = await window.crypto.subtle.encrypt(
    { name: "AES-GCM", iv: iv },
    key,
    enc.encode(text),
  );

  // Combine IV + Encrypted Data and convert to Base64 for storage
  const ivArr = Array.from(iv);
  const encArr = Array.from(new Uint8Array(encrypted));
  const combined = new Uint8Array(ivArr.concat(encArr));

  return btoa(String.fromCharCode.apply(null, combined));
};

// 3. Decrypt Data
export const decryptData = async (base64Data, key) => {
  try {
    const combined = new Uint8Array(
      atob(base64Data)
        .split("")
        .map((c) => c.charCodeAt(0)),
    );

    // Extract IV (first 12 bytes) and Data
    const iv = combined.slice(0, 12);
    const data = combined.slice(12);

    const decrypted = await window.crypto.subtle.decrypt(
      { name: "AES-GCM", iv: iv },
      key,
      data,
    );

    const dec = new TextDecoder();
    return dec.decode(decrypted);
  } catch (e) {
    console.error("Decryption failed:", e);
    return "🔒 [Encrypted Content]"; // Fallback if wrong password
  }
};
