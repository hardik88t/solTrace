import { Connection, PublicKey, TransactionSignature, ParsedTransactionWithMeta } from '@solana/web3.js';
import { RpcError } from '../types';

/**
 * Solana connection manager with rate limiting and error handling
 */
export class SolanaConnectionManager {
  private connection: Connection;
  private requestQueue: Array<() => Promise<any>> = [];
  private isProcessing = false;
  private readonly maxRequestsPerSecond = 10; // Very conservative limit for public RPC
  private lastRequestTime = 0;

  constructor(rpcEndpoint: string = 'https://api.mainnet-beta.solana.com') {
    this.connection = new Connection(rpcEndpoint, 'confirmed');
    console.log(`🔗 Connected to Solana RPC: ${rpcEndpoint}`);
  }

  /**
   * Get connection instance
   */
  getConnection(): Connection {
    return this.connection;
  }

  /**
   * Rate-limited request wrapper
   */
  private async executeWithRateLimit<T>(request: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.requestQueue.push(async () => {
        try {
          const result = await request();
          resolve(result);
        } catch (error) {
          reject(error);
        }
      });

      this.processQueue();
    });
  }

  /**
   * Process request queue with rate limiting
   */
  private async processQueue(): Promise<void> {
    if (this.isProcessing || this.requestQueue.length === 0) {
      return;
    }

    this.isProcessing = true;

    while (this.requestQueue.length > 0) {
      const now = Date.now();
      const timeSinceLastRequest = now - this.lastRequestTime;
      const minInterval = 1000 / this.maxRequestsPerSecond;

      if (timeSinceLastRequest < minInterval) {
        await new Promise(resolve => setTimeout(resolve, minInterval - timeSinceLastRequest));
      }

      const request = this.requestQueue.shift();
      if (request) {
        this.lastRequestTime = Date.now();
        await request();
      }
    }

    this.isProcessing = false;
  }

  /**
   * Fetch transaction with error handling and retries
   */
  async getTransaction(signature: TransactionSignature, config?: any): Promise<ParsedTransactionWithMeta | null> {
    return this.executeWithRateLimit(async () => {
      try {
        const transaction = await this.connection.getParsedTransaction(signature, {
          maxSupportedTransactionVersion: 0,
          ...config
        });
        
        if (!transaction) {
          console.warn(`⚠️  Transaction not found: ${signature}`);
          return null;
        }

        return transaction;
      } catch (error) {
        throw new RpcError(
          `Failed to fetch transaction: ${signature}`,
          this.connection.rpcEndpoint,
          error
        );
      }
    });
  }

  /**
   * Get account information
   */
  async getAccountInfo(publicKey: PublicKey) {
    return this.executeWithRateLimit(async () => {
      try {
        return await this.connection.getAccountInfo(publicKey);
      } catch (error) {
        throw new RpcError(
          `Failed to fetch account info: ${publicKey.toString()}`,
          this.connection.rpcEndpoint,
          error
        );
      }
    });
  }

  /**
   * Get parsed account information
   */
  async getParsedAccountInfo(publicKey: PublicKey) {
    return this.executeWithRateLimit(async () => {
      try {
        return await this.connection.getParsedAccountInfo(publicKey);
      } catch (error) {
        throw new RpcError(
          `Failed to fetch parsed account info: ${publicKey.toString()}`,
          this.connection.rpcEndpoint,
          error
        );
      }
    });
  }

  /**
   * Get signatures for address with pagination
   */
  async getSignaturesForAddress(address: PublicKey, options?: {
    limit?: number;
    before?: TransactionSignature;
    until?: TransactionSignature;
  }) {
    return this.executeWithRateLimit(async () => {
      try {
        const config: any = {
          limit: options?.limit || 100
        };
        if (options?.before) config.before = options.before;
        if (options?.until) config.until = options.until;

        return await this.connection.getSignaturesForAddress(address, config);
      } catch (error) {
        throw new RpcError(
          `Failed to fetch signatures for address: ${address.toString()}`,
          this.connection.rpcEndpoint,
          error
        );
      }
    });
  }

  /**
   * Batch fetch multiple transactions
   */
  async getMultipleTransactions(signatures: TransactionSignature[]): Promise<(ParsedTransactionWithMeta | null)[]> {
    console.log(`📦 Fetching ${signatures.length} transactions...`);
    
    const results: (ParsedTransactionWithMeta | null)[] = [];
    
    // Process in batches to avoid overwhelming the RPC
    const batchSize = 3; // Very small batches for public RPC
    for (let i = 0; i < signatures.length; i += batchSize) {
      const batch = signatures.slice(i, i + batchSize);
      const batchPromises = batch.map(sig => this.getTransaction(sig));
      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);
      
      console.log(`✅ Processed batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(signatures.length / batchSize)}`);

      // Add extra delay between batches for public RPC
      if (i + batchSize < signatures.length) {
        await new Promise(resolve => setTimeout(resolve, 2000)); // 2 second delay between batches
      }
    }

    return results;
  }

  /**
   * Health check for RPC connection
   */
  async healthCheck(): Promise<boolean> {
    try {
      const slot = await this.connection.getSlot();
      console.log(`🏥 RPC Health Check: Current slot ${slot}`);
      return true;
    } catch (error) {
      console.error('❌ RPC Health Check failed:', error);
      return false;
    }
  }
}
