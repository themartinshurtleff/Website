# TradeNet Supabase Auth Email Templates

Use these in Supabase Dashboard -> Authentication -> Email Templates.

Recommended sender:

```text
TradeNet <noreply@tradenet.org>
```

Notes:

- These templates use Supabase Go-template variables such as `{{ .ConfirmationURL }}`, `{{ .Token }}`, `{{ .Email }}`, and `{{ .NewEmail }}`.
- Keep the reset link flow pointed at the website recovery page through Supabase redirect configuration.
- These use the public email logo at `https://tradenet.org/assets/text-logo.png`.
- The image has `alt="TradeNet"` so blocked-image clients still show a useful fallback.

## Confirm Signup

Subject:

```text
Confirm your TradeNet account
```

HTML:

```html
<div style="margin:0;padding:0;background:#050506;font-family:Inter,Arial,sans-serif;color:#fafafa;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#050506;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#09090b;border:1px solid #242426;border-radius:18px;overflow:hidden;">
          <tr>
            <td style="padding:28px 28px 18px;border-bottom:1px solid #1f1f22;">
              <img src="https://tradenet.org/assets/text-logo.png" alt="TradeNet" width="170" style="display:block;width:170px;max-width:170px;height:auto;border:0;outline:none;text-decoration:none;">
              <div style="margin-top:8px;font-size:12px;letter-spacing:1.6px;text-transform:uppercase;color:#c9a84c;">Account verification</div>
            </td>
          </tr>
          <tr>
            <td style="padding:32px 28px;">
              <h1 style="margin:0 0 14px;font-size:28px;line-height:1.15;color:#fafafa;">Confirm your TradeNet account</h1>
              <p style="margin:0 0 22px;font-size:15px;line-height:1.7;color:#a1a1aa;">Welcome to TradeNet. Confirm this email address to finish creating your account and prepare it for beta launch access.</p>
              <p style="margin:0 0 26px;">
                <a href="{{ .ConfirmationURL }}" style="display:inline-block;background:#c9a84c;color:#050506;text-decoration:none;font-weight:800;font-size:14px;padding:14px 22px;border-radius:12px;">Confirm account</a>
              </p>
              <p style="margin:0 0 8px;font-size:13px;line-height:1.6;color:#71717a;">If the button does not work, copy and paste this link into your browser:</p>
              <p style="margin:0;font-size:12px;line-height:1.6;word-break:break-all;color:#c9a84c;">{{ .ConfirmationURL }}</p>
            </td>
          </tr>
          <tr>
            <td style="padding:20px 28px;background:#070708;border-top:1px solid #1f1f22;">
              <p style="margin:0;font-size:12px;line-height:1.6;color:#71717a;">If you did not create a TradeNet account, you can safely ignore this email.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</div>
```

## Reset Password

Subject:

```text
Reset your TradeNet password
```

HTML:

```html
<div style="margin:0;padding:0;background:#050506;font-family:Inter,Arial,sans-serif;color:#fafafa;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#050506;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#09090b;border:1px solid #242426;border-radius:18px;overflow:hidden;">
          <tr>
            <td style="padding:28px 28px 18px;border-bottom:1px solid #1f1f22;">
              <img src="https://tradenet.org/assets/text-logo.png" alt="TradeNet" width="170" style="display:block;width:170px;max-width:170px;height:auto;border:0;outline:none;text-decoration:none;">
              <div style="margin-top:8px;font-size:12px;letter-spacing:1.6px;text-transform:uppercase;color:#c9a84c;">Password recovery</div>
            </td>
          </tr>
          <tr>
            <td style="padding:32px 28px;">
              <h1 style="margin:0 0 14px;font-size:28px;line-height:1.15;color:#fafafa;">Reset your password</h1>
              <p style="margin:0 0 22px;font-size:15px;line-height:1.7;color:#a1a1aa;">We received a request to reset the password for your TradeNet account. Use the secure link below to choose a new password.</p>
              <p style="margin:0 0 26px;">
                <a href="{{ .ConfirmationURL }}" style="display:inline-block;background:#c9a84c;color:#050506;text-decoration:none;font-weight:800;font-size:14px;padding:14px 22px;border-radius:12px;">Reset password</a>
              </p>
              <p style="margin:0 0 8px;font-size:13px;line-height:1.6;color:#71717a;">If the button does not work, copy and paste this link into your browser:</p>
              <p style="margin:0;font-size:12px;line-height:1.6;word-break:break-all;color:#c9a84c;">{{ .ConfirmationURL }}</p>
            </td>
          </tr>
          <tr>
            <td style="padding:20px 28px;background:#070708;border-top:1px solid #1f1f22;">
              <p style="margin:0;font-size:12px;line-height:1.6;color:#71717a;">If you did not request this reset, ignore this email. Your current password will remain unchanged.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</div>
```

