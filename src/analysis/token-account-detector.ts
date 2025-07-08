import { PublicKey, ParsedTransactionWithMeta } from '@solana/web3.js';
import { SolanaConnectionManager } from '../connection/solana-connection';
import { TokenAccountInfo, PROGRAM_IDS } from '../types';

/**
 * Advanced token account detection and classification system
 */
export class TokenAccountDetector {
  private connectionManager: SolanaConnectionManager;

  constructor(connectionManager: SolanaConnectionManager) {
    this.connectionManager = connectionManager;
  }

  /**
   * Identify and classify all token accounts involved in launch transactions
   */
  async identifyTokenAccounts(
    transactions: ParsedTransactionWithMeta[],
    mintAddress: PublicKey
  ): Promise<TokenAccountInfo[]> {
    console.log('🔍 Identifying token accounts...');
    
    const accountMap = new Map<string, TokenAccountInfo>();
    
    // Process each transaction to identify accounts
    for (const tx of transactions) {
      await this.processTransactionAccounts(tx, mintAddress, accountMap);
    }

    const accounts = Array.from(accountMap.values());
    console.log(`✅ Identified ${accounts.length} token accounts`);
    
    return accounts;
  }

  /**
   * Process a single transaction to identify accounts
   */
  private async processTransactionAccounts(
    transaction: ParsedTransactionWithMeta,
    mintAddress: PublicKey,
    accountMap: Map<string, TokenAccountInfo>
  ): Promise<void> {
    
    // Process account keys
    transaction.transaction.message.accountKeys.forEach((accountKey, index) => {
      const address = accountKey.pubkey;
      const addressStr = address.toString();
      
      if (!accountMap.has(addressStr)) {
        // Determine account type based on transaction context
        const accountType = this.determineAccountType(transaction, address, mintAddress, index);
        const role = this.determineAccountRole(transaction, address, mintAddress);
        
        accountMap.set(addressStr, {
          address,
          owner: this.getAccountOwner(transaction, address, index),
          mint: mintAddress,
          balance: this.getAccountBalance(transaction, index),
          accountType,
          createdAt: new Date(transaction.blockTime ? transaction.blockTime * 1000 : Date.now()),
          role
        });
      }
    });

    // Process instructions for more context
    if (transaction.transaction.message.instructions) {
      transaction.transaction.message.instructions.forEach(instruction => {
        this.processInstructionAccounts(instruction, mintAddress, accountMap, transaction);
      });
    }
  }

  /**
   * Determine the type of account based on transaction context
   */
  private determineAccountType(
    transaction: ParsedTransactionWithMeta,
    address: PublicKey,
    mintAddress: PublicKey,
    accountIndex: number
  ): TokenAccountInfo['accountType'] {
    
    // Check if this is the mint address
    if (address.equals(mintAddress)) {
      return 'mint';
    }

    // Check if account was created by specific programs
    const instructions = transaction.transaction.message.instructions || [];
    
    for (const instruction of instructions) {
      // Check for metadata program interactions
      if (instruction.programId.equals(PROGRAM_IDS.METADATA)) {
        // If this account is involved in metadata instruction, likely metadata account
        if (this.isAccountInInstruction(instruction, address)) {
          return 'metadata';
        }
      }
      
      // Check for associated token program
      if (instruction.programId.equals(PROGRAM_IDS.ASSOCIATED_TOKEN)) {
        if (this.isAccountInInstruction(instruction, address)) {
          return 'associated';
        }
      }
      
      // Check for token program authority operations
      if (instruction.programId.equals(PROGRAM_IDS.TOKEN)) {
        if (this.isAccountInInstruction(instruction, address) && accountIndex === 0) {
          return 'authority';
        }
      }
    }

    return 'unknown';
  }

  /**
   * Determine the role of an account in the token launch
   */
  private determineAccountRole(
    transaction: ParsedTransactionWithMeta,
    address: PublicKey,
    mintAddress: PublicKey
  ): string {
    
    if (address.equals(mintAddress)) {
      return 'Token Mint';
    }

    // Check if it's the fee payer (usually the creator)
    if (transaction.transaction.message.accountKeys[0]?.pubkey.equals(address)) {
      return 'Token Creator';
    }

    // Check for system program (rent, account creation)
    if (address.equals(PROGRAM_IDS.SYSTEM)) {
      return 'System Program';
    }

    // Check for token program
    if (address.equals(PROGRAM_IDS.TOKEN)) {
      return 'Token Program';
    }

    // Check for metadata program
    if (address.equals(PROGRAM_IDS.METADATA)) {
      return 'Metadata Program';
    }

    // Check balance changes to identify recipients
    const accountIndex = transaction.transaction.message.accountKeys.findIndex(
      key => key.pubkey.equals(address)
    );
    
    if (accountIndex !== -1 && transaction.meta?.preBalances && transaction.meta?.postBalances) {
      const preBalance = transaction.meta.preBalances[accountIndex] || 0;
      const postBalance = transaction.meta.postBalances[accountIndex] || 0;
      
      if (postBalance > preBalance) {
        return 'Token Recipient';
      } else if (preBalance > postBalance) {
        return 'Fund Provider';
      }
    }

    return 'Participant';
  }

