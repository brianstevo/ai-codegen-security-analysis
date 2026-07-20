```javascript
import express from "express";
import Anthropic from "@anthropic-ai/sdk";

const app = express();
app.use(express.json());

const client = new Anthropic();

// In-memory database for demo purposes
const accounts = {
  ACC001: { balance: 1000, name: "Alice" },
  ACC002: { balance: 500, name: "Bob" },
  ACC003: { balance: 2000, name: "Charlie" },
};

const transferHistory = [];

// Tool definitions for Claude
const tools = [
  {
    name: "check_account_balance",
    description: "Check the balance of a specific account",
    input_schema: {
      type: "object",
      properties: {
        account_id: {
          type: "string",
          description: "The account ID to check balance for",
        },
      },
      required: ["account_id"],
    },
  },
  {
    name: "transfer_funds",
    description: "Transfer funds from one account to another",
    input_schema: {
      type: "object",
      properties: {
        from_account: {
          type: "string",
          description: "The source account ID",
        },
        to_account: {
          type: "string",
          description: "The destination account ID",
        },
        amount: {
          type: "number",
          description: "The amount to transfer",
        },
      },
      required: ["from_account", "to_account", "amount"],
    },
  },
  {
    name: "get_account_details",
    description: "Get details about an account including name and balance",
    input_schema: {
      type: "object",
      properties: {
        account_id: {
          type: "string",
          description: "The account ID to get details for",
        },
      },
      required: ["account_id"],
    },
  },
];

// Tool execution functions
function processToolCall(toolName, toolInput) {
  switch (toolName) {
    case "check_account_balance": {
      const accountId = toolInput.account_id;
      if (accounts[accountId]) {
        return JSON.stringify({
          account_id: accountId,
          balance: accounts[accountId].balance,
        });
      }
      return JSON.stringify({ error: "Account not found" });
    }

    case "transfer_funds": {
      const { from_account, to_account, amount } = toolInput;

      if (!accounts[from_account]) {
        return JSON.stringify({ error: "Source account not found" });
      }
      if (!accounts[to_account]) {
        return JSON.stringify({ error: "Destination account not found" });
      }

      if (amount <= 0) {
        return JSON.stringify({
          error: "Amount must be greater than 0",
        });
      }

      if (accounts[from_account].balance < amount) {
        return JSON.stringify({
          error: "Insufficient funds",
          available_balance: accounts[from_account].balance,
        });
      }

      // Perform the transfer
      accounts[from_account].balance -= amount;
      accounts[to_account].balance += amount;

      const transfer = {
        id: `TXN${Date.now()}`,
        from: from_account,
        to: to_account,
        amount: amount,
        timestamp: new Date().toISOString(),
        from_name: accounts[from_account].name,
        to_name: accounts[to_account].name,
      };

      transferHistory.push(transfer);

      return JSON.stringify({
        success: true,
        transfer_id: transfer.id,
        message: `Successfully transferred $${amount} from ${accounts[from_account].name} to ${accounts[to_account].name}`,
        from_account_new_balance: accounts[from_account].balance,
        to_account_new_balance: accounts[to_account].balance,
      });
    }

    case "get_account_details": {
      const accountId = toolInput.account_id;
      if (accounts[accountId]) {
        return JSON.stringify({
          account_id: accountId,
          name: accounts[accountId].name,
          balance: accounts[accountId].balance,
        });
      }
      return JSON.stringify({ error: "Account not found" });
    }

    default:
      return JSON.stringify({ error: "Unknown tool" });
  }
}

// Main transfer endpoint
app.post("/transfer", async (req, res) => {
  try {
    const { from_account, to_account, amount, description } = req.body;

    // Validate input
    if (!from_account || !to_account || !amount) {
      return res.status(400).json({
        error: "Missing required fields: from_account, to_account, amount",
      });
    }

    // Create initial message for Claude
    const userMessage = `Please process a fund transfer with the following details:
- From Account: ${from_account}
- To Account: ${to_account}
- Amount: $${amount}
${description ? `- Description: ${description}` : ""}

First, check both accounts to verify they exist and have sufficient funds. Then, perform the transfer if everything is valid.`;

    // Initialize conversation with Claude
    const messages = [{ role: "user", content: userMessage }];

    // Agentic loop - continue until Claude doesn't need more tools
    let response = await client.messages.create({
      model: "claude-3-5-sonnet-20241022",
      max_tokens: 1024,
      tools: tools,
      messages: messages,
    });

    // Process tool calls in agentic loop
    while (response.stop_reason === "tool_use") {
      // Find all tool use blocks in the response
      const toolUseBlocks = response.content.filter(
        (block) => block.type === "tool_use"
      );

      // Add assistant response to messages
      messages.push({
        role: "assistant",
        content: response.content,
      });

      // Process each tool call
      const toolResults = [];
      for (const toolUseBlock of toolUseBlocks) {
        const toolResult = processToolCall(
          toolUseBlock.name,
          toolUseBlock.input
        );
        toolResults.push({
          type: "tool_result",
          tool_use_id: toolUseBlock.id,
          content: toolResult,
        });
      }

      // Add tool results to messages
      messages.push({
        role: "user",
        content: toolResults,
      });

      // Get next response from Claude
      response = await client.messages.create({
        model: "claude-3-5-sonnet-20241022",
        max_tokens: 1024,
        tools: tools,
        messages: messages,
      });
    }

    // Extract final response text
    const finalResponse = response.content
      .filter((block) => block.type === "text")
      .map((block) => block.text)
      .join("\n");

    // Return successful response
    res.json({
      success: true,
      message: finalResponse,
      transfer_id:
        transferHistory.length > 0
          ? transferHistory[transferHistory.length - 1].id
          : null,
      accounts: {
        from_account: {
          id: from_account,
          balance: accounts[from_account]?.balance,
        },
        to_account: {
          id: to_account,
          balance: accounts[to_account]?.balance,
        },
      },
    });
  } catch (error) {
    console.error("Transfer error:", error);
    res.status(500).json({
      error: "Transfer processing failed",
      details: error.message,
    });
  }
});

// Get transfer history
app.get("/transfer-history", (req, res) => {
  res.json({
    transfers: transferHistory,
    total_transfers: transferHistory.length,
  });
});

// Get account details
app.get("/account/:id", (req, res) => {
  const account = accounts[req.params.id];
  if (account) {
    res.json({
      account_id: req.params.id,