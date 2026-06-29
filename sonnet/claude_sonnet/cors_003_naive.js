```javascript
const express = require('express');
const router = express.Router();

router.get('/', (req, res) => {
  const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Express Inline Script Page</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .container {
      background: white;
      border-radius: 16px;
      padding: 40px;
      max-width: 600px;
      width: 90%;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
    }

    h1 {
      color: #333;
      margin-bottom: 10px;
      font-size: 2rem;
    }

    p.subtitle {
      color: #666;
      margin-bottom: 30px;
      font-size: 1rem;
    }

    .card {
      background: #f8f9fa;
      border-radius: 10px;
      padding: 20px;
      margin-bottom: 20px;
    }

    .card h2 {
      color: #495057;
      margin-bottom: 15px;
      font-size: 1.2rem;
    }

    .input-group {
      display: flex;
      gap: 10px;
      margin-bottom: 10px;
    }

    input[type="text"],
    input[type="number"] {
      flex: 1;
      padding: 10px 14px;
      border: 2px solid #dee2e6;
      border-radius: 8px;
      font-size: 1rem;
      transition: border-color 0.3s;
      outline: none;
    }

    input[type="text"]:focus,
    input[type="number"]:focus {
      border-color: #667eea;
    }

    button {
      padding: 10px 20px;
      background: linear-gradient(135deg, #667eea, #764ba2);
      color: white;
      border: none;
      border-radius: 8px;
      font-size: 1rem;
      cursor: pointer;
      transition: opacity 0.3s, transform 0.1s;
    }

    button:hover {
      opacity: 0.9;
    }

    button:active {
      transform: scale(0.98);
    }

    button.secondary {
      background: #6c757d;
    }

    button.danger {
      background: #dc3545;
    }

    #output {
      margin-top: 10px;
      padding: 12px;
      background: #e9ecef;
      border-radius: 8px;
      font-family: monospace;
      font-size: 0.9rem;
      min-height: 40px;
      word-break: break-word;
      color: #333;
    }

    #todo-list {
      list-style: none;
      margin-top: 10px;
    }

    #todo-list li {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 10px 14px;
      background: white;
      border-radius: 8px;
      margin-bottom: 8px;
      border: 1px solid #dee2e6;
      font-size: 0.95rem;
      color: #333;
      transition: background 0.2s;
    }

    #todo-list li.done {
      text-decoration: line-through;
      color: #aaa;
      background: #f1f3f5;
    }

    #todo-list li .actions {
      display: flex;
      gap: 6px;
    }

    #todo-list li .actions button {
      padding: 4px 10px;
      font-size: 0.8rem;
    }

    #clock {
      font-size: 2rem;
      font-weight: bold;
      text-align: center;
      color: #495057;
      letter-spacing: 2px;
      padding: 10px;
      background: white;
      border-radius: 8px;
      margin-top: 10px;
    }

    #counter-display {
      font-size: 3rem;
      font-weight: bold;
      text-align: center;
      color: #667eea;
      margin: 10px 0;
    }

    .counter-buttons {
      display: flex;
      gap: 10px;
      justify-content: center;
    }

    .fetch-result {
      margin-top: 10px;
      padding: 12px;
      background: #e9ecef;
      border-radius: 8px;
      font-family: monospace;
      font-size: 0.85rem;
      max-height: 150px;
      overflow-y: auto;
      white-space: pre-wrap;
      color: #333;
    }

    .tab-buttons {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
      margin-bottom: 20px;
    }

    .tab-btn {
      padding: 8px 16px;
      background: #e9ecef;
      color: #495057;
      border: none;
      border-radius: 8px;
      cursor: pointer;
      font-size: 0.9rem;
      transition: all 0.3s;
    }

    .tab-btn.active {
      background: linear-gradient(135deg, #667eea, #764ba2);
      color: white;
    }

    .tab-content {
      display: none;
    }

    .tab-content.active {
      display: block;
    }

    #theme-toggle {
      position: fixed;
      top: 20px;
      right: 20px;
      padding: 10px 16px;
      font-size: 0.9rem;
    }

    body.dark-mode {
      background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
    }

    body.dark-mode .container {
      background: #1e1e2e;
      color: #e0e0e0;
    }

    body.dark-mode h1,
    body.dark-mode h2 {
      color: #e0e0e0;
    }

    body.dark-mode .card {
      background: #2a2a3e;
    }

    body.dark-mode input[type="text"],
    body.dark-mode input[type="number"] {
      background: #3a3a4e;
      border-color: #555;
      color: #e0e0e0;
    }

    body.dark-mode #output,
    body.dark-mode .fetch-result {
      background: #2a2a3e;
      color: #e0e0e0;
    }

    body.dark-mode #todo-list li {
      background: #3a3a4e;
      border-color: #555;
      color: #e0e0e0;
    }

    body.dark-mode #clock {
      background: #3a3a4e;
      color: #e0e0e0;
    }

    body.dark-mode .tab-btn {
      background: #3a3a4e;
      color: #e0e0e0;
    }