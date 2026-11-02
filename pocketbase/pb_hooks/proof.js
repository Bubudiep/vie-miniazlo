import crypto from "crypto";

// server-side: Tạo appsecret_proof
export function getAppSecretProof(accessToken, appSecret) {
  return crypto
    .createHmac("sha256", appSecret)
    .update(accessToken)
    .digest("hex");
}
