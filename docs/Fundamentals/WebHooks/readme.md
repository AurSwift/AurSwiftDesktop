# Introduction

**Webhooks are like "phone notifications" from Stripe to your app.**

Webhooks are automated, event-driven messages that transfer data between applications in real-time using HTTP callbacks. When an event occurs in one application, it sends a message, or "payload," to a specific URL (the webhook) of another application, allowing them to communicate and trigger actions automatically without constant manual checks. For example, a service can use a webhook to notify another service of a new purchase, which then triggers a shipping notification.

## **How webhooks work**

- **Event trigger**: An event happens in a source application, such as a user making a purchase, a code commit, or a comment being posted.
- **HTTP POST request**: The source application sends an HTTP POST request to a pre-configured URL provided by the destination application.

- **Payload**: This request includes a "payload" of data about the event, often formatted as JSON.
- **Action**: The destination application receives the request, processes the data, and performs an action based on the event, such as updating a database, sending an email, or triggering another process.
- **Acknowledgment**: The destination application sends back an HTTP status code, like 200 OK, to confirm it successfully received the data.

## Simple Analogy:

### Without Webhooks (You Checking):

```
You: "Hey Stripe, did that payment go through?"
You: "Hey Stripe, what about this one?"
You: "Hey Stripe, any updates?"
→ You have to constantly ask
```

### With Webhooks (Stripe Calling You):

```
Stripe: "Hey your app, payment just succeeded!"
Stripe: "Hey your app, this payment failed!"
Stripe: "Hey your app, customer requested refund!"
→ Stripe automatically tells you when things happen
```

## Real-Life Example:

### Restaurant Order System:

```javascript
// WITHOUT Webhooks (You checking constantly)
customerOrdersFood → KitchenMakesFood → YouKeepAsking "Is it ready yet?" → EventuallyGetFood

// WITH Webhooks (Kitchen notifies you)
customerOrdersFood → KitchenMakesFood → KitchenRingsBell "ORDER READY!" → YouPickUpFood
```

## Technical Simple Explanation:

### What Happens:

1. **Event occurs** at Stripe (payment succeeds/fails/refunds)
2. **Stripe CALLS your server** with the update
3. **Your app reacts** (update database, print receipt, etc.)

### Without Webhooks:

```javascript
// Your app has to manually check status
async checkPaymentStatus(paymentId) {
  // You have to ask Stripe repeatedly
  const status = await stripe.paymentIntents.retrieve(paymentId);
  return status; // "Did it work yet? How about now?"
}
```

### With Webhooks:

```javascript
// Stripe automatically tells you
app.post("/stripe-webhook", (req, res) => {
  const event = req.body;

  if (event.type === "payment_intent.succeeded") {
    // Stripe is telling you: "Payment worked!"
    console.log("Payment succeeded:", event.data.object.id);
    updateDatabase(event.data.object);
    printReceiptIfNeeded(event.data.object);
  }
});
```

## Why This Matters for Your POS:

### Scenario: Customer pays $100

**Without Webhooks:**

- Card tapped → "Processing..." → Wait → "Approved!" → Done
- ✅ Simple for in-person payments

**With Webhooks:**

- Card tapped → "Processing..." → App gets notified later → "We'll print receipt when confirmed"
- ❌ More complex but handles edge cases

## Bottom Line:

**For your supermarket POS, you DON'T need webhooks initially** because:

- In-person payments are usually instant
- You get immediate approval/denial
- No need for "later notifications"

**Webhooks are for:**

- Online payments that take time to process
- Subscription renewals
- Refunds processed hours/days later
- Disputes that happen weeks later

Think of webhooks as "background notifications" - your in-person POS gets instant answers, so you don't need the notifications! 🎯
