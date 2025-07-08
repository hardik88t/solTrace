import { PublicKey, ParsedTransactionWithMeta } from '@solana/web3.js';
import { FundFlow, PROGRAM_IDS } from '../types';

/**
 * Advanced fund flow tracking for token launches
 */
export class FundFlowTracker {

  /**
   * Extract and analyze all fund flows from launch transactions
   */
  extractFundFlows(transactions: ParsedTransactionWithMeta[]): FundFlow[] {
    console.log('💸 Tracking fund flows...');
    
    const fundFlows: FundFlow[] = [];
    
    transactions.forEach(tx => {
      // Extract SOL flows from balance changes
      const solFlows = this.extractSOLFlows(tx);
      fundFlows.push(...solFlows);
      
      // Extract token flows from instructions
      const tokenFlows = this.extractTokenFlows(tx);
      fundFlows.push(...tokenFlows);
    });

    // Sort by timestamp
    fundFlows.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
    
    console.log(`✅ Tracked ${fundFlows.length} fund flows`);
    return fundFlows;
  }

  /**
   * Extract SOL flows from balance changes
   */
  private extractSOLFlows(transaction: ParsedTransactionWithMeta): FundFlow[] {
    const flows: FundFlow[] = [];
    
    if (!transaction.meta?.preBalances || !transaction.meta?.postBalances) {
      return flows;
    }

    const accountKeys = transaction.transaction.message.accountKeys;
    const timestamp = new Date(transaction.blockTime ? transaction.blockTime * 1000 : Date.now());
    const signature = transaction.transaction.signatures[0] || '';

    transaction.meta.preBalances.forEach((preBalance, index) => {
      const postBalance = transaction.meta?.postBalances?.[index] || 0;
      const difference = postBalance - preBalance;
      
      if (difference !== 0 && accountKeys[index]) {
        const account = accountKeys[index].pubkey;
        const amount = Math.abs(difference) / 1e9; // Convert lamports to SOL
        
        if (difference > 0) {
          // Account received SOL
          flows.push({
            from: this.identifySOLSource(transaction, index),
            to: account,
            amount,
            token: 'SOL',
            transactionSignature: signature,
            timestamp,
            purpose: this.identifySOLPurpose(transaction, account, difference, 'received')
          });
        } else {
          // Account sent SOL
          flows.push({
            from: account,
            to: this.identifySOLDestination(transaction, index),
            amount,
            token: 'SOL',
            transactionSignature: signature,
            timestamp,
            purpose: this.identifySOLPurpose(transaction, account, difference, 'sent')
          });
        }
      }
    });

    return flows;
  }

  /**
   * Extract token flows from parsed instructions
   */
  private extractTokenFlows(transaction: ParsedTransactionWithMeta): FundFlow[] {
    const flows: FundFlow[] = [];
    
    if (!transaction.transaction.message.instructions) {
      return flows;
    }

    const timestamp = new Date(transaction.blockTime ? transaction.blockTime * 1000 : Date.now());
    const signature = transaction.transaction.signatures[0] || '';

    transaction.transaction.message.instructions.forEach(instruction => {
      if (instruction.programId.equals(PROGRAM_IDS.TOKEN)) {
        const tokenFlow = this.parseTokenInstruction(instruction, signature, timestamp);
        if (tokenFlow) {
          flows.push(tokenFlow);
        }
      }
    });

    return flows;
  }

  /**
   * Parse token program instructions for fund flows
   */
  private parseTokenInstruction(
    instruction: any,
    signature: string,
    timestamp: Date
  ): FundFlow | null {
    
    if (!instruction.parsed) {
      return null;
    }

    const { type, info } = instruction.parsed;

    switch (type) {
      case 'transfer':
        return {
          from: new PublicKey(info.source),
          to: new PublicKey(info.destination),
          amount: parseFloat(info.amount) || 0,
          token: 'TOKEN',
          transactionSignature: signature,
          timestamp,
          purpose: 'Token Transfer'
        };

      case 'mintTo':
        return {
          from: new PublicKey(info.mint),
          to: new PublicKey(info.account),
          amount: parseFloat(info.amount) || 0,
          token: 'TOKEN',
          transactionSignature: signature,
          timestamp,
          purpose: 'Token Mint'
        };

      case 'burn':
        return {
          from: new PublicKey(info.account),
          to: new PublicKey(info.mint),
          amount: parseFloat(info.amount) || 0,
          token: 'TOKEN',
          transactionSignature: signature,
          timestamp,
          purpose: 'Token Burn'
        };

      default:
        return null;
    }
  }

  /**
   * Identify the source of SOL in a transaction
   */
  private identifySOLSource(transaction: ParsedTransactionWithMeta, _receiverIndex: number): PublicKey {
    // Usually the fee payer (first account) is the source
    const feePayer = transaction.transaction.message.accountKeys[0]?.pubkey;
    if (feePayer) {
      return feePayer;
    }
    
    // Fallback to system program
    return PROGRAM_IDS.SYSTEM;
  }

