// ─── Base layout ─────────────────────────────────────────────────────────────

const wrap = (content: string) => `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <style>
    body { margin: 0; padding: 0; background: #f4f5f7; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
    .wrapper { max-width: 600px; margin: 40px auto; background: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.08); }
    .header { background: #1a1a2e; padding: 32px 40px; }
    .header h1 { margin: 0; color: #e94560; font-size: 20px; letter-spacing: 1px; }
    .header p { margin: 4px 0 0; color: #8892a4; font-size: 13px; }
    .body { padding: 40px; color: #333; }
    .body h2 { margin: 0 0 16px; font-size: 22px; color: #1a1a2e; }
    .body p { margin: 0 0 16px; line-height: 1.6; font-size: 15px; color: #555; }
    .badge { display: inline-block; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 600; letter-spacing: 0.5px; }
    .badge-danger { background: #fee2e2; color: #dc2626; }
    .badge-warning { background: #fef3c7; color: #d97706; }
    .badge-success { background: #d1fae5; color: #059669; }
    .info-box { background: #f8f9fc; border-left: 4px solid #e94560; border-radius: 4px; padding: 16px 20px; margin: 20px 0; }
    .info-box p { margin: 0; font-size: 14px; color: #444; }
    .info-box .label { font-weight: 600; color: #1a1a2e; margin-bottom: 4px; }
    .btn { display: inline-block; padding: 12px 28px; background: #e94560; color: #fff !important; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 14px; margin: 8px 0; }
    .divider { height: 1px; background: #eee; margin: 24px 0; }
    .footer { padding: 24px 40px; background: #f8f9fc; border-top: 1px solid #eee; }
    .footer p { margin: 0; font-size: 12px; color: #999; line-height: 1.6; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="header">
      <h1>S.I.S.M.S</h1>
      <p>Smart Inventory & Sales Management System</p>
    </div>
    <div class="body">${content}</div>
    <div class="footer">
      <p>This is an automated message from S.I.S.M.S. Please do not reply to this email.<br/>
      If you did not expect this email, please contact your organization administrator.</p>
    </div>
  </div>
</body>
</html>
`;

// ─── Templates ────────────────────────────────────────────────────────────────

export interface WelcomeEmailData {
    recipientName: string;
    organizationName: string;
    email: string;
    temporaryPassword: string;
    loginUrl: string;
    role: string;
}

export const welcomeEmail = (data: WelcomeEmailData) => ({
    subject: `Welcome to ${data.organizationName} on S.I.S.M.S`,
    html: wrap(`
    <h2>Welcome, ${data.recipientName}! 👋</h2>
    <p>You've been added to <strong>${data.organizationName}</strong> on S.I.S.M.S as <strong>${data.role.replace("ORG_", "").replace("_", " ")}</strong>.</p>
    <p>Here are your login credentials:</p>
    <div class="info-box">
      <p class="label">Email</p>
      <p>${data.email}</p>
      <div class="divider"></div>
      <p class="label">Temporary Password</p>
      <p style="font-family: monospace; font-size: 16px; letter-spacing: 2px;">${data.temporaryPassword}</p>
    </div>
    <p>Please log in and change your password immediately.</p>
    <a href="${data.loginUrl}" class="btn">Log In Now</a>
    <div class="divider"></div>
    <p style="font-size: 13px; color: #999;">For security, your temporary password will only work once. You will be prompted to set a new password on first login.</p>
  `),
});

// ─────────────────────────────────────────────────────────────────────────────

export interface PasswordChangedEmailData {
    recipientName: string;
    ipAddress: string;
    timestamp: string;
    loginUrl: string;
}

export const passwordChangedEmail = (data: PasswordChangedEmailData) => ({
    subject: "Your S.I.S.M.S password was changed",
    html: wrap(`
    <h2>Password Changed</h2>
    <p>Hi <strong>${data.recipientName}</strong>, your account password was recently changed.</p>
    <div class="info-box">
      <p class="label">Time</p>
      <p>${data.timestamp}</p>
      <div class="divider"></div>
      <p class="label">IP Address</p>
      <p>${data.ipAddress || "Unknown"}</p>
    </div>
    <p>All existing sessions have been revoked. You will need to log in again on all devices.</p>
    <p>If you did not make this change, your account may be compromised. Please contact your administrator immediately.</p>
    <a href="${data.loginUrl}" class="btn">Log In</a>
  `),
});

// ─────────────────────────────────────────────────────────────────────────────

export interface LowStockEmailData {
    organizationName: string;
    products: Array<{
        name: string;
        sku: string;
        currentStock: number;
        reorderPoint: number;
        unit: string;
    }>;
    alertsUrl: string;
}

export const lowStockEmail = (data: LowStockEmailData) => {
    const rows = data.products
        .map(
            (p) => `
      <tr style="border-bottom: 1px solid #eee;">
        <td style="padding: 10px 8px; font-weight: 500;">${p.name}</td>
        <td style="padding: 10px 8px; font-family: monospace; color: #666;">${p.sku}</td>
        <td style="padding: 10px 8px; text-align: center;">
          <span class="badge badge-danger">${p.currentStock} ${p.unit}</span>
        </td>
        <td style="padding: 10px 8px; text-align: center; color: #888;">${p.reorderPoint} ${p.unit}</td>
      </tr>`,
        )
        .join("");

    return {
        subject: `⚠️ Low Stock Alert — ${data.products.length} product(s) need attention`,
        html: wrap(`
      <h2>Low Stock Alert ⚠️</h2>
      <p>The following products in <strong>${data.organizationName}</strong> are at or below their reorder point:</p>
      <table style="width: 100%; border-collapse: collapse; font-size: 14px; margin: 16px 0;">
        <thead>
          <tr style="background: #f8f9fc; text-align: left;">
            <th style="padding: 10px 8px; color: #1a1a2e;">Product</th>
            <th style="padding: 10px 8px; color: #1a1a2e;">SKU</th>
            <th style="padding: 10px 8px; color: #1a1a2e; text-align: center;">Current Stock</th>
            <th style="padding: 10px 8px; color: #1a1a2e; text-align: center;">Reorder Point</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
      <a href="${data.alertsUrl}" class="btn">View All Alerts</a>
    `),
    };
};

// ─────────────────────────────────────────────────────────────────────────────

export interface SaleApprovedEmailData {
    recipientName: string;
    saleId: string;
    totalAmount: number;
    itemCount: number;
    approvedByName: string;
    currency: string;
    saleUrl: string;
}

export const saleApprovedEmail = (data: SaleApprovedEmailData) => ({
    subject: `✅ Sale Approved — ${data.currency}${data.totalAmount.toFixed(2)}`,
    html: wrap(`
    <h2>Your Sale Was Approved ✅</h2>
    <p>Hi <strong>${data.recipientName}</strong>, your sale has been reviewed and approved.</p>
    <div class="info-box">
      <p class="label">Sale Reference</p>
      <p style="font-family: monospace;">${data.saleId}</p>
      <div class="divider"></div>
      <p class="label">Total Amount</p>
      <p style="font-size: 20px; font-weight: 700; color: #059669;">${data.currency}${data.totalAmount.toFixed(2)}</p>
      <div class="divider"></div>
      <p class="label">Items</p>
      <p>${data.itemCount} line item(s)</p>
      <div class="divider"></div>
      <p class="label">Approved By</p>
      <p>${data.approvedByName}</p>
    </div>
    <a href="${data.saleUrl}" class="btn">View Sale</a>
  `),
});
