import { PublicKey } from '@solana/web3.js';
import { SolanaConnectionManager } from './connection/solana-connection';
import { TransactionAnalyzer } from './analysis/transaction-analyzer';

/**
 * Main entry point for Solana Token Launch Analysis
 */
async function main() {
  console.log('🚀 Solana Token Launch Analysis Tool');
  console.log('=====================================');

  try {
    // Initialize connection manager
    const connectionManager = new SolanaConnectionManager();
    
    // Health check
    const isHealthy = await connectionManager.healthCheck();
    if (!isHealthy) {
      console.error('❌ RPC connection failed. Please check your internet connection.');
      process.exit(1);
    }

    // Initialize analyzer
    const analyzer = new TransactionAnalyzer(connectionManager);

    // Example analysis - you can replace this with a real token mint address
    const exampleMintAddress = new PublicKey('So11111111111111111111111111111111111111112'); // Wrapped SOL for testing
    
    console.log('\n📊 Starting sample analysis...');
    console.log(`Token: ${exampleMintAddress.toString()}`);

    const analysis = await analyzer.analyzeTokenLaunch(exampleMintAddress);

    // Display results
    console.log('\n✅ Analysis Complete!');
    console.log('====================');
    console.log(`📈 Transactions analyzed: ${analysis.launchTransactions.length}`);
    console.log(`💰 Total launch cost: ${analysis.launchMetrics.totalCost.toFixed(4)} SOL`);
    console.log(`🏦 Accounts involved: ${analysis.tokenAccounts.length}`);
    console.log(`💸 Fund flows tracked: ${analysis.fundFlows.length}`);
    console.log(`📊 Launch success: ${analysis.launchMetrics.success ? '✅' : '❌'}`);

    console.log('\n🎨 Sequence Diagram:');
    console.log(analysis.sequenceDiagram);

    console.log('\n📋 Recent Fund Flows:');
    analysis.fundFlows.slice(0, 5).forEach((flow, index) => {
      console.log(`${index + 1}. ${flow.amount.toFixed(4)} ${flow.token} - ${flow.purpose}`);
    });

    console.log('\n🎯 Next Steps:');
    console.log('- Use CLI: npm run analyze <mint-address>');
    console.log('- Generate diagram: npm run diagram <transaction-signature>');
    console.log('- Start web interface: npm run dev');

  } catch (error) {
    console.error('❌ Analysis failed:', error);
    process.exit(1);
  }
}

// Run if this file is executed directly
if (require.main === module) {
  main().catch(console.error);
}

export { SolanaConnectionManager, TransactionAnalyzer };