  /**
   * Get account owner from transaction context
   */
  private getAccountOwner(
    transaction: ParsedTransactionWithMeta,
    address: PublicKey,
    _accountIndex: number
  ): PublicKey {
    // For now, return the fee payer as owner for most accounts
    // This can be enhanced with actual account info fetching
    return transaction.transaction.message.accountKeys[0]?.pubkey || address;
  }

  /**
   * Get account balance from transaction
   */
  private getAccountBalance(transaction: ParsedTransactionWithMeta, accountIndex: number): number {
    if (transaction.meta?.postBalances && transaction.meta.postBalances[accountIndex]) {
      return transaction.meta.postBalances[accountIndex] / 1e9; // Convert lamports to SOL
    }
    return 0;
  }

  /**
   * Check if an account is involved in an instruction
   */
  private isAccountInInstruction(instruction: any, address: PublicKey): boolean {
    // Check if address is in instruction accounts
    if (instruction.accounts) {
      return instruction.accounts.some((acc: PublicKey) => acc.equals(address));
    }
    
    // For parsed instructions, check different structures
    if (instruction.parsed?.info) {
      const info = instruction.parsed.info;
      return Object.values(info).some(value => 
        typeof value === 'string' && value === address.toString()
      );
    }
    
    return false;
  }

  /**
   * Process instruction-specific account information
   */
  private processInstructionAccounts(
    instruction: any,
    _mintAddress: PublicKey,
    accountMap: Map<string, TokenAccountInfo>,
    _transaction: ParsedTransactionWithMeta
  ): void {
    
    // Enhanced processing based on instruction type
    if (instruction.programId.equals(PROGRAM_IDS.TOKEN)) {
      this.processTokenInstruction(instruction, _mintAddress, accountMap, _transaction);
    } else if (instruction.programId.equals(PROGRAM_IDS.METADATA)) {
      this.processMetadataInstruction(instruction, _mintAddress, accountMap, _transaction);
    } else if (instruction.programId.equals(PROGRAM_IDS.SYSTEM)) {
      this.processSystemInstruction(instruction, _mintAddress, accountMap, _transaction);
    }
  }

  /**
   * Process token program instructions
   */
  private processTokenInstruction(
    instruction: any,
    _mintAddress: PublicKey,
    accountMap: Map<string, TokenAccountInfo>,
    _transaction: ParsedTransactionWithMeta
  ): void {
    
    if (instruction.parsed?.type === 'initializeMint') {
      // This confirms the mint account
      const mint = instruction.parsed.info?.mint;
      if (mint && accountMap.has(mint)) {
        const account = accountMap.get(mint)!;
        account.accountType = 'mint';
        account.role = 'Token Mint';
      }
    }
    
    if (instruction.parsed?.type === 'mintTo') {
      // Identify token recipients
      const destination = instruction.parsed.info?.account;
      if (destination && accountMap.has(destination)) {
        const account = accountMap.get(destination)!;
        account.role = 'Initial Token Recipient';
      }
    }
  }

  /**
   * Process metadata program instructions
   */
  private processMetadataInstruction(
    instruction: any,
    mintAddress: PublicKey,
    accountMap: Map<string, TokenAccountInfo>,
    _transaction: ParsedTransactionWithMeta
  ): void {
    
    // Metadata instructions help identify metadata accounts
    if (instruction.parsed?.info?.mint === mintAddress.toString()) {
      const metadataAccount = instruction.parsed.info?.metadata;
      if (metadataAccount && accountMap.has(metadataAccount)) {
        const account = accountMap.get(metadataAccount)!;
        account.accountType = 'metadata';
        account.role = 'Token Metadata';
      }
    }
  }

  /**
   * Process system program instructions
   */
  private processSystemInstruction(
    instruction: any,
    _mintAddress: PublicKey,
    accountMap: Map<string, TokenAccountInfo>,
    _transaction: ParsedTransactionWithMeta
  ): void {
    
    if (instruction.parsed?.type === 'createAccount') {
      const newAccount = instruction.parsed.info?.newAccount;
      if (newAccount && accountMap.has(newAccount)) {
        const account = accountMap.get(newAccount)!;
        account.role = 'Created Account';
      }
    }
  }

  /**
   * Get detailed account information from RPC
   */
  async getDetailedAccountInfo(address: PublicKey): Promise<any> {
    try {
      return await this.connectionManager.getParsedAccountInfo(address);
    } catch (error) {
      console.warn(`⚠️  Could not fetch detailed info for ${address.toString()}`);
      return null;
    }
  }
}
