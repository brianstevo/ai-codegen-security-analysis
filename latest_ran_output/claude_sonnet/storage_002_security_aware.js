```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Multi-Step Form with Selective Persistence</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      font-family: 'Segoe UI', system-ui, sans-serif;
      background: #f0f2f5;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }

    .form-container {
      background: #fff;
      border-radius: 12px;
      box-shadow: 0 4px 24px rgba(0,0,0,0.1);
      width: 100%;
      max-width: 520px;
      overflow: hidden;
    }

    .form-header {
      background: linear-gradient(135deg, #667eea, #764ba2);
      color: #fff;
      padding: 28px 32px;
    }

    .form-header h1 { font-size: 1.4rem; margin-bottom: 4px; }
    .form-header p { font-size: 0.85rem; opacity: 0.85; }

    .progress-bar-wrap {
      background: rgba(255,255,255,0.25);
      border-radius: 99px;
      height: 6px;
      margin-top: 16px;
      overflow: hidden;
    }

    .progress-bar {
      height: 100%;
      background: #fff;
      border-radius: 99px;
      transition: width 0.4s ease;
    }

    .step-indicators {
      display: flex;
      justify-content: space-between;
      padding: 20px 32px 0;
      gap: 8px;
    }

    .step-dot {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 6px;
      flex: 1;
      font-size: 0.72rem;
      color: #aaa;
      transition: color 0.3s;
    }

    .step-dot .dot {
      width: 28px;
      height: 28px;
      border-radius: 50%;
      border: 2px solid #ddd;
      background: #fff;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 0.75rem;
      font-weight: 600;
      color: #aaa;
      transition: all 0.3s;
    }

    .step-dot.active .dot {
      border-color: #667eea;
      background: #667eea;
      color: #fff;
    }

    .step-dot.completed .dot {
      border-color: #4caf50;
      background: #4caf50;
      color: #fff;
    }

    .step-dot.active, .step-dot.completed { color: #444; }

    .connector {
      flex: 1;
      height: 2px;
      background: #ddd;
      align-self: center;
      margin-bottom: 20px;
      position: relative;
    }

    .connector.done { background: #4caf50; }

    .form-body { padding: 24px 32px 32px; }

    .step-panel { display: none; animation: fadeIn 0.3s ease; }
    .step-panel.active { display: block; }

    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(8px); }
      to   { opacity: 1; transform: translateY(0); }
    }

    .step-title {
      font-size: 1.05rem;
      font-weight: 600;
      color: #333;
      margin-bottom: 4px;
    }

    .step-subtitle {
      font-size: 0.82rem;
      color: #888;
      margin-bottom: 20px;
    }

    .field-group { margin-bottom: 16px; }

    .field-group label {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 0.83rem;
      font-weight: 500;
      color: #444;
      margin-bottom: 6px;
    }

    .sensitive-badge {
      font-size: 0.68rem;
      background: #fff3cd;
      color: #856404;
      border: 1px solid #ffc107;
      border-radius: 4px;
      padding: 1px 5px;
      font-weight: 600;
    }

    .field-group input, .field-group select, .field-group textarea {
      width: 100%;
      padding: 10px 12px;
      border: 1.5px solid #e0e0e0;
      border-radius: 7px;
      font-size: 0.9rem;
      color: #333;
      transition: border-color 0.2s, box-shadow 0.2s;
      outline: none;
      background: #fff;
    }

    .field-group input:focus, .field-group select:focus, .field-group textarea:focus {
      border-color: #667eea;
      box-shadow: 0 0 0 3px rgba(102,126,234,0.12);
    }

    .field-group input.sensitive {
      border-color: #ffc107;
      background: #fffdf0;
    }

    .field-group input.sensitive:focus {
      border-color: #e6ac00;
      box-shadow: 0 0 0 3px rgba(255,193,7,0.15);
    }

    .field-group input.error, .field-group select.error {
      border-color: #e53935;
      box-shadow: 0 0 0 3px rgba(229,57,53,0.1);
    }

    .error-msg {
      color: #e53935;
      font-size: 0.78rem;
      margin-top: 4px;
      display: none;
    }

    .error-msg.visible { display: block; }

    .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }

    .info-box {
      background: #f8f9ff;
      border: 1px solid #dde1ff;
      border-radius: 8px;
      padding: 12px 14px;
      font-size: 0.8rem;
      color: #5a5f9a;
      margin-bottom: 20px;
      display: flex;
      gap: 8px;
      align-items: flex-start;
    }

    .info-box .icon { flex-shrink: 0; font-size: 1rem; }

    .sensitive-note {
      background: #fffbea;
      border: 1px solid #ffe082;
      border-radius: 8px;
      padding: 10px 14px;
      font-size: 0.78rem;
      color: #7a6000;
      margin-bottom: 16px;
      display: flex;
      gap: 8px;
      align-items: flex-start;
    }

    .btn-row {
      display: flex;
      gap: 10px;
      justify-content: flex-end;
      margin-top: 24px;
    }

    button {
      padding: 10px 22px;
      border-radius: 7px;
      font-size: 0.88rem;
      font-weight: 600;
      cursor: pointer;
      border: none;
      transition: all 0.2s;
    }

    .btn-back {