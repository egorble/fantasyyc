import { ethers } from 'ethers';

/**
 * Create a signed auth payload for API requests.
 * Message format: "fantasyyc:<address>:<timestamp>"
 * The backend verifies the signature to prove wallet ownership.
 */
export async function createSignedAuth(
    signer: ethers.Signer,
    address: string
): Promise<{ message: string; signature: string }> {
    const timestamp = Math.floor(Date.now() / 1000);
    const message = `fantasyyc:${address.toLowerCase()}:${timestamp}`;
    const signature = await signer.signMessage(message);
    return { message, signature };
}
