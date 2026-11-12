// Sends one sample ISP bill message from the TPOS session to the number given (your own phone).
// Touches no bill and no ISP. Usage: node --env-file=/opt/tposadmin/api/.env api/test/whatsapp-send.js 03xxxxxxxxx
import { chargeMessage } from '../src/messages.js';
import { sendTposMessage } from '../src/whatsapp.js';

const phone = process.argv[2] || '';
if (!/^03[0-9]{9}$/.test(phone)) {
  console.log('give a phone like 03001234567');
  process.exit(1);
}

const text = chargeMessage({
  business_name: 'Test ISP',
  amount: 2500,
  collected_by_name: 'TPOS',
  balance: 0,
});

try {
  await sendTposMessage(phone, text);
  console.log('SENT');
} catch (err) {
  console.log(`FAILED ${err.message}`);
}
