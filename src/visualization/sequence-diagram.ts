import { ParsedTransactionWithMeta } from '@solana/web3.js';
import { TokenAccountInfo, FundFlow, PROGRAM_IDS } from '../types';

/**
 * Sequence diagram generator for Solana token launch visualization
 */
export class SequenceDiagramGenerator {
  
  /**
   * Generate a Mermaid sequence diagram for token launch
   */
  generateTokenLaunchDiagram(
    transactions: ParsedTransactionWithMeta[],
    tokenAccounts: TokenAccountInfo[],
    fundFlows: FundFlow[]
  ): string {
    const participants = this.extractParticipants(transactions, tokenAccounts);
    const interactions = this.extractInteractions(transactions, fundFlows);
    
    let diagram = 'sequenceDiagram\n';
    
    // Add participants
    participants.forEach(participant => {
      diagram += `    participant ${participant.id} as ${participant.label}\n`;
    });
    
    diagram += '\n';
    
    // Add interactions
    interactions.forEach(interaction => {
      diagram += `    ${interaction.from}->>${interaction.to}: ${interaction.label}\n`;
      if (interaction.note) {
        diagram += `    Note over ${interaction.from},${interaction.to}: ${interaction.note}\n`;
      }
    });
    
    return diagram;
  }

  /**
   * Generate a simple transaction flow diagram
   */
  generateTransactionFlowDiagram(transaction: ParsedTransactionWithMeta): string {
    let diagram = 'sequenceDiagram\n';
    diagram += '    participant User\n';
    diagram += '    participant System\n';
    diagram += '    participant Token\n';
    diagram += '    participant Metadata\n\n';

    if (!transaction.transaction.message.instructions) {
      return diagram + '    Note over User,Metadata: No instructions found\n';
    }

    transaction.transaction.message.instructions.forEach((instruction, index) => {
      const programId = instruction.programId;
      let from = 'User';
      let to = 'System';
      let action = 'Unknown Operation';

      // Identify the target based on program
      if (programId.equals(PROGRAM_IDS.SYSTEM)) {
        to = 'System';
        action = 'Create Account / Transfer';
      } else if (programId.equals(PROGRAM_IDS.TOKEN)) {
        to = 'Token';
        action = 'Token Operation';
      } else if (programId.equals(PROGRAM_IDS.METADATA)) {
        to = 'Metadata';
        action = 'Setup Metadata';
      } else if (programId.equals(PROGRAM_IDS.ASSOCIATED_TOKEN)) {
        to = 'Token';
        action = 'Create Associated Account';
      }

      diagram += `    ${from}->>${to}: ${action}\n`;
      diagram += `    ${to}-->>${from}: Success\n`;
      
      if (index < transaction.transaction.message.instructions.length - 1) {
        diagram += '\n';
      }
    });

    return diagram;
  }

  /**
   * Generate fund flow diagram
   */
  generateFundFlowDiagram(fundFlows: FundFlow[]): string {
    let diagram = 'sequenceDiagram\n';
    
    // Extract unique participants from fund flows
    const participants = new Set<string>();
    fundFlows.forEach(flow => {
      participants.add(this.shortenAddress(flow.from.toString()));
      participants.add(this.shortenAddress(flow.to.toString()));
    });

    // Add participants
    Array.from(participants).forEach(participant => {
      diagram += `    participant ${participant}\n`;
    });

    diagram += '\n';

    // Add fund flows
    fundFlows.slice(0, 10).forEach(flow => { // Limit to first 10 for readability
      const from = this.shortenAddress(flow.from.toString());
      const to = this.shortenAddress(flow.to.toString());
      const amount = flow.amount.toFixed(4);
      
      diagram += `    ${from}->>${to}: ${amount} ${flow.token}\n`;
      diagram += `    Note over ${from},${to}: ${flow.purpose}\n`;
    });

    return diagram;
  }

  /**
   * Extract participants from transactions and accounts
   */
  private extractParticipants(
    _transactions: ParsedTransactionWithMeta[],
    tokenAccounts: TokenAccountInfo[]
  ) {
    const participants = [
      { id: 'Creator', label: 'Token Creator' },
      { id: 'System', label: 'System Program' },
      { id: 'Token', label: 'Token Program' },
      { id: 'Metadata', label: 'Metadata Program' }
    ];

    // Add unique token accounts as participants
    const uniqueAccounts = new Set<string>();
    tokenAccounts.forEach(account => {
      const shortAddr = this.shortenAddress(account.address.toString());
      if (!uniqueAccounts.has(shortAddr)) {
        uniqueAccounts.add(shortAddr);
        participants.push({
          id: shortAddr,
          label: `${account.role} (${shortAddr})`
        });
      }
    });

    return participants.slice(0, 8); // Limit participants for readability
  }