  /**
   * Identify the destination of SOL in a transaction
   */
  private identifySOLDestination(transaction: ParsedTransactionWithMeta, senderIndex: number): PublicKey {
    // Look for the account that received the most SOL
    let maxIncrease = 0;
    let destination = PROGRAM_IDS.SYSTEM;

    if (transaction.meta?.preBalances && transaction.meta?.postBalances) {
      transaction.meta.preBalances.forEach((preBalance, index) => {
        const postBalance = transaction.meta?.postBalances?.[index] || 0;
        const increase = postBalance - preBalance;
        
        if (increase > maxIncrease && index !== senderIndex) {
          maxIncrease = increase;
          destination = transaction.transaction.message.accountKeys[index]?.pubkey || PROGRAM_IDS.SYSTEM;
        }
      });
    }

    return destination;
  }

  /**
   * Identify the purpose of SOL movement
   */
  private identifySOLPurpose(
    transaction: ParsedTransactionWithMeta,
    _account: PublicKey,
    amount: number,
    direction: 'sent' | 'received'
  ): string {
    
    // Check transaction instructions for context
    const instructions = transaction.transaction.message.instructions || [];
    
    for (const instruction of instructions) {
      if (instruction.programId.equals(PROGRAM_IDS.SYSTEM)) {
        const parsed = (instruction as any).parsed;
        if (parsed?.type === 'createAccount') {
          return direction === 'sent' ? 'Account Creation Cost' : 'Account Creation';
        }
        if (parsed?.type === 'transfer') {
          return direction === 'sent' ? 'SOL Transfer' : 'SOL Received';
        }
      }
      
      if (instruction.programId.equals(PROGRAM_IDS.TOKEN)) {
        return direction === 'sent' ? 'Token Operation Fee' : 'Token Operation';
      }
      
      if (instruction.programId.equals(PROGRAM_IDS.METADATA)) {
        return direction === 'sent' ? 'Metadata Creation Cost' : 'Metadata Creation';
      }
    }

    // Analyze amount to determine purpose
    if (Math.abs(amount) < 0.001) {
      return 'Transaction Fee';
    } else if (Math.abs(amount) < 0.01) {
      return 'Rent Payment';
    } else {
      return direction === 'sent' ? 'Launch Funding' : 'Launch Payment';
    }
  }

  /**
   * Calculate launch cost summary
   */
  calculateLaunchCosts(fundFlows: FundFlow[]): {
    totalSOLCost: number;
    accountCreationCost: number;
    transactionFees: number;
    metadataCost: number;
    breakdown: Array<{ purpose: string; amount: number; count: number }>;
  } {
    
    const solFlows = fundFlows.filter(flow => flow.token === 'SOL');
    const costBreakdown = new Map<string, { amount: number; count: number }>();
    
    let totalSOLCost = 0;
    let accountCreationCost = 0;
    let transactionFees = 0;
    let metadataCost = 0;

    solFlows.forEach(flow => {
      totalSOLCost += flow.amount;
      
      // Categorize costs
      if (flow.purpose.includes('Account Creation')) {
        accountCreationCost += flow.amount;
      } else if (flow.purpose.includes('Transaction Fee')) {
        transactionFees += flow.amount;
      } else if (flow.purpose.includes('Metadata')) {
        metadataCost += flow.amount;
      }

      // Track breakdown
      const existing = costBreakdown.get(flow.purpose) || { amount: 0, count: 0 };
      costBreakdown.set(flow.purpose, {
        amount: existing.amount + flow.amount,
        count: existing.count + 1
      });
    });

    return {
      totalSOLCost,
      accountCreationCost,
      transactionFees,
      metadataCost,
      breakdown: Array.from(costBreakdown.entries()).map(([purpose, data]) => ({
        purpose,
        amount: data.amount,
        count: data.count
      }))
    };
  }

  /**
   * Identify unusual fund flow patterns
   */
  detectAnomalies(fundFlows: FundFlow[]): string[] {
    const anomalies: string[] = [];
    
    // Check for unusually high costs
    const totalSOLCost = fundFlows
      .filter(flow => flow.token === 'SOL')
      .reduce((sum, flow) => sum + flow.amount, 0);
    
    if (totalSOLCost > 1.0) {
      anomalies.push(`High launch cost: ${totalSOLCost.toFixed(4)} SOL`);
    }

    // Check for multiple large token transfers
    const largeTokenTransfers = fundFlows
      .filter(flow => flow.token === 'TOKEN' && flow.amount > 1000000)
      .length;
    
    if (largeTokenTransfers > 5) {
      anomalies.push(`Multiple large token transfers: ${largeTokenTransfers} transfers`);
    }

    // Check for rapid successive transactions
    const timestamps = fundFlows.map(flow => flow.timestamp.getTime()).sort();
    let rapidTransactions = 0;
    
    for (let i = 1; i < timestamps.length; i++) {
      const current = timestamps[i];
      const previous = timestamps[i-1];
      if (current && previous && current - previous < 1000) { // Less than 1 second apart
        rapidTransactions++;
      }
    }
    
    if (rapidTransactions > 3) {
      anomalies.push(`Rapid successive transactions: ${rapidTransactions} within 1 second`);
    }

    return anomalies;
  }
}
