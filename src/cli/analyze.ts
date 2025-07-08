#!/usr/bin/env node

import { PublicKey } from '@solana/web3.js';
import { SolanaConnectionManager } from '../connection/solana-connection';
import { TransactionAnalyzer } from '../analysis/transaction-analyzer';

/**
 * CLI tool for analyzing token launches
 * Usage: npm run analyze <mint-address>
 */
async function analyzeCLI() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.log('🔍 Solana Token Launch Analyzer');
    console.log('===============================');
    console.log('Usage: npm run analyze <mint-address>');
    console.log('');
    console.log('Example:');
    console.log('  npm run analyze So11111111111111111111111111111111111111112');
    console.log('');
    console.log('Options:');
    console.log('  --devnet    Use devnet instead of mainnet');
    console.log('  --help      Show this help message');
    process.exit(0);
  }

  const mintAddressStr = args[0];
  const useDevnet = args.includes('--devnet');

  if (args.includes('--help')) {
    console.log('🔍 Solana Token Launch Analyzer');
    console.log('===============================');
    console.log('Analyzes Solana token launches and generates sequence diagrams');
    console.log('');
    console.log('Usage: npm run analyze <mint-address> [options]');
    console.log('');
    console.log('Arguments:');
    console.log('  mint-address    The token mint address to analyze');
    console.log('');
    console.log('Options:');
    console.log('  --devnet       Use Solana devnet instead of mainnet');
    console.log('  --help         Show this help message');
    process.exit(0);
  }

  try {
    // Validate mint address
    if (!mintAddressStr) {
      throw new Error('Mint address is required');
    }
    const mintAddress = new PublicKey(mintAddressStr);
    
    console.log('🚀 Starting Token Launch Analysis');
    console.log('=================================');
    console.log(`📍 Mint Address: ${mintAddress.toString()}`);
    console.log(`🌐 Network: ${useDevnet ? 'Devnet' : 'Mainnet'}`);
    console.log('');

    // Initialize connection
    const rpcEndpoint = useDevnet 
      ? 'https://api.devnet.solana.com'
      : 'https://api.mainnet-beta.solana.com';
    
    const connectionManager = new SolanaConnectionManager(rpcEndpoint);
    
    // Health check
    console.log('🏥 Checking RPC connection...');
    const isHealthy = await connectionManager.healthCheck();
    if (!isHealthy) {
      console.error('❌ RPC connection failed. Please check your internet connection.');
      process.exit(1);
    }

    // Initialize analyzer
    const analyzer = new TransactionAnalyzer(connectionManager);

    // Perform analysis
    console.log('🔍 Analyzing token launch...');
    const startTime = Date.now();
    
    const analysis = await analyzer.analyzeTokenLaunch(mintAddress);
    
    const analysisTime = (Date.now() - startTime) / 1000;

    // Display results
    console.log('\n✅ Analysis Complete!');
    console.log('====================');
    console.log(`⏱️  Analysis time: ${analysisTime.toFixed(2)}s`);
    console.log(`📈 Transactions analyzed: ${analysis.launchTransactions.length}`);
    console.log(`💰 Total launch cost: ${analysis.launchMetrics.totalCost.toFixed(4)} SOL`);
    console.log(`🏦 Accounts involved: ${analysis.tokenAccounts.length}`);
    console.log(`💸 Fund flows tracked: ${analysis.fundFlows.length}`);
    console.log(`📊 Launch success: ${analysis.launchMetrics.success ? '✅' : '❌'}`);

    // Token metadata
    console.log('\n📋 Token Information:');
    console.log(`Name: ${analysis.metadata.name || 'Unknown'}`);
    console.log(`Symbol: ${analysis.metadata.symbol || 'Unknown'}`);
    console.log(`Decimals: ${analysis.metadata.decimals}`);
    console.log(`Supply: ${analysis.metadata.supply}`);

    // Fund flows
    if (analysis.fundFlows.length > 0) {
      console.log('\n💸 Recent Fund Flows:');
      analysis.fundFlows.slice(0, 10).forEach((flow, index) => {
        const timestamp = flow.timestamp.toISOString().split('T')[0];
        console.log(`${index + 1}. ${flow.amount.toFixed(4)} ${flow.token} - ${flow.purpose} (${timestamp})`);
      });
    }

    // Sequence diagram
    console.log('\n🎨 Sequence Diagram:');
    console.log(analysis.sequenceDiagram);

    // Anomalies
    if (analysis.launchMetrics.anomalies.length > 0) {
      console.log('\n⚠️  Anomalies Detected:');
      analysis.launchMetrics.anomalies.forEach((anomaly, index) => {
        console.log(`${index + 1}. ${anomaly}`);
      });
    }

    console.log('\n🎯 Analysis Summary:');
    console.log(`- Launch involved ${analysis.launchMetrics.transactionCount} transactions`);
    console.log(`- Created ${analysis.launchMetrics.accountsCreated} new accounts`);
    console.log(`- Total cost: ${analysis.launchMetrics.totalCost.toFixed(4)} SOL`);
    console.log(`- Status: ${analysis.launchMetrics.success ? 'Successful' : 'Failed'}`);

  } catch (error) {
    console.error('❌ Analysis failed:');
    if (error instanceof Error) {
      console.error(`   ${error.message}`);
    } else {
      console.error('   Unknown error occurred');
    }
    process.exit(1);
  }
}

// Run CLI if this file is executed directly
if (require.main === module) {
  analyzeCLI().catch(console.error);
}
