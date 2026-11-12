// Same template as the customer payment message, without the method (ISP bills only).
export function chargeMessage(r) {
  return `Dear ${r.business_name}, PKR ${Number(r.amount)} received. Collected by: ${r.collected_by_name}. Remaining Balance: PKR ${Number(r.balance)}. Thank you! -TPOS`;
}
