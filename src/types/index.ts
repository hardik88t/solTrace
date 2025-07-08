import { PublicKey, TransactionSignature, ParsedTransactionWithMeta } from '@solana/web3.js';

/**
 * Core types for Solana token launch analysis
 */

export interface TokenLaunchAnalysis {
  mintAddress: PublicKey;
  launchTransactions: ParsedTransactionWithMeta[];
  tokenAccounts: TokenAccountInfo[];
  fundFlows: FundFlow[];
  sequenceDiagram: string;
  metadata: TokenMetadata;
  launchMetrics: LaunchMetrics;
}

export interface TokenAccountInfo {
  address: PublicKey;
  owner: PublicKey;
  mint: PublicKey;
  balance: number;
  accountType: 'mint' | 'associated' | 'metadata' | 'authority' | 'unknown';
  createdAt: Date;
  role: string;
}

export interface FundFlow {
  from: PublicKey;
  to: PublicKey;
  amount: number;
  token: 'SOL' | 'TOKEN';
  transactionSignature: TransactionSignature;
  timestamp: Date;
  purpose: string;
}

export interface TokenMetadata {
  name?: string;
  symbol?: string;
  description?: string;
  image?: string;
  decimals: number;
  supply: number;
  mintAuthority?: PublicKey;
  freezeAuthority?: PublicKey;
}

export interface LaunchMetrics {
  totalCost: number; // in SOL
  transactionCount: number;
  accountsCreated: number;
  initialDistribution: number;
  launchDuration: number; // in seconds
  success: boolean;
  anomalies: string[];
}

export interface TransactionPattern {
  programId: PublicKey;
  instructionType: string;
  accounts: PublicKey[];
  data: Buffer;
  purpose: string;
}

export interface AnalysisConfig {
  rpcEndpoint: string;
  maxTransactions: number;
  includeFailedTx: boolean;
  timeRange: {
    start?: Date;
    end?: Date;
  };
}

export interface SequenceDiagramNode {
  id: string;
  label: string;
  type: 'account' | 'program' | 'instruction';
}

export interface SequenceDiagramEdge {
  from: string;
  to: string;
  label: string;
  amount?: number;
  timestamp: Date;
}

// Common Solana program IDs
export const PROGRAM_IDS = {
  SYSTEM: new PublicKey('11111111111111111111111111111112'),
  TOKEN: new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'),
  METADATA: new PublicKey('metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s'),
  ASSOCIATED_TOKEN: new PublicKey('ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL'),
} as const;

// Error types
export class AnalysisError extends Error {
  constructor(message: string, public code: string, public details?: any) {
    super(message);
    this.name = 'AnalysisError';
  }
}

export class RpcError extends Error {
  constructor(message: string, public endpoint: string, public details?: any) {
    super(message);
    this.name = 'RpcError';
  }
}
