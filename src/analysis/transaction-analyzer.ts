import { PublicKey, TransactionSignature, ParsedTransactionWithMeta } from '@solana/web3.js';
import { SolanaConnectionManager } from '../connection/solana-connection';
import { TokenLaunchAnalysis, TransactionPattern, PROGRAM_IDS, AnalysisError } from '../types';
import { SequenceDiagramGenerator } from '../visualization/sequence-diagram';
import { TokenAccountDetector } from './token-account-detector';
import { FundFlowTracker } from './fund-flow-tracker';

/**
 * Core transaction analyzer for Solana token launches
 */
export class TransactionAnalyzer {
  private connectionManager: SolanaConnectionManager;
  private diagramGenerator: SequenceDiagramGenerator;
  private accountDetector: TokenAccountDetector;
  private fundFlowTracker: FundFlowTracker;

  constructor(connectionManager: SolanaConnectionManager) {
    this.connectionManager = connectionManager;
    this.diagramGenerator = new SequenceDiagramGenerator();
    this.accountDetector = new TokenAccountDetector(connectionManager);
    this.fundFlowTracker = new FundFlowTracker();
  }

  /**
   * Analyze a token launch by mint address
   */
  async analyzeTokenLaunch(mintAddress: PublicKey): Promise<TokenLaunchAnalysis> {
    console.log(`🔍 Starting analysis for token: ${mintAddress.toString()}`);

    try {
      // Step 1: Get all transactions for the mint address (limited for testing)
      const signatures = await this.connectionManager.getSignaturesForAddress(mintAddress, {
        limit: 20 // Reduced for testing with public RPC
      });

      console.log(`📋 Found ${signatures.length} transactions for mint address`);

      // Step 2: Fetch and parse transactions
      const transactionSignatures = signatures.map(sig => sig.signature);
      const transactions = await this.connectionManager.getMultipleTransactions(transactionSignatures);
      
      // Filter out null transactions
      const validTransactions = transactions.filter((tx): tx is ParsedTransactionWithMeta => tx !== null);
      
      console.log(`✅ Successfully parsed ${validTransactions.length} transactions`);

      // Step 3: Identify launch-related transactions
      const launchTransactions = this.identifyLaunchTransactions(validTransactions);
      
      // Step 4: Extract token accounts using enhanced detector
      const tokenAccounts = await this.accountDetector.identifyTokenAccounts(launchTransactions, mintAddress);

      // Step 5: Track fund flows using enhanced tracker
      const fundFlows = this.fundFlowTracker.extractFundFlows(launchTransactions);
      
      // Step 6: Extract metadata
      const metadata = await this.extractTokenMetadata(mintAddress, launchTransactions);
      
      // Step 7: Calculate metrics with enhanced analysis
      const launchMetrics = this.calculateLaunchMetrics(launchTransactions, fundFlows);
      
      // Step 8: Generate sequence diagram
      const sequenceDiagram = this.diagramGenerator.generateTokenLaunchDiagram(launchTransactions, tokenAccounts, fundFlows);

      return {
        mintAddress,
        launchTransactions,
        tokenAccounts,
        fundFlows,
        sequenceDiagram,
        metadata,
        launchMetrics
      };

    } catch (error) {
      throw new AnalysisError(
        `Failed to analyze token launch: ${mintAddress.toString()}`,
        'ANALYSIS_FAILED',
        error
      );
    }
  }

  /**
   * Analyze a specific transaction signature
   */
  async analyzeTransaction(signature: TransactionSignature): Promise<TransactionPattern[]> {
    console.log(`🔍 Analyzing transaction: ${signature}`);

    const transaction = await this.connectionManager.getTransaction(signature);
    if (!transaction) {
      throw new AnalysisError(`Transaction not found: ${signature}`, 'TX_NOT_FOUND');
    }

    return this.extractTransactionPatterns(transaction);
  }

  /**
   * Identify transactions related to token launch
   */
  private identifyLaunchTransactions(transactions: ParsedTransactionWithMeta[]): ParsedTransactionWithMeta[] {
    return transactions.filter(tx => {
      if (!tx.transaction.message.instructions) return false;

      // Look for token launch patterns
      const hasTokenProgram = tx.transaction.message.instructions.some(instruction => 
        instruction.programId.equals(PROGRAM_IDS.TOKEN)
      );

      const hasSystemProgram = tx.transaction.message.instructions.some(instruction => 
        instruction.programId.equals(PROGRAM_IDS.SYSTEM)
      );

      const hasMetadataProgram = tx.transaction.message.instructions.some(instruction => 
        instruction.programId.equals(PROGRAM_IDS.METADATA)
      );

      // Token launch typically involves system + token programs, often with metadata
      return hasTokenProgram && (hasSystemProgram || hasMetadataProgram);
    });
  }