## Magic Link

Subject:

```text
Your TradeNet sign-in link
```

HTML:

```html
<div style="margin:0;padding:0;background:#050506;font-family:Inter,Arial,sans-serif;color:#fafafa;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#050506;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#09090b;border:1px solid #242426;border-radius:18px;overflow:hidden;">
          <tr>
            <td style="padding:28px 28px 18px;border-bottom:1px solid #1f1f22;">
              <img src="https://tradenet.org/assets/text-logo.png" alt="TradeNet" width="170" style="display:block;width:170px;max-width:170px;height:auto;border:0;outline:none;text-decoration:none;">
              <div style="margin-top:8px;font-size:12px;letter-spacing:1.6px;text-transform:uppercase;color:#c9a84c;">Secure sign-in</div>
            </td>
          </tr>
          <tr>
            <td style="padding:32px 28px;">
              <h1 style="margin:0 0 14px;font-size:28px;line-height:1.15;color:#fafafa;">Sign in to TradeNet</h1>
              <p style="margin:0 0 22px;font-size:15px;line-height:1.7;color:#a1a1aa;">Use this secure link to sign in to your TradeNet account.</p>
              <p style="margin:0 0 26px;">
                <a href="{{ .ConfirmationURL }}" style="display:inline-block;background:#c9a84c;color:#050506;text-decoration:none;font-weight:800;font-size:14px;padding:14px 22px;border-radius:12px;">Sign in</a>
              </p>
              <p style="margin:0 0 8px;font-size:13px;line-height:1.6;color:#71717a;">One-time code:</p>
              <p style="margin:0 0 18px;font-size:24px;letter-spacing:6px;font-weight:900;color:#fafafa;">{{ .Token }}</p>
              <p style="margin:0 0 8px;font-size:13px;line-height:1.6;color:#71717a;">If the button does not work, copy and paste this link into your browser:</p>
              <p style="margin:0;font-size:12px;line-height:1.6;word-break:break-all;color:#c9a84c;">{{ .ConfirmationURL }}</p>
            </td>
          </tr>
          <tr>
            <td style="padding:20px 28px;background:#070708;border-top:1px solid #1f1f22;">
              <p style="margin:0;font-size:12px;line-height:1.6;color:#71717a;">If you did not request this sign-in email, you can safely ignore it.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</div>
```

## Invite User

Subject:

```text
You are invited to TradeNet
```

HTML:

```html
<div style="margin:0;padding:0;background:#050506;font-family:Inter,Arial,sans-serif;color:#fafafa;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#050506;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#09090b;border:1px solid #242426;border-radius:18px;overflow:hidden;">
          <tr>
            <td style="padding:28px 28px 18px;border-bottom:1px solid #1f1f22;">
              <img src="https://tradenet.org/assets/text-logo.png" alt="TradeNet" width="170" style="display:block;width:170px;max-width:170px;height:auto;border:0;outline:none;text-decoration:none;">
              <div style="margin-top:8px;font-size:12px;letter-spacing:1.6px;text-transform:uppercase;color:#c9a84c;">Beta access invitation</div>
            </td>
          </tr>
          <tr>
            <td style="padding:32px 28px;">
              <h1 style="margin:0 0 14px;font-size:28px;line-height:1.15;color:#fafafa;">Your TradeNet invitation is ready</h1>
              <p style="margin:0 0 22px;font-size:15px;line-height:1.7;color:#a1a1aa;">You have been invited to create a TradeNet account. Accept the invitation below to finish setup.</p>
              <p style="margin:0 0 26px;">
                <a href="{{ .ConfirmationURL }}" style="display:inline-block;background:#c9a84c;color:#050506;text-decoration:none;font-weight:800;font-size:14px;padding:14px 22px;border-radius:12px;">Accept invitation</a>
              </p>
              <p style="margin:0 0 8px;font-size:13px;line-height:1.6;color:#71717a;">If the button does not work, copy and paste this link into your browser:</p>
              <p style="margin:0;font-size:12px;line-height:1.6;word-break:break-all;color:#c9a84c;">{{ .ConfirmationURL }}</p>
            </td>
          </tr>
          <tr>
            <td style="padding:20px 28px;background:#070708;border-top:1px solid #1f1f22;">
              <p style="margin:0;font-size:12px;line-height:1.6;color:#71717a;">If you were not expecting a TradeNet invitation, you can safely ignore this email.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</div>
```

