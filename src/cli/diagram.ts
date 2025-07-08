#!/usr/bin/env node

import * as fs from 'fs';
import * as path from 'path';
import { SolanaConnectionManager } from '../connection/solana-connection';
import { TransactionAnalyzer } from '../analysis/transaction-analyzer';

/**
 * CLI tool for generating sequence diagrams from transaction signatures
 * Usage: npm run diagram <transaction-signature>
 */
async function diagramCLI() {
  const args = process.argv.slice(2);
  
  if (args.length === 0 || args.includes('--help')) {
    console.log('🎨 Solana Transaction Sequence Diagram Generator');
    console.log('===============================================');
    console.log('Usage: npm run diagram <transaction-signature> [options]');
    console.log('');
    console.log('Example:');
    console.log('  npm run diagram 5Go9ML7A5nCMskfj6d4Vq2pvYBbzYhv85DHjQAYHYSSbRA19gdjY45fFz7kyxg7xARjAeAkis8YKPcZM8CYkoYrK');
    console.log('');
    console.log('Options:');
    console.log('  --devnet       Use devnet instead of mainnet');
    console.log('  --output FILE  Save HTML diagram to file (default: diagram.html)');
    console.log('  --mermaid-only Output only Mermaid code (no HTML)');
    console.log('  --help         Show this help message');
    process.exit(0);
  }

  const signature = args[0];
  if (!signature) {
    console.error('❌ Transaction signature is required');
    process.exit(1);
  }

  const useDevnet = args.includes('--devnet');
  const mermaidOnly = args.includes('--mermaid-only');

  // Get output file
  let outputFile = 'diagram.html';
  const outputIndex = args.indexOf('--output');
  if (outputIndex !== -1 && outputIndex + 1 < args.length) {
    const nextArg = args[outputIndex + 1];
    if (nextArg && !nextArg.startsWith('--')) {
      outputFile = nextArg;
    }
  }

  try {
    console.log('🎨 Generating Sequence Diagram');
    console.log('==============================');
    console.log(`📍 Transaction: ${signature}`);
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

    // Generate diagram
    console.log('🔍 Analyzing transaction...');
    const startTime = Date.now();
    
    const mermaidCode = await analyzer.generateTransactionDiagram(signature);
    
    const analysisTime = (Date.now() - startTime) / 1000;

    if (mermaidOnly) {
      // Output only Mermaid code
      console.log('\n🎨 Mermaid Sequence Diagram:');
      console.log('============================');
      console.log(mermaidCode);
    } else {
      // Generate interactive HTML
      console.log('🎨 Generating interactive diagram...');
      const htmlContent = analyzer.generateInteractiveDiagram(
        mermaidCode, 
        `Transaction Analysis: ${signature.slice(0, 8)}...`
      );

      // Save to file
      fs.writeFileSync(outputFile, htmlContent);
      
      console.log('\n✅ Diagram Generated Successfully!');
      console.log('==================================');
      console.log(`⏱️  Analysis time: ${analysisTime.toFixed(2)}s`);
      console.log(`📄 Output file: ${path.resolve(outputFile)}`);
      console.log(`🌐 Open in browser: file://${path.resolve(outputFile)}`);
      
      // Also output the Mermaid code
      console.log('\n🎨 Mermaid Code:');
      console.log('================');
      console.log(mermaidCode);
    }

    console.log('\n🎯 Diagram Features:');
    console.log('- Interactive pan and zoom');
    console.log('- Download as SVG');
    console.log('- Copy Mermaid code');
    console.log('- Responsive design');

  } catch (error) {
    console.error('❌ Diagram generation failed:');
    if (error instanceof Error) {
      console.error(`   ${error.message}`);
      
      if (error.message.includes('Transaction not found')) {
        console.log('\n💡 Tips:');
        console.log('- Make sure the transaction signature is correct');
        console.log('- Try a more recent transaction');
        console.log('- Check if you need to use --devnet for devnet transactions');
      }
    } else {
      console.error('   Unknown error occurred');
    }
    process.exit(1);
  }
}

// Run CLI if this file is executed directly
if (require.main === module) {
  diagramCLI().catch(console.error);
}
