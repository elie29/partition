# Billing — product requirements

Version 1.0

## Invoices

### REQ-1 — Issue an invoice

When an order is confirmed, an invoice is issued to the customer of the order, with one line per ordered item.
Rule: An invoice is issued once per order. Rule: The amount of an invoice is the sum of its lines.

### REQ-2 — Keep an issued invoice as issued

Rule: An issued invoice is never modified. A correction is made by cancelling the invoice and issuing a new
one.

### REQ-3 — Cancel an invoice

The accountant can cancel an invoice. Rule: An invoice is cancelled only before any payment, at no fee.

## Paying an invoice

### REQ-4 — Pay an invoice

The customer pays an issued invoice by card. The card is charged through CardPay. Rule: An invoice is paid
once its amount is paid in full.

### REQ-5 — Cancel a paid invoice

The customer can cancel a paid invoice. CardPay reverses the charge. Rule: A paid invoice is cancelled only
within 24 hours of being paid; the invoice is then unpaid again.

## Decisions

### DEC-1 — CardPay

Card payments go through CardPay, because it is the provider the company already has a contract with.

## Glossary

- **Cancelled** — of an unpaid invoice: voided before any payment, at no fee. Of a paid invoice: reversed within
  24 hours of being paid.