  /**
   * Extract transaction patterns for analysis
   */
  private extractTransactionPatterns(transaction: ParsedTransactionWithMeta): TransactionPattern[] {
    const patterns: TransactionPattern[] = [];

    if (!transaction.transaction.message.instructions) {
      return patterns;
    }

    transaction.transaction.message.instructions.forEach((instruction) => {
      const programId = instruction.programId;
      let purpose = 'Unknown';
      let instructionType = 'Unknown';

      // Identify instruction types based on program
      if (programId.equals(PROGRAM_IDS.SYSTEM)) {
        purpose = 'Account Creation/Transfer';
        instructionType = 'System';
      } else if (programId.equals(PROGRAM_IDS.TOKEN)) {
        purpose = 'Token Operation';
        instructionType = 'Token';
      } else if (programId.equals(PROGRAM_IDS.METADATA)) {
        purpose = 'Metadata Setup';
        instructionType = 'Metadata';
      } else if (programId.equals(PROGRAM_IDS.ASSOCIATED_TOKEN)) {
        purpose = 'Associated Token Account';
        instructionType = 'AssociatedToken';
      }

      patterns.push({
        programId,
        instructionType,
        accounts: [], // Simplified for now - will be enhanced later
        data: Buffer.from([]), // Simplified for now
        purpose
      });
    });

    return patterns;
  }

  /**
   * Get launch cost analysis
   */
  getLaunchCostAnalysis(fundFlows: any[]) {
    return this.fundFlowTracker.calculateLaunchCosts(fundFlows);
  }

  /**
   * Detect anomalies in fund flows
   */
  detectFundFlowAnomalies(fundFlows: any[]): string[] {
    return this.fundFlowTracker.detectAnomalies(fundFlows);
  }



  /**
   * Extract token metadata
   */
  private async extractTokenMetadata(mintAddress: PublicKey, _transactions: ParsedTransactionWithMeta[]) {
    // Basic metadata extraction - will be enhanced
    return {
      name: 'Unknown Token',
      symbol: 'UNK',
      description: 'Token metadata extraction in progress',
      decimals: 9,
      supply: 0,
      mintAuthority: mintAddress
    };
  }

  /**
   * Calculate launch metrics with enhanced analysis
   */
  private calculateLaunchMetrics(transactions: ParsedTransactionWithMeta[], fundFlows: any[]) {
    const costAnalysis = this.fundFlowTracker.calculateLaunchCosts(fundFlows);
    const anomalies = this.fundFlowTracker.detectAnomalies(fundFlows);

    // Calculate launch duration
    const timestamps = transactions
      .map(tx => tx.blockTime ? tx.blockTime * 1000 : Date.now())
      .sort();
    const launchDuration = timestamps.length > 1
      ? ((timestamps[timestamps.length - 1] || 0) - (timestamps[0] || 0)) / 1000
      : 0;

    return {
      totalCost: costAnalysis.totalSOLCost,
      transactionCount: transactions.length,
      accountsCreated: costAnalysis.breakdown.filter(b => b.purpose.includes('Account Creation')).length,
      initialDistribution: fundFlows.filter(f => f.token === 'TOKEN').length,
      launchDuration,
      success: transactions.length > 0 && costAnalysis.totalSOLCost < 10, // Reasonable cost threshold
      anomalies
    };
  }

  /**
   * Generate transaction flow diagram for a single transaction
   */
  generateTransactionDiagram(signature: TransactionSignature): Promise<string> {
    return this.connectionManager.getTransaction(signature).then(transaction => {
      if (!transaction) {
        throw new AnalysisError(`Transaction not found: ${signature}`, 'TX_NOT_FOUND');
      }
      return this.diagramGenerator.generateTransactionFlowDiagram(transaction);
    });
  }

  /**
   * Generate interactive HTML diagram
   */
  generateInteractiveDiagram(mermaidCode: string, title: string): string {
    return this.diagramGenerator.generateInteractiveDiagram(mermaidCode, title);
  }
}
