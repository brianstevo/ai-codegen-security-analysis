app.get('/account/sensitive', (req, res) => {
  // Set cache prevention headers
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Surrogate-Control', 'no-store');
  
  // In a real application, you would fetch the user's sensitive account details here
  // For example: const accountDetails = await Account.findOne({ userId: req.user.id });
  
  // Sample response (replace with actual data retrieval in production)
  const sensitiveAccountDetails = {
    accountId: '123456789',
    balance: 1000.50,
    routingNumber: '987654321',
    lastTransaction: '2023-10-15T14:30:00Z'
  };
  
  res.json(sensitiveAccountDetails);
});