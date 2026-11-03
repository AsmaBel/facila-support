const API = 'https://yuuswkhxvtlwvbjxfftp.supabase.co';
// Public app key; RLS and the authenticated RPC protect the request table.
const KEY = 'sb_publishable_qirXCIyC89AXkYLjwCrwmw_IH_rfCPY';

export function accountEmail(raw) {
  const input = raw.trim();
  if (input.includes('@')) return input.toLowerCase();
  const digits = input.replace(/[٠-٩۰-۹]/g, c => String(c.charCodeAt(0) - (c <= '٩' ? 0x660 : 0x6f0)))
    .replace(/\D/g, '');
  let national = digits;
  if (digits.startsWith('00213')) national = digits.slice(5);
  else if (digits.startsWith('213') && digits.length === 12) national = digits.slice(3);
  else if (digits.startsWith('0')) national = digits.slice(1);
  return /^[567]\d{8}$/.test(national) ? `213${national}@phone.facila.app` : null;
}

export async function verifyDeletion(identity, password, fetcher = fetch) {
  const email = accountEmail(identity);
  if (!email || !password) throw new Error('credentials');
  const login = await fetcher(`${API}/auth/v1/token?grant_type=password`, {
    method: 'POST', cache: 'no-store', credentials: 'omit', referrerPolicy: 'no-referrer',
    headers: { apikey: KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });
  if (!login.ok) throw new Error(login.status === 400 || login.status === 401 ? 'credentials' : 'network');
  const session = await login.json();
  // The token exists only in memory for this request. Never persist credentials,
  // create a browser session, or sign out the parent's other devices.
  const response = await fetcher(`${API}/rest/v1/rpc/request_account_deletion_verification`, {
    method: 'POST', cache: 'no-store', credentials: 'omit', referrerPolicy: 'no-referrer',
    headers: { apikey: KEY, 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
    body: '{}'
  });
  if (!response.ok) throw new Error('network');
  const receipt = await response.json();
  if (!/^[0-9a-f-]{36}$/i.test(receipt.reference) || !Number.isFinite(Date.parse(receipt.expires_at))) throw new Error('network');
  return receipt;
}

if (typeof document !== 'undefined') {
  const form = document.querySelector('#verify-deletion');
  const status = document.querySelector('#verification-status');
  form?.addEventListener('submit', async event => {
    event.preventDefault();
    const button = form.querySelector('button');
    const identity = form.elements.identity.value;
    const password = form.elements.password.value;
    form.elements.password.value = '';
    button.disabled = true;
    status.textContent = 'جارٍ التحقق… / Vérification… / Checking…';
    document.querySelector('#verified-request').hidden = true;
    try {
      const receipt = await verifyDeletion(identity, password);
      document.querySelector('#request-reference').textContent = receipt.reference;
      const body = `Facila account deletion request\nVerification reference: ${receipt.reference}\n\nPlease confirm the deletion scope before permanently deleting my account.`;
      document.querySelector('#send-verified-request').href = `mailto:classia.app@gmail.com?subject=${encodeURIComponent('Facila — account deletion request')}&body=${encodeURIComponent(body)}`;
      document.querySelector('#verified-request').hidden = false;
      status.textContent = 'تم التحقق. لم يُحذف الحساب. / Compte vérifié, non supprimé. / Verified; nothing has been deleted.';
    } catch (error) {
      status.textContent = error.message === 'credentials'
        ? 'تعذّر الدخول. راجع بيانات حساب فسيلة. / Vérifiez vos identifiants Facila. / Check your Facila login details.'
        : 'تعذّر الاتصال. حاول مجدداً أو راسل الدعم. / Réessayez ou contactez le support. / Try again or contact support.';
    } finally {
      button.disabled = false;
    }
  });
}