## Change Email Address

Subject:

```text
Confirm your new TradeNet email
```

HTML:

```html
<div style="margin:0;padding:0;background:#050506;font-family:Inter,Arial,sans-serif;color:#fafafa;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#050506;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#09090b;border:1px solid #242426;border-radius:18px;overflow:hidden;">
          <tr>
            <td style="padding:28px 28px 18px;border-bottom:1px solid #1f1f22;">
              <img src="https://tradenet.org/assets/text-logo.png" alt="TradeNet" width="170" style="display:block;width:170px;max-width:170px;height:auto;border:0;outline:none;text-decoration:none;">
              <div style="margin-top:8px;font-size:12px;letter-spacing:1.6px;text-transform:uppercase;color:#c9a84c;">Email change confirmation</div>
            </td>
          </tr>
          <tr>
            <td style="padding:32px 28px;">
              <h1 style="margin:0 0 14px;font-size:28px;line-height:1.15;color:#fafafa;">Confirm your new email</h1>
              <p style="margin:0 0 14px;font-size:15px;line-height:1.7;color:#a1a1aa;">A request was made to change your TradeNet account email.</p>
              <p style="margin:0 0 22px;font-size:14px;line-height:1.7;color:#71717a;">Current email: <span style="color:#fafafa;">{{ .Email }}</span><br>New email: <span style="color:#fafafa;">{{ .NewEmail }}</span></p>
              <p style="margin:0 0 26px;">
                <a href="{{ .ConfirmationURL }}" style="display:inline-block;background:#c9a84c;color:#050506;text-decoration:none;font-weight:800;font-size:14px;padding:14px 22px;border-radius:12px;">Confirm email change</a>
              </p>
              <p style="margin:0 0 8px;font-size:13px;line-height:1.6;color:#71717a;">If the button does not work, copy and paste this link into your browser:</p>
              <p style="margin:0;font-size:12px;line-height:1.6;word-break:break-all;color:#c9a84c;">{{ .ConfirmationURL }}</p>
            </td>
          </tr>
          <tr>
            <td style="padding:20px 28px;background:#070708;border-top:1px solid #1f1f22;">
              <p style="margin:0;font-size:12px;line-height:1.6;color:#71717a;">If you did not request this email change, secure your account and contact TradeNet support.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</div>
```

## Reauthentication

Subject:

```text
Your TradeNet verification code
```

HTML:

```html
<div style="margin:0;padding:0;background:#050506;font-family:Inter,Arial,sans-serif;color:#fafafa;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#050506;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#09090b;border:1px solid #242426;border-radius:18px;overflow:hidden;">
          <tr>
            <td style="padding:28px 28px 18px;border-bottom:1px solid #1f1f22;">
              <img src="https://tradenet.org/assets/text-logo.png" alt="TradeNet" width="170" style="display:block;width:170px;max-width:170px;height:auto;border:0;outline:none;text-decoration:none;">
              <div style="margin-top:8px;font-size:12px;letter-spacing:1.6px;text-transform:uppercase;color:#c9a84c;">Security verification</div>
            </td>
          </tr>
          <tr>
            <td style="padding:32px 28px;">
              <h1 style="margin:0 0 14px;font-size:28px;line-height:1.15;color:#fafafa;">Verify this sensitive action</h1>
              <p style="margin:0 0 22px;font-size:15px;line-height:1.7;color:#a1a1aa;">Enter this one-time code in TradeNet to continue.</p>
              <p style="margin:0 0 22px;font-size:30px;letter-spacing:8px;font-weight:900;color:#fafafa;">{{ .Token }}</p>
              <p style="margin:0;font-size:13px;line-height:1.6;color:#71717a;">This code is only for your TradeNet account. Do not share it with anyone.</p>
            </td>
          </tr>
          <tr>
            <td style="padding:20px 28px;background:#070708;border-top:1px solid #1f1f22;">
              <p style="margin:0;font-size:12px;line-height:1.6;color:#71717a;">If you did not request this verification, you can safely ignore this email.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</div>
```