  /**
   * Extract interactions from transactions and fund flows
   */
  private extractInteractions(
    _transactions: ParsedTransactionWithMeta[],
    fundFlows: FundFlow[]
  ) {
    const interactions: Array<{
      from: string;
      to: string;
      label: string;
      note?: string;
    }> = [];

    // Add basic token launch sequence
    interactions.push(
      { from: 'Creator', to: 'System', label: 'Create Mint Account' },
      { from: 'System', to: 'Creator', label: 'Account Created' },
      { from: 'Creator', to: 'Token', label: 'Initialize Mint' },
      { from: 'Token', to: 'Creator', label: 'Mint Ready' }
    );

    // Add metadata setup if present
    const hasMetadata = _transactions.some(tx =>
      tx.transaction.message.instructions.some(inst =>
        inst.programId.equals(PROGRAM_IDS.METADATA)
      )
    );

    if (hasMetadata) {
      interactions.push(
        { from: 'Creator', to: 'Metadata', label: 'Create Metadata' },
        { from: 'Metadata', to: 'Creator', label: 'Metadata Created' }
      );
    }

    // Add fund flows
    fundFlows.slice(0, 5).forEach(flow => {
      const from = this.shortenAddress(flow.from.toString());
      const to = this.shortenAddress(flow.to.toString());
      
      interactions.push({
        from: from === to ? 'Creator' : from,
        to: to === from ? 'Creator' : to,
        label: `${flow.amount.toFixed(4)} ${flow.token}`,
        note: flow.purpose
      });
    });

    return interactions;
  }

  /**
   * Shorten Solana address for display
   */
  private shortenAddress(address: string): string {
    if (address.length <= 8) return address;
    return `${address.slice(0, 4)}...${address.slice(-4)}`;
  }

  /**
   * Generate HTML page with interactive Mermaid diagram
   */
  generateInteractiveDiagram(mermaidCode: string, title: string = 'Token Launch Analysis'): string {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}</title>
    <script src="https://cdn.jsdelivr.net/npm/mermaid/dist/mermaid.min.js"></script>
    <style>
        body {
            font-family: Arial, sans-serif;
            margin: 20px;
            background-color: #f5f5f5;
        }
        .container {
            max-width: 1200px;
            margin: 0 auto;
            background: white;
            padding: 20px;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        h1 {
            color: #333;
            text-align: center;
        }
        .diagram-container {
            text-align: center;
            margin: 20px 0;
        }
        .mermaid {
            background: white;
        }
        .controls {
            text-align: center;
            margin: 20px 0;
        }
        button {
            background: #007bff;
            color: white;
            border: none;
            padding: 10px 20px;
            margin: 0 10px;
            border-radius: 4px;
            cursor: pointer;
        }
        button:hover {
            background: #0056b3;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>${title}</h1>
        <div class="controls">
            <button onclick="downloadSVG()">Download SVG</button>
            <button onclick="copyToClipboard()">Copy Mermaid Code</button>
        </div>
        <div class="diagram-container">
            <div class="mermaid">
${mermaidCode}
            </div>
        </div>
    </div>

    <script>
        mermaid.initialize({ startOnLoad: true, theme: 'default' });
        
        function downloadSVG() {
            const svg = document.querySelector('.mermaid svg');
            if (svg) {
                const svgData = new XMLSerializer().serializeToString(svg);
                const svgBlob = new Blob([svgData], {type: 'image/svg+xml;charset=utf-8'});
                const svgUrl = URL.createObjectURL(svgBlob);
                const downloadLink = document.createElement('a');
                downloadLink.href = svgUrl;
                downloadLink.download = 'token-launch-diagram.svg';
                document.body.appendChild(downloadLink);
                downloadLink.click();
                document.body.removeChild(downloadLink);
            }
        }
        
        function copyToClipboard() {
            const mermaidCode = \`${mermaidCode.replace(/`/g, '\\`')}\`;
            navigator.clipboard.writeText(mermaidCode).then(() => {
                alert('Mermaid code copied to clipboard!');
            });
        }
    </script>
</body>
</html>`;
  }
}
